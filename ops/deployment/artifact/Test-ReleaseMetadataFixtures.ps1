[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'ReleaseConsumer.psm1') -Force
$module = Get-Module ReleaseConsumer
& $module {
    $script:FixtureSha = 'a' * 40
    $script:FixtureDigest = 'sha256:' + ('b' * 64)
    function Reset-Fixture {
        $script:FixtureRun = [pscustomobject]@{
            id = 123; run_attempt = 1; name = 'vNext CI'; path = '.github/workflows/ci.yml'
            event = 'push'; status = 'completed'; conclusion = 'success'; head_sha = $script:FixtureSha; head_branch = 'main'
            repository = [pscustomobject]@{ id = 999; full_name = 'Xpotato1024/xpotato-site' }
            pull_requests = @([pscustomobject]@{ head = [pscustomobject]@{ sha = $script:FixtureSha; repo = [pscustomobject]@{ id = 999 } }; base = [pscustomobject]@{ ref = 'main' } })
        }
        $script:FixtureJobs = [pscustomobject]@{ jobs = @([pscustomobject]@{ name = 'producer'; status = 'completed'; conclusion = 'success' }) }
        $script:FixtureArtifact = [pscustomobject]@{ id = 456; name = 'site-release-123-1'; expired = $false; expires_at = [DateTimeOffset]::UtcNow.AddDays(30).ToString('o'); digest = $script:FixtureDigest; size_in_bytes = 1234 }
        $script:FixtureMissing = $false
    }
    $originalApi = ${function:Invoke-GitHubJson}
    function Invoke-GitHubJson {
        param($Client, $Path)
        if ($Path -eq '/repos/Xpotato1024/xpotato-site/actions/runs/123/attempts/1') { return $script:FixtureRun }
        if ($Path -eq '/repos/Xpotato1024/xpotato-site/actions/runs/123') { throw 'Mutable latest-attempt endpoint is forbidden by this fixture' }
        if ($Path -like '*/attempts/1/jobs?*') { return $script:FixtureJobs }
        if ($Path -like '*/123/artifacts?*') { return [pscustomobject]@{ artifacts = @(if (-not $script:FixtureMissing) { $script:FixtureArtifact }) } }
        throw "Unexpected fixture API path: $Path"
    }
    $client = [System.Net.Http.HttpClient]::new()
    function Check-Fixture {
        param([string]$Name, [scriptblock]$Mutate, [bool]$Reject = $true, [string]$Mode = 'Production')
        Reset-Fixture
        & $Mutate
        $rejected = $false
        try { $null = Get-GitHubRunContext -Mode $Mode -RunId '123' -RunAttempt 1 -ArtifactId '456' -SourceSha $script:FixtureSha -ExpectedDigest $script:FixtureDigest -Client $client }
        catch { $rejected = $true }
        if ($rejected -ne $Reject) { throw "Metadata fixture failed: $Name; rejected=$rejected" }
        $script:FixtureCount++
    }
    try {
        $script:FixtureCount = 0
        Check-Fixture 'successful selected attempt survives a newer attempt' {} $false
        Check-Fixture 'same-run main candidate' { $script:FixtureRun.status = 'in_progress'; $script:FixtureRun.conclusion = $null } $false 'Candidate'
        Check-Fixture 'same-repository PR candidate' { $script:FixtureRun.event = 'pull_request'; $script:FixtureRun.head_branch = 'feature'; $script:FixtureRun.status = 'in_progress'; $script:FixtureRun.conclusion = $null } $false 'Candidate'
        Check-Fixture 'PR cannot become production' { $script:FixtureRun.event = 'pull_request' }
        Check-Fixture 'incomplete production run' { $script:FixtureRun.status = 'in_progress' }
        Check-Fixture 'failed production run' { $script:FixtureRun.conclusion = 'failure' }
        Check-Fixture 'wrong branch' { $script:FixtureRun.head_branch = 'feature' }
        Check-Fixture 'wrong event' { $script:FixtureRun.event = 'workflow_dispatch' }
        Check-Fixture 'source mismatch' { $script:FixtureRun.head_sha = 'c' * 40 }
        Check-Fixture 'run mismatch' { $script:FixtureRun.id = 124 }
        Check-Fixture 'attempt mismatch' { $script:FixtureRun.run_attempt = 2 }
        Check-Fixture 'repository mismatch' { $script:FixtureRun.repository.full_name = 'other/repo' }
        Check-Fixture 'workflow path mismatch' { $script:FixtureRun.path = '.github/workflows/other.yml' }
        Check-Fixture 'workflow name mismatch' { $script:FixtureRun.name = 'Other CI' }
        Check-Fixture 'producer failed' { $script:FixtureJobs.jobs[0].conclusion = 'failure' }
        Check-Fixture 'producer not finished' { $script:FixtureJobs.jobs[0].status = 'in_progress' }
        Check-Fixture 'artifact ID mismatch' { $script:FixtureArtifact.id = 457 }
        Check-Fixture 'missing artifact' { $script:FixtureMissing = $true }
        Check-Fixture 'digest mismatch' { $script:FixtureArtifact.digest = 'sha256:' + ('c' * 64) }
        Check-Fixture 'expired flag' { $script:FixtureArtifact.expired = $true }
        Check-Fixture 'expiry date elapsed' { $script:FixtureArtifact.expires_at = [DateTimeOffset]::UtcNow.AddDays(-1).ToString('o') }
        Check-Fixture 'artifact attempt mismatch' { $script:FixtureArtifact.name = 'site-release-123-2' }
        Check-Fixture 'fork PR rejected' { $script:FixtureRun.event = 'pull_request'; $script:FixtureRun.pull_requests[0].head.repo.id = 998 } $true 'Candidate'
        Check-Fixture 'PR source association mismatch' { $script:FixtureRun.event = 'pull_request'; $script:FixtureRun.pull_requests[0].head.sha = 'c' * 40 } $true 'Candidate'
        Check-Fixture 'PR wrong base' { $script:FixtureRun.event = 'pull_request'; $script:FixtureRun.pull_requests[0].base.ref = 'other' } $true 'Candidate'
        Write-Output "Metadata fixtures PASS: $($script:FixtureCount); network/build count=0"
    } finally {
        $client.Dispose()
        ${function:Invoke-GitHubJson} = $originalApi
    }
}

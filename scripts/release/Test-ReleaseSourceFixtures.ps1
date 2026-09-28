[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'ReleaseConsumer.psm1') -Force
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
& (Get-Module ReleaseConsumer) {
    param($RepositoryRoot)
    $client = [System.Net.Http.HttpClient]::new()
    $originalApi = ${function:Invoke-GitHubJson}
    $originalSource = ${function:Get-GitHubSourceBytes}
    $script:SourceFixtureSha = 'a' * 40
    $script:SourceFixtureConfig = [IO.File]::ReadAllBytes((Join-Path $RepositoryRoot 'apps/site/wrangler.jsonc'))
    $script:SourceFixtureLock = [IO.File]::ReadAllBytes((Join-Path $RepositoryRoot 'package-lock.json'))
    $originalConfig = $script:SourceFixtureConfig
    $package = Get-Content -LiteralPath (Join-Path $RepositoryRoot 'package.json') -Raw | ConvertFrom-Json
    $expectedWrangler = [string]$package.devDependencies.wrangler
    function Invoke-GitHubJson {
        param($Client, $Path)
        if ($Path -cne ('/repos/Xpotato1024/xpotato-site/contents/apps/site/wrangler.jsonc?ref=' + $script:SourceFixtureSha)) { throw 'Source API URL is not pinned to exact path/SHA' }
        return [pscustomobject]@{ path = 'apps/site/wrangler.jsonc'; encoding = 'base64'; content = [Convert]::ToBase64String($script:SourceFixtureConfig) }
    }
    try {
        $bytes = Get-GitHubSourceBytes $client 'apps/site/wrangler.jsonc' $script:SourceFixtureSha
        if (-not (Test-ByteArraysEqual $bytes $originalConfig)) { throw 'Source API bytes changed' }
        function Get-GitHubSourceBytes {
            param($Client, $Path, $SourceSha)
            if ($SourceSha -cne $script:SourceFixtureSha) { throw 'Source fixture SHA mismatch' }
            if ($Path -ceq 'apps/site/wrangler.jsonc') { return ,$script:SourceFixtureConfig }
            if ($Path -ceq 'package-lock.json') { return ,$script:SourceFixtureLock }
            throw "Unexpected source fixture path: $Path"
        }
        $policy = Get-SourcePolicy $client $script:SourceFixtureSha $expectedWrangler
        if (-not (Test-ByteArraysEqual $policy.ConfigBytes $originalConfig)) { throw 'Exact source config bytes not retained' }
        if ($policy.WranglerVersion -cne $expectedWrangler) { throw 'Wrong source lock pin' }
        $cases = @(
            @{ Name = 'workers.dev'; Change = { param($c) $c.workers_dev = $true } },
            @{ Name = 'preview URLs'; Change = { param($c) $c.preview_urls = $true } },
            @{ Name = 'R2'; Change = { param($c) $c | Add-Member -NotePropertyName r2_buckets -NotePropertyValue @() } },
            @{ Name = 'env override'; Change = { param($c) $c | Add-Member -NotePropertyName env -NotePropertyValue ([pscustomobject]@{}) } },
            @{ Name = 'build hook'; Change = { param($c) $c | Add-Member -NotePropertyName build -NotePropertyValue ([pscustomobject]@{ command = 'bad' }) } },
            @{ Name = 'alternate assets'; Change = { param($c) $c.assets.directory = '../other' } },
            @{ Name = 'wrong service'; Change = { param($c) $c.name = 'other' } },
            @{ Name = 'string false'; Change = { param($c) $c.workers_dev = 'false' } }
        )
        foreach ($case in $cases) {
            $config = [Text.Encoding]::UTF8.GetString($originalConfig) | ConvertFrom-Json
            & $case.Change $config
            $script:SourceFixtureConfig = [Text.Encoding]::UTF8.GetBytes(($config | ConvertTo-Json -Depth 10))
            $rejected = $false
            try { $null = Get-SourcePolicy $client $script:SourceFixtureSha $expectedWrangler } catch { $rejected = $true }
            if (-not $rejected) { throw "Config fixture accepted: $($case.Name)" }
        }
        $script:SourceFixtureConfig = $originalConfig
        $rejected = $false
        try { $null = Get-SourcePolicy $client $script:SourceFixtureSha '0.0.0' } catch { $rejected = $true }
        if (-not $rejected) { throw 'Wrangler source lock mismatch accepted' }
        Write-Output 'Source/config fixtures PASS: 11; actual repository lock bytes; network/build count=0'
    } finally {
        $client.Dispose()
        ${function:Invoke-GitHubJson} = $originalApi
        ${function:Get-GitHubSourceBytes} = $originalSource
    }
} $root

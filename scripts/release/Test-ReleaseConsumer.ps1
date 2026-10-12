#Requires -Version 5.1
[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$TempRoot)
$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if ($TempRoot -notmatch '^[A-Za-z]:[\\/]' -or $TempRoot -match '[*?]' -or $TempRoot -match '(^|[\\/])\.\.?([\\/]|$)') { throw 'Fixture temp root must be a fully qualified local Windows path.' }
$fixtureRoot = [System.IO.Path]::GetFullPath($TempRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
$volumeRoot = [System.IO.Path]::GetPathRoot($fixtureRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
if ($fixtureRoot -ceq $volumeRoot -or [System.IO.Directory]::Exists($fixtureRoot) -or [System.IO.File]::Exists($fixtureRoot)) { throw 'Fixture temp root must be a fresh non-root directory.' }
if (-not [System.IO.Directory]::Exists([System.IO.Path]::GetDirectoryName($fixtureRoot))) { throw 'Fixture temp root parent must already exist.' }

Import-Module (Join-Path $PSScriptRoot 'ReleaseConsumer.psm1') -Force
$module = Get-Module ReleaseConsumer
[void](& $module { param($Path) [void](Get-FullyQualifiedWindowsPath $Path) } $fixtureRoot)
[void][System.IO.Directory]::CreateDirectory($fixtureRoot)
$junctionPath = $null
try {
    & (Join-Path $PSScriptRoot 'Test-ReleaseMetadataFixtures.ps1')
    & (Join-Path $PSScriptRoot 'Test-ReleaseSourceFixtures.ps1')
    Import-Module (Join-Path $PSScriptRoot 'ReleaseConsumer.psm1') -Force
    $module = Get-Module ReleaseConsumer
    & $module {
        param([string]$Root, [string]$RepositoryRoot)
        $script:FixtureCount = 0
        $script:SourceSha = 'a' * 40
        $script:Digest = $null
        $script:Expiry = [DateTimeOffset]::UtcNow.AddDays(30).ToString('o')
        $script:ConfigBytes = [System.IO.File]::ReadAllBytes((Join-Path $RepositoryRoot 'apps/site/wrangler.jsonc'))
        $script:LockBytes = [System.IO.File]::ReadAllBytes((Join-Path $RepositoryRoot 'package-lock.json'))
        $script:Package = Get-Content -LiteralPath (Join-Path $RepositoryRoot 'package.json') -Raw | ConvertFrom-Json
        $script:OperationRoot = Join-Path $Root 'production-release'
        $script:ArchivePath = Join-Path $script:OperationRoot 'archive.zip'
        $script:MutationDuringApi = $false
        $script:IndexText = '<!doctype html><title>fixture</title>'

        function Assert-Fixture {
            param([string]$Name, [scriptblock]$Action)
            try { & $Action }
            catch { throw ("Fixture failed unexpectedly: " + $Name) }
            $script:FixtureCount++
        }
        function Assert-RejectedFixture {
            param([string]$Name, [scriptblock]$Action)
            $rejected = $false
            try { & $Action } catch { $rejected = $true }
            if (-not $rejected) { throw ("Fixture accepted unsafe input: " + $Name) }
            $script:FixtureCount++
        }
        function New-FixtureRelease {
            return [ordered]@{
                schemaVersion = 1
                releaseContract = 'xpotato-site-release-v1'
                repository = 'Xpotato1024/xpotato-site'
                sourceSha = $script:SourceSha
                serverAuthoritySha = 'ab9328c5a58082ac1ec268aa7d5901d838a6a474'
                workflowName = 'vNext CI'
                workflowPath = '.github/workflows/ci.yml'
                workflowRunId = '123'
                workflowRunAttempt = 1
                gitRef = 'refs/heads/main'
                event = 'push'
                producerOs = 'Linux'
                nodeVersion = '22.18.0'
                npmVersion = '10.8.2'
                wranglerVersion = [string]$script:Package.devDependencies.wrangler
                wranglerConfigPath = 'apps/site/wrangler.jsonc'
                productionEligible = $true
                validation = [ordered]@{
                    source = 'PASS'
                    final = 'PASS'
                    reference = 'https://github.com/Xpotato1024/xpotato-site/actions/runs/123/attempts/1'
                }
            }
        }
        function New-BaseFixtureFiles {
            $releaseText = (ConvertTo-Json -InputObject (New-FixtureRelease) -Depth 10) + "`n"
            return @(
                [pscustomobject]@{ Path = 'release.json'; Bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($releaseText); Attributes = 0 },
                [pscustomobject]@{ Path = 'apps/site/wrangler.jsonc'; Bytes = $script:ConfigBytes; Attributes = 0 },
                [pscustomobject]@{ Path = 'apps/site/dist/index.html'; Bytes = [System.Text.Encoding]::UTF8.GetBytes($script:IndexText); Attributes = 0 },
                [pscustomobject]@{ Path = 'apps/site/dist/_headers'; Bytes = [System.Text.Encoding]::UTF8.GetBytes('/*' + "`n" + ' X-Content-Type-Options: nosniff' + "`n"); Attributes = 0 },
                [pscustomobject]@{ Path = 'apps/site/dist/.well-known/security.txt'; Bytes = [System.Text.Encoding]::UTF8.GetBytes('Contact: mailto:security@example.invalid' + "`n"); Attributes = 0 }
            )
        }
        function New-ZipFixture {
            param([string]$Path, [object[]]$Extra = @(), [switch]$OmitHeaders, [string]$IndexText = '<!doctype html><title>fixture</title>')
            $script:IndexText = $IndexText
            $fs = [System.IO.File]::Open($Path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
            $zip = $null
            try {
                $zip = [System.IO.Compression.ZipArchive]::new($fs, [System.IO.Compression.ZipArchiveMode]::Create, $true)
                foreach ($item in @(New-BaseFixtureFiles)) {
                    if ($OmitHeaders -and $item.Path -ceq 'apps/site/dist/_headers') { continue }
                    Write-FixtureZipEntry $zip $item
                }
                foreach ($item in $Extra) { Write-FixtureZipEntry $zip $item }
            } finally {
                if ($null -ne $zip) { $zip.Dispose() }
                $fs.Dispose()
            }
        }
        function Write-FixtureZipEntry {
            param([System.IO.Compression.ZipArchive]$Zip, $Item)
            $entry = $Zip.CreateEntry([string]$Item.Path, [System.IO.Compression.CompressionLevel]::NoCompression)
            if ([int]$Item.Attributes -ne 0) { $entry.ExternalAttributes = [int]$Item.Attributes }
            if (-not ([string]$Item.Path).EndsWith('/')) {
                $output = $entry.Open()
                try { $output.Write([byte[]]$Item.Bytes, 0, ([byte[]]$Item.Bytes).Length) }
                finally { $output.Dispose() }
            }
        }

        $oldToken = ${function:Get-GitHubToken}
        $oldClient = ${function:New-GitHubApiClient}
        $oldApi = ${function:Invoke-GitHubJson}
        $oldSource = ${function:Get-GitHubSourceBytes}
        function Get-GitHubToken { return 'fixture-token-not-a-secret' }
        function New-GitHubApiClient { return [System.Net.Http.HttpClient]::new() }
        function Get-GitHubSourceBytes {
            param($Client, [string]$Path, [string]$SourceSha)
            if ($SourceSha -cne $script:SourceSha) { throw 'fixture source SHA mismatch' }
            if ($Path -ceq 'apps/site/wrangler.jsonc') { return ,$script:ConfigBytes }
            if ($Path -ceq 'package-lock.json') { return ,$script:LockBytes }
            throw 'fixture requested an unexpected source path'
        }
        function Invoke-GitHubJson {
            param($Client, [string]$Path)
            if ($Path -ceq '/repos/Xpotato1024/xpotato-site/actions/runs/123/attempts/1') { return $script:Run }
            if ($Path -like '*/attempts/1/jobs?per_page=100') { return [pscustomobject]@{ jobs = @([pscustomobject]@{ name = 'producer'; status = 'completed'; conclusion = 'success' }) } }
            if ($Path -like '*/123/artifacts?per_page=100&page=1') {
                if ($script:MutationDuringApi) {
                    $script:MutationDuringApi = $false
                    $alternateZip = Join-Path $Root 'api-time-alternate.zip'
                    New-ZipFixture $alternateZip -IndexText '<!doctype html><title>changed!</title>'
                    [System.IO.File]::WriteAllBytes($script:ArchivePath, [System.IO.File]::ReadAllBytes($alternateZip))
                    [System.IO.File]::WriteAllText((Join-Path $script:OperationRoot 'staging/apps/site/dist/index.html'), '<!doctype html><title>changed!</title>', [System.Text.Encoding]::UTF8)
                }
                return [pscustomobject]@{ artifacts = @($script:Artifact) }
            }
            throw 'fixture requested an unexpected API path'
        }
        try {
            Assert-RejectedFixture 'drive-relative operation root' { Get-FullyQualifiedWindowsPath 'C:relative' }
            Assert-RejectedFixture 'single-rooted operation path' { Get-FullyQualifiedWindowsPath '\rooted' }
            Assert-RejectedFixture 'UNC operation path' { Get-FullyQualifiedWindowsPath '\\server\share\op' }

            $validZip = Join-Path $Root 'valid-file-only-layout.zip'
            New-ZipFixture $validZip
            $staging = Join-Path $Root 'clean-staging'
            [void][System.IO.Directory]::CreateDirectory($staging)
            $validStream = [System.IO.File]::OpenRead($validZip)
            try {
                $validArchive = [System.IO.Compression.ZipArchive]::new($validStream, [System.IO.Compression.ZipArchiveMode]::Read, $false)
                try {
                    $validEntries = Get-ValidatedZipEntries $validArchive
                    if ($validEntries.Count -ne 5) { throw 'file-only ZIP layout was not recognized exactly' }
                } finally { $validArchive.Dispose() }
            } finally { $validStream.Dispose() }
            $expanded = Expand-ReleaseArchive $validZip $staging
            if (@($expanded).Count -ne 5) { throw 'valid archive did not expand to expected file set' }
            $digest = 'sha256:' + (Get-FileSha256 $validZip)
            Assert-StagingMatchesArchive $validZip $staging $digest
            $script:FixtureCount++

            $unsafeCases = @(
                @{ Name = 'traversal'; Path = 'apps/site/dist/../../escape.js'; Attributes = 0 },
                @{ Name = 'absolute path'; Path = '/apps/site/dist/evil.js'; Attributes = 0 },
                @{ Name = 'drive path'; Path = 'C:/apps/site/dist/evil.js'; Attributes = 0 },
                @{ Name = 'UNC path'; Path = '//server/share/evil.js'; Attributes = 0 },
                @{ Name = 'alternate data stream'; Path = 'apps/site/dist/evil.js:secret'; Attributes = 0 },
                @{ Name = 'reserved device'; Path = 'apps/site/dist/CON.txt'; Attributes = 0 },
                @{ Name = 'source tree'; Path = 'apps/site/dist/src/main.js'; Attributes = 0 },
                @{ Name = 'worker hook'; Path = 'apps/site/dist/_worker.js'; Attributes = 0 },
                @{ Name = 'routes hook'; Path = 'apps/site/dist/_routes.json'; Attributes = 0 },
                @{ Name = 'assetsignore'; Path = 'apps/site/dist/.assetsignore'; Attributes = 0 },
                @{ Name = 'source map'; Path = 'apps/site/dist/app.js.map'; Attributes = 0 },
                @{ Name = 'unknown root'; Path = 'other/payload.txt'; Attributes = 0 },
                @{ Name = 'case collision'; Path = 'apps/site/dist/INDEX.HTML'; Attributes = 0 },
                @{ Name = 'file directory conflict'; Path = 'apps/site/dist/index.html/child.js'; Attributes = 0 }
            )
            foreach ($case in $unsafeCases) {
                $badZip = Join-Path $Root ('unsafe-' + $case.Name.Replace(' ', '-') + '.zip')
                $extra = [pscustomobject]@{ Path = $case.Path; Bytes = [System.Text.Encoding]::UTF8.GetBytes('bad'); Attributes = 0 }
                New-ZipFixture $badZip @($extra)
                $badStream = [System.IO.File]::OpenRead($badZip)
                try {
                    $badArchive = [System.IO.Compression.ZipArchive]::new($badStream, [System.IO.Compression.ZipArchiveMode]::Read, $false)
                    try { Assert-RejectedFixture $case.Name { Get-ValidatedZipEntries $badArchive } }
                    finally { $badArchive.Dispose() }
                } finally { $badStream.Dispose() }
            }

            $symlinkZip = Join-Path $Root 'unsafe-link.zip'
            $linkBits = [BitConverter]::GetBytes([int]0xA1FF0000)
            $linkAttrs = [BitConverter]::ToInt32($linkBits, 0)
            New-ZipFixture $symlinkZip @([pscustomobject]@{ Path = 'apps/site/dist/link.js'; Bytes = [System.Text.Encoding]::UTF8.GetBytes('target'); Attributes = $linkAttrs })
            $linkStream = [System.IO.File]::OpenRead($symlinkZip)
            try {
                $linkArchive = [System.IO.Compression.ZipArchive]::new($linkStream, [System.IO.Compression.ZipArchiveMode]::Read, $false)
                try { Assert-RejectedFixture 'symbolic link entry' { Get-ValidatedZipEntries $linkArchive } }
                finally { $linkArchive.Dispose() }
            } finally { $linkStream.Dispose() }

            $missingHeaderZip = Join-Path $Root 'missing-headers.zip'
            New-ZipFixture $missingHeaderZip @() -OmitHeaders
            $missingStream = [System.IO.File]::OpenRead($missingHeaderZip)
            try {
                $missingArchive = [System.IO.Compression.ZipArchive]::new($missingStream, [System.IO.Compression.ZipArchiveMode]::Read, $false)
                try { Assert-RejectedFixture 'missing required generated headers' { Get-ValidatedZipEntries $missingArchive } }
                finally { $missingArchive.Dispose() }
            } finally { $missingStream.Dispose() }

            $oldExpandedLimit = $script:MaxExpandedBytes
            try {
                $script:MaxExpandedBytes = 64
                $limitStream = [System.IO.File]::OpenRead($validZip)
                try {
                    $limitArchive = [System.IO.Compression.ZipArchive]::new($limitStream, [System.IO.Compression.ZipArchiveMode]::Read, $false)
                    try { Assert-RejectedFixture 'unreasonable expanded size' { Get-ValidatedZipEntries $limitArchive } }
                    finally { $limitArchive.Dispose() }
                } finally { $limitStream.Dispose() }
            } finally { $script:MaxExpandedBytes = $oldExpandedLimit }

            $junctionTarget = Join-Path $Root 'junction-target'
            $junctionPath = Join-Path $Root 'staging-junction'
            [void][System.IO.Directory]::CreateDirectory($junctionTarget)
            try {
                New-Item -ItemType Junction -Path $junctionPath -Target $junctionTarget -ErrorAction Stop | Out-Null
                Assert-RejectedFixture 'reparse staging root' { Expand-ReleaseArchive $validZip $junctionPath }
            } catch { throw 'Junction fixture could not be created or reparse staging was accepted.' }
            finally { if (Test-Path -LiteralPath $junctionPath) { Remove-Item -LiteralPath $junctionPath -Force } }

            $script:OperationRoot = Join-Path $Root 'production-release'
            [void][System.IO.Directory]::CreateDirectory($script:OperationRoot)
            $script:ArchivePath = Join-Path $script:OperationRoot 'archive.zip'
            [System.IO.File]::Copy($validZip, $script:ArchivePath)
            $script:Digest = 'sha256:' + (Get-FileSha256 $script:ArchivePath)
            $stageRoot = Join-Path $script:OperationRoot 'staging'
            [void][System.IO.Directory]::CreateDirectory($stageRoot)
            [void](Expand-ReleaseArchive $script:ArchivePath $stageRoot)
            $script:Run = [pscustomobject]@{
                id = 123; run_attempt = 1; name = 'vNext CI'; path = '.github/workflows/ci.yml'; event = 'push'; status = 'completed'; conclusion = 'success'
                head_sha = $script:SourceSha; head_branch = 'main'; repository = [pscustomobject]@{ id = 999; full_name = 'Xpotato1024/xpotato-site' }
            }
            $script:Artifact = [pscustomobject]@{
                id = 456; name = 'site-release-123-1'; expired = $false; expires_at = $script:Expiry
                digest = $script:Digest; size_in_bytes = (Get-Item -LiteralPath $script:ArchivePath).Length
            }
            $releaseBytes = [System.Text.UTF8Encoding]::new($false).GetBytes(((ConvertTo-Json -InputObject (New-FixtureRelease) -Depth 10) + "`n"))
            [System.IO.File]::WriteAllBytes((Join-Path $stageRoot 'release.json'), $releaseBytes)
            $identity = [ordered]@{
                identityContract = 'xpotato-site-release-identity-v1'; mode = 'Production'; repository = 'Xpotato1024/xpotato-site'; sourceSha = $script:SourceSha
                workflowPath = '.github/workflows/ci.yml'; runId = '123'; runAttempt = 1; artifactId = '456'; archiveDigest = $script:Digest
                expiresAt = $script:Expiry; event = 'push'; productionEligible = $true; releaseContract = 'xpotato-site-release-v1'; writtenAt = [DateTimeOffset]::UtcNow.ToString('o')
            }
            $identityPath = Join-Path $script:OperationRoot 'identity.json'
            [System.IO.File]::WriteAllText($identityPath, (ConvertTo-Json -InputObject $identity -Depth 5), [System.Text.UTF8Encoding]::new($false))
            $context = [pscustomobject]@{
                Mode = 'Production'; RunId = '123'; RunAttempt = 1; ArtifactId = '456'; SourceSha = $script:SourceSha; ExpectedDigest = $script:Digest
                Event = 'push'; HeadBranch = 'main'; ProductionEligible = $true; Expiration = $script:Expiry
            }
            Assert-Fixture 'packaged config and source lock policy' { $null = Assert-PackageMatchesSource $stageRoot $context ([System.Net.Http.HttpClient]::new()) }

            $originalIndex = [System.IO.File]::ReadAllBytes((Join-Path $stageRoot 'apps/site/dist/index.html'))
            [System.IO.File]::WriteAllText((Join-Path $stageRoot 'apps/site/dist/index.html'), 'tampered', [System.Text.Encoding]::UTF8)
            Assert-RejectedFixture 'altered staged file bytes' { Assert-StagingMatchesArchive $script:ArchivePath $stageRoot $script:Digest }
            [System.IO.File]::WriteAllBytes((Join-Path $stageRoot 'apps/site/dist/index.html'), $originalIndex)
            $extraStageFile = Join-Path $stageRoot 'apps/site/dist/extra.txt'
            [System.IO.File]::WriteAllText($extraStageFile, 'extra')
            Assert-RejectedFixture 'extra staged path' { Assert-StagingMatchesArchive $script:ArchivePath $stageRoot $script:Digest }
            [System.IO.File]::Delete($extraStageFile)

            $configPath = Join-Path $stageRoot 'apps/site/wrangler.jsonc'
            [System.IO.File]::WriteAllText($configPath, '{"name":"other"}', [System.Text.Encoding]::UTF8)
            Assert-RejectedFixture 'artifact config changed from source' { Assert-PackageMatchesSource $stageRoot $context ([System.Net.Http.HttpClient]::new()) }
            [System.IO.File]::WriteAllBytes($configPath, $script:ConfigBytes)

            $verified = Test-SiteArtifactHandoff -OperationRoot $script:OperationRoot -ExpectedDigest $script:Digest -SourceSha $script:SourceSha -RunId '123' -RunAttempt 1 -ArtifactId '456'
            if (-not $verified.ArtifactHandoffVerified -or $verified.DeployExecuted -or $verified.ConfigPath -cne $configPath) { throw 'Production artifact handoff fixture returned an invalid outcome.' }
            $script:FixtureCount++

            $candidateIdentity = [ordered]@{}
            foreach ($key in $identity.Keys) { $candidateIdentity[$key] = $identity[$key] }
            $candidateIdentity.mode = 'Candidate'
            [System.IO.File]::WriteAllText($identityPath, (ConvertTo-Json -InputObject $candidateIdentity -Depth 5), [System.Text.UTF8Encoding]::new($false))
            Assert-RejectedFixture 'candidate cannot pass production handoff' { Test-SiteArtifactHandoff -OperationRoot $script:OperationRoot -ExpectedDigest $script:Digest -SourceSha $script:SourceSha -RunId '123' -RunAttempt 1 -ArtifactId '456' }
            [System.IO.File]::WriteAllText($identityPath, (ConvertTo-Json -InputObject $identity -Depth 5), [System.Text.UTF8Encoding]::new($false))

            $script:MutationDuringApi = $true
            Assert-RejectedFixture 'archive replaced during API revalidation' { Test-SiteArtifactHandoff -OperationRoot $script:OperationRoot -ExpectedDigest $script:Digest -SourceSha $script:SourceSha -RunId '123' -RunAttempt 1 -ArtifactId '456' }
            Write-Output ("Consumer ZIP/staging/handoff fixtures PASS: " + $script:FixtureCount + '; network/build/deploy count=0')
        } finally {
            ${function:Get-GitHubToken} = $oldToken
            ${function:New-GitHubApiClient} = $oldClient
            ${function:Invoke-GitHubJson} = $oldApi
            ${function:Get-GitHubSourceBytes} = $oldSource
        }
    } $fixtureRoot $repoRoot
} finally {
    if ($junctionPath -and (Test-Path -LiteralPath $junctionPath)) { Remove-Item -LiteralPath $junctionPath -Force }
    if ([System.IO.Directory]::Exists($fixtureRoot)) { [System.IO.Directory]::Delete($fixtureRoot, $true) }
}

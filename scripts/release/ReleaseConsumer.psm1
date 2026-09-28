Set-StrictMode -Version Latest
$script:Repo = 'Xpotato1024/xpotato-site'
$script:WorkflowName = 'vNext CI'
$script:WorkflowPath = '.github/workflows/ci.yml'
$script:ConfigPath = 'apps/site/wrangler.jsonc'
$script:ReleaseContract = 'xpotato-site-release-v1'
$script:IdentityContract = 'xpotato-site-release-identity-v1'
$script:AcceptedServerSha = 'c54a06ee377cae365af623b598ed852c4b577e1f'
$script:MaxArchiveBytes = 536870912
$script:MaxExpandedBytes = 1073741824
$script:MaxFileBytes = 268435456
$script:MaxEntries = 50000
$script:AllowedExtensions = @('.html', '.css', '.js', '.json', '.xml', '.txt', '.svg', '.ico', '.png', '.webp', '.avif', '.jpg', '.jpeg', '.woff', '.woff2')

Add-Type -AssemblyName System.Net.Http -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.IO.Compression -ErrorAction SilentlyContinue
Add-Type -AssemblyName System.Web.Extensions -ErrorAction SilentlyContinue

function Stop-ReleaseValidation {
    param([Parameter(Mandatory = $true)][string]$Message)
    throw [System.InvalidOperationException]::new($Message)
}

function Assert-HasProperties {
    param($Object, [string[]]$Names, [string]$Context)
    if ($null -eq $Object -or $Object -is [string] -or $Object -is [System.Array]) {
        Stop-ReleaseValidation "$Context must be an object."
    }
    foreach ($name in $Names) {
        if ($null -eq $Object.PSObject.Properties[$name]) {
            Stop-ReleaseValidation "$Context is missing required field '$name'."
        }
    }
}

function Assert-ExactProperties {
    param($Object, [string[]]$Names, [string]$Context)
    Assert-HasProperties $Object $Names $Context
    $expected = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    $actual = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
    foreach ($name in $Names) { [void]$expected.Add($name) }
    foreach ($property in $Object.PSObject.Properties) {
        if ($property.MemberType -eq 'NoteProperty' -or $property.MemberType -eq 'Property') {
            [void]$actual.Add([string]$property.Name)
        }
    }
    foreach ($name in $actual) {
        if (-not $expected.Contains($name)) { Stop-ReleaseValidation "$Context contains unsupported field '$name'." }
    }
    foreach ($name in $expected) {
        if (-not $actual.Contains($name)) { Stop-ReleaseValidation "$Context has invalid field casing or is missing '$name'." }
    }
}

function Assert-Sha40 {
    param($Value, [string]$Name)
    if ($Value -isnot [string] -or $Value -cnotmatch '^[a-f0-9]{40}$') {
        Stop-ReleaseValidation "$Name is invalid."
    }
}

function Assert-Digest {
    param($Value, [string]$Name)
    if ($Value -isnot [string] -or $Value -cnotmatch '^sha256:[a-f0-9]{64}$') {
        Stop-ReleaseValidation "$Name is invalid."
    }
}

function ConvertFrom-StrictUtf8 {
    param([byte[]]$Bytes, [string]$Context)
    try { return ([System.Text.UTF8Encoding]::new($false, $true)).GetString($Bytes) }
    catch { Stop-ReleaseValidation "$Context is not valid UTF-8." }
}

function Get-BytesSha256 {
    param([byte[]]$Bytes)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return [System.BitConverter]::ToString($sha.ComputeHash($Bytes)).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}

function Get-FileSha256 {
    param([string]$Path)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $stream = $null
    try {
        $stream = [System.IO.File]::OpenRead($Path)
        return [System.BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
    } finally {
        if ($null -ne $stream) { $stream.Dispose() }
        $sha.Dispose()
    }
}

function Test-ByteArraysEqual {
    param([byte[]]$Left, [byte[]]$Right)
    if ($Left.Length -ne $Right.Length) { return $false }
    for ($i = 0; $i -lt $Left.Length; $i++) { if ($Left[$i] -ne $Right[$i]) { return $false } }
    return $true
}

function Get-GitHubToken {
    $token = $env:GH_TOKEN
    if ([string]::IsNullOrWhiteSpace($token)) { $token = $env:GITHUB_TOKEN }
    if (-not [string]::IsNullOrWhiteSpace($token)) { $token = $token.Trim() }
    else {
        $gh = Get-Command gh -ErrorAction SilentlyContinue
        if ($null -eq $gh) { Stop-ReleaseValidation 'GitHub auth unavailable; set GH_TOKEN or GITHUB_TOKEN, or authenticate with gh.' }
        $info = [System.Diagnostics.ProcessStartInfo]::new()
        $info.FileName = $gh.Source
        $info.Arguments = 'auth token --hostname github.com'
        $info.UseShellExecute = $false
        $info.CreateNoWindow = $true
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
        $info.EnvironmentVariables['GH_PROMPT_DISABLED'] = '1'
        $process = [System.Diagnostics.Process]::new()
        $process.StartInfo = $info
        try {
            if (-not $process.Start()) { Stop-ReleaseValidation 'Could not read existing GitHub auth from gh.' }
            $outTask = $process.StandardOutput.ReadToEndAsync()
            $errTask = $process.StandardError.ReadToEndAsync()
            $process.WaitForExit()
            $token = $outTask.GetAwaiter().GetResult().Trim()
            [void]$errTask.GetAwaiter().GetResult()
            if ($process.ExitCode -ne 0) { Stop-ReleaseValidation 'Could not read existing GitHub auth from gh.' }
        } catch { Stop-ReleaseValidation 'Could not read existing GitHub auth from gh.' }
        finally { $process.Dispose() }
    }
    if ([string]::IsNullOrWhiteSpace($token) -or $token -match '\s') { Stop-ReleaseValidation 'GitHub auth token is empty or malformed.' }
    return $token
}

function New-GitHubApiClient {
    param([string]$Token)
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.AllowAutoRedirect = $false
    $client = [System.Net.Http.HttpClient]::new($handler, $true)
    $client.Timeout = [TimeSpan]::FromMinutes(3)
    $client.DefaultRequestHeaders.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Token)
    [void]$client.DefaultRequestHeaders.Accept.Add([System.Net.Http.Headers.MediaTypeWithQualityHeaderValue]::new('application/vnd.github+json'))
    [void]$client.DefaultRequestHeaders.Add('X-GitHub-Api-Version', '2022-11-28')
    [void]$client.DefaultRequestHeaders.Add('User-Agent', 'xpotato-site-release-consumer')
    return $client
}

function Invoke-GitHubJson {
    param([System.Net.Http.HttpClient]$Client, [string]$Path)
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, [System.Uri]::new('https://api.github.com' + $Path))
    $response = $null
    try {
        $response = $Client.SendAsync($request).GetAwaiter().GetResult()
        if ([int]$response.StatusCode -ne 200) { Stop-ReleaseValidation "GitHub API failed with HTTP $([int]$response.StatusCode)." }
        $json = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        try { return ConvertFrom-Json -InputObject $json -ErrorAction Stop }
        catch { Stop-ReleaseValidation 'GitHub API returned invalid JSON.' }
    } catch [System.InvalidOperationException] { throw }
    catch { Stop-ReleaseValidation 'GitHub API request failed; response details were omitted.' }
    finally {
        if ($null -ne $response) { $response.Dispose() }
        $request.Dispose()
    }
}

function Get-GitHubRunContext {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('Candidate', 'Production')][string]$Mode,
        [Parameter(Mandatory = $true)][string]$RunId,
        [Parameter(Mandatory = $true)][int]$RunAttempt,
        [Parameter(Mandatory = $true)][string]$ArtifactId,
        [Parameter(Mandatory = $true)][string]$SourceSha,
        [Parameter(Mandatory = $true)][string]$ExpectedDigest,
        [Parameter(Mandatory = $true)][System.Net.Http.HttpClient]$Client
    )
    if ($RunId -cnotmatch '^[1-9][0-9]*$' -or $ArtifactId -cnotmatch '^[1-9][0-9]*$' -or $RunAttempt -lt 1) { Stop-ReleaseValidation 'Run, attempt, or artifact identity is invalid.' }
    Assert-Sha40 $SourceSha 'Source SHA'
    Assert-Digest $ExpectedDigest 'Expected archive digest'
    $run = Invoke-GitHubJson $Client ("/repos/$($script:Repo)/actions/runs/$RunId/attempts/$RunAttempt")
    Assert-HasProperties $run @('id', 'run_attempt', 'name', 'path', 'event', 'status', 'head_sha', 'head_branch', 'repository') 'Workflow run'
    Assert-HasProperties $run.repository @('id', 'full_name') 'Workflow repository'
    if ([string]$run.id -cne $RunId -or [int]$run.run_attempt -ne $RunAttempt) { Stop-ReleaseValidation 'Workflow run ID or attempt does not match the selection.' }
    if ([string]$run.repository.full_name -cne $script:Repo -or [string]$run.name -cne $script:WorkflowName -or [string]$run.path -cne $script:WorkflowPath) { Stop-ReleaseValidation 'Run repository or trusted workflow identity does not match.' }
    if ([string]$run.head_sha -cne $SourceSha) { Stop-ReleaseValidation 'Workflow source SHA does not match the caller selection.' }
    if ($Mode -ceq 'Production') {
        if ([string]$run.event -cne 'push' -or [string]$run.head_branch -cne 'main' -or [string]$run.status -cne 'completed' -or [string]$run.conclusion -cne 'success') { Stop-ReleaseValidation 'Production requires a completed successful push run on main.' }
    } else {
        if ([string]$run.status -cne 'in_progress' -and [string]$run.status -cne 'completed') { Stop-ReleaseValidation 'Candidate run is not active or completed.' }
        if ([string]$run.status -ceq 'completed' -and [string]$run.conclusion -cne 'success') { Stop-ReleaseValidation 'Completed candidate run did not succeed.' }
        if ([string]$run.event -ceq 'push') {
            if ([string]$run.head_branch -cne 'main') { Stop-ReleaseValidation 'Candidate push must be from main.' }
        } elseif ([string]$run.event -ceq 'pull_request') {
            if ($null -eq $run.pull_requests -or @($run.pull_requests).Count -eq 0) { Stop-ReleaseValidation 'Candidate PR run has no authenticated pull request identity.' }
            $matchingPr = @($run.pull_requests | Where-Object {
                $null -ne $_.head -and $null -ne $_.head.repo -and
                [string]$_.head.sha -ceq $SourceSha -and [string]$_.base.ref -ceq 'main' -and
                [string]$_.head.repo.id -ceq [string]$run.repository.id
            })
            if ($matchingPr.Count -ne 1) { Stop-ReleaseValidation 'Candidate PR must originate from this repository and target main.' }
        } else { Stop-ReleaseValidation 'Candidate event type is unsupported.' }
    }
    $jobs = Invoke-GitHubJson $Client ("/repos/$($script:Repo)/actions/runs/$RunId/attempts/$RunAttempt/jobs?per_page=100")
    Assert-HasProperties $jobs @('jobs') 'Workflow jobs response'
    $producer = @($jobs.jobs | Where-Object { [string]$_.name -ceq 'producer' })
    if ($producer.Count -ne 1 -or [string]$producer[0].status -cne 'completed' -or [string]$producer[0].conclusion -cne 'success') { Stop-ReleaseValidation 'The producer job for this run attempt has not completed successfully.' }
    $artifact = $null
    for ($page = 1; $page -le 10 -and $null -eq $artifact; $page++) {
        $listing = Invoke-GitHubJson $Client ("/repos/$($script:Repo)/actions/runs/$RunId/artifacts?per_page=100&page=$page")
        Assert-HasProperties $listing @('artifacts') 'Workflow artifact listing'
        $hits = @($listing.artifacts | Where-Object { [string]$_.id -ceq $ArtifactId })
        if ($hits.Count -gt 1) { Stop-ReleaseValidation 'Artifact ID is ambiguous in API listing.' }
        if ($hits.Count -eq 1) { $artifact = $hits[0] }
        if ($null -eq $artifact -and @($listing.artifacts).Count -lt 100) { break }
    }
    if ($null -eq $artifact) { Stop-ReleaseValidation 'Selected artifact ID is not attached to this workflow run.' }
    Assert-HasProperties $artifact @('id', 'name', 'expired', 'expires_at', 'digest', 'size_in_bytes') 'Workflow artifact'
    $expectedName = 'site-release-' + $RunId + '-' + $RunAttempt
    if ([string]$artifact.name -cne $expectedName -or [string]$artifact.expired -cne 'False') { Stop-ReleaseValidation 'Artifact name or retention state is invalid.' }
    Assert-Digest ([string]$artifact.digest) 'API archive digest'
    if ([string]$artifact.digest -cne $ExpectedDigest) { Stop-ReleaseValidation 'API archive digest does not match the caller-selected digest.' }
    if ([long]$artifact.size_in_bytes -lt 1 -or [long]$artifact.size_in_bytes -gt $script:MaxArchiveBytes) { Stop-ReleaseValidation 'Artifact archive size is outside policy limits.' }
    try { $expiry = [DateTimeOffset]::Parse([string]$artifact.expires_at).ToUniversalTime() }
    catch { Stop-ReleaseValidation 'Artifact expiry is invalid.' }
    if ($expiry -le [DateTimeOffset]::UtcNow) { Stop-ReleaseValidation 'Artifact has expired.' }
    return [pscustomobject]@{
        Mode = $Mode; RunId = $RunId; RunAttempt = $RunAttempt; ArtifactId = $ArtifactId; SourceSha = $SourceSha
        ExpectedDigest = $ExpectedDigest; Event = [string]$run.event; HeadBranch = [string]$run.head_branch
        ProductionEligible = ([string]$run.event -ceq 'push' -and [string]$run.head_branch -ceq 'main')
        Expiration = $expiry.ToString('o'); Run = $run; Artifact = $artifact
    }
}

function Get-GitHubSourceBytes {
    param([System.Net.Http.HttpClient]$Client, [string]$Path, [string]$SourceSha)
    $encodedPath = [System.Uri]::EscapeDataString($Path).Replace('%2F', '/')
    $content = Invoke-GitHubJson $Client ("/repos/$($script:Repo)/contents/${encodedPath}?ref=$SourceSha")
    Assert-HasProperties $content @('path', 'encoding', 'content') 'Source file response'
    if ([string]$content.path -cne $Path -or [string]$content.encoding -cne 'base64') { Stop-ReleaseValidation 'Source file response path or encoding is unexpected.' }
    try { return ,([Convert]::FromBase64String(([string]$content.content -replace '\s', ''))) }
    catch { Stop-ReleaseValidation 'GitHub source file content is malformed.' }
}

function Assert-ReleaseRecord {
    param($Release, [pscustomobject]$Context)
    $releaseProperties = @('schemaVersion', 'releaseContract', 'repository', 'sourceSha', 'serverAuthoritySha', 'workflowName', 'workflowPath', 'workflowRunId', 'workflowRunAttempt', 'gitRef', 'event', 'producerOs', 'nodeVersion', 'npmVersion', 'wranglerVersion', 'wranglerConfigPath', 'productionEligible', 'validation')
    Assert-ExactProperties $Release $releaseProperties 'release.json'
    if ([int]$Release.schemaVersion -ne 1 -or [string]$Release.releaseContract -cne $script:ReleaseContract) { Stop-ReleaseValidation 'Release contract version is unsupported.' }
    if ([string]$Release.repository -cne $script:Repo -or [string]$Release.sourceSha -cne $Context.SourceSha) { Stop-ReleaseValidation 'Release repository or source SHA does not match API identity.' }
    if ([string]$Release.serverAuthoritySha -cne $script:AcceptedServerSha) { Stop-ReleaseValidation 'Release Server authority SHA does not match the accepted binding.' }
    if ([string]$Release.workflowName -cne $script:WorkflowName -or [string]$Release.workflowPath -cne $script:WorkflowPath) { Stop-ReleaseValidation 'Release workflow identity is unsupported.' }
    if ([string]$Release.workflowRunId -cne $Context.RunId -or [int]$Release.workflowRunAttempt -ne $Context.RunAttempt) { Stop-ReleaseValidation 'Release run identity does not match API identity.' }
    if ([string]$Release.event -cne $Context.Event) { Stop-ReleaseValidation 'Release event does not match API identity.' }
    if ($Context.Event -ceq 'push') {
        if ([string]$Release.gitRef -cne ('refs/heads/' + $Context.HeadBranch)) { Stop-ReleaseValidation 'Release git ref does not match API branch.' }
    } elseif ([string]$Release.event -ceq 'pull_request') {
        if ([string]$Release.gitRef -notmatch '^refs/pull/[1-9][0-9]*/merge$') { Stop-ReleaseValidation 'Release PR git ref is invalid.' }
    } else { Stop-ReleaseValidation 'Release event is unsupported.' }
    if ([string]$Release.producerOs -cne 'Linux' -or [string]$Release.wranglerConfigPath -cne $script:ConfigPath) { Stop-ReleaseValidation 'Producer platform or config path is invalid.' }
    foreach ($versionField in @('nodeVersion', 'npmVersion', 'wranglerVersion')) {
        if ([string]$Release.$versionField -cnotmatch '^[0-9]+\.[0-9]+\.[0-9]+$') { Stop-ReleaseValidation "Release $versionField is invalid." }
    }
    Assert-ExactProperties $Release.validation @('source', 'final', 'reference') 'Release validation record'
    if ([string]$Release.validation.source -cne 'PASS' -or [string]$Release.validation.final -cne 'PASS') { Stop-ReleaseValidation 'Release source or final validation did not pass.' }
    $reference = 'https://github.com/' + $script:Repo + '/actions/runs/' + $Context.RunId + '/attempts/' + $Context.RunAttempt
    if ([string]$Release.validation.reference -cne $reference) { Stop-ReleaseValidation 'Release validation reference does not identify the selected run attempt.' }
    if ($Release.productionEligible -isnot [bool] -or [bool]$Release.productionEligible -ne [bool]$Context.ProductionEligible) { Stop-ReleaseValidation 'Release production eligibility does not match authenticated run metadata.' }
    if ($Context.Mode -ceq 'Production' -and [bool]$Release.productionEligible -ne $true) { Stop-ReleaseValidation 'Selected release is not production eligible.' }
    return $Release
}

function Get-SourcePolicy {
    param([System.Net.Http.HttpClient]$Client, [string]$SourceSha, [string]$ExpectedWranglerVersion)
    $configBytes = Get-GitHubSourceBytes $Client $script:ConfigPath $SourceSha
    $configText = ConvertFrom-StrictUtf8 $configBytes 'Source Wrangler config'
    try { $config = ConvertFrom-Json -InputObject $configText -ErrorAction Stop }
    catch { Stop-ReleaseValidation 'Source Wrangler config is not valid JSON.' }
    Assert-ExactProperties $config @('name', 'compatibility_date', 'workers_dev', 'preview_urls', 'assets') 'Wrangler config'
    Assert-ExactProperties $config.assets @('directory', 'not_found_handling') 'Wrangler assets config'
    if ([string]$config.name -cne 'xpotato-site' -or [string]$config.compatibility_date -cnotmatch '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' -or
        $config.workers_dev -isnot [bool] -or $config.workers_dev -ne $false -or $config.preview_urls -isnot [bool] -or $config.preview_urls -ne $false -or
        [string]$config.assets.directory -cne './dist' -or [string]$config.assets.not_found_handling -cne '404-page') {
        Stop-ReleaseValidation 'Wrangler config violates the exact static-site deployment boundary.'
    }
    $lockBytes = Get-GitHubSourceBytes $Client 'package-lock.json' $SourceSha
    $lockText = ConvertFrom-StrictUtf8 $lockBytes 'Source package lock'
    try {
        $serializer = [System.Web.Script.Serialization.JavaScriptSerializer]::new()
        $serializer.MaxJsonLength = 20971520
        $serializer.RecursionLimit = 100
        $lock = $serializer.DeserializeObject($lockText)
    } catch { Stop-ReleaseValidation 'Source package lock is not valid JSON.' }
    if ($lock -isnot [System.Collections.IDictionary] -or $lock['packages'] -isnot [System.Collections.IDictionary] -or $lock['packages']['node_modules/wrangler'] -isnot [System.Collections.IDictionary]) { Stop-ReleaseValidation 'Source lock does not pin Wrangler.' }
    $pinnedVersion = [string]$lock['packages']['node_modules/wrangler']['version']
    if ($pinnedVersion -cne $ExpectedWranglerVersion) { Stop-ReleaseValidation 'Release Wrangler version differs from the source lock pin.' }
    return [pscustomobject]@{ ConfigBytes = $configBytes; Config = $config; WranglerVersion = $pinnedVersion }
}

function Test-SafeZipName {
    param([string]$Name, [bool]$IsDirectory)
    if ([string]::IsNullOrEmpty($Name) -or $Name.Contains('\') -or $Name.StartsWith('/') -or $Name -match '[\x00-\x1f]') { Stop-ReleaseValidation 'Archive contains an unsafe path.' }
    if ($IsDirectory) { $Name = $Name.Substring(0, $Name.Length - 1) }
    if ([string]::IsNullOrEmpty($Name) -or $Name -match '^[A-Za-z]:' -or $Name.Contains(':')) { Stop-ReleaseValidation 'Archive contains an absolute or alternate-stream path.' }
    $segments = $Name.Split('/')
    foreach ($segment in $segments) {
        if ([string]::IsNullOrEmpty($segment) -or $segment -ceq '.' -or $segment -ceq '..' -or $segment.EndsWith('.') -or $segment.EndsWith(' ') -or $segment -match '[<>"|?*]') { Stop-ReleaseValidation 'Archive path contains an unsafe component.' }
        $deviceBase = $segment.Split('.')[0]
        if ($deviceBase -match '^(?i:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$') { Stop-ReleaseValidation 'Archive path contains a reserved Windows device name.' }
    }
    return ,$segments
}

function Assert-ReleaseArchivePath {
    param([string[]]$Segments, [bool]$IsDirectory)
    $path = [string]::Join('/', $Segments)
    if ($IsDirectory) {
        if ($path -ceq 'apps' -or $path -ceq 'apps/site' -or $path -ceq 'apps/site/dist' -or $path.StartsWith('apps/site/dist/')) { return }
        Stop-ReleaseValidation 'Archive contains an unexpected directory.'
    }
    if ($path -ceq 'release.json' -or $path -ceq $script:ConfigPath) { return }
    if (-not $path.StartsWith('apps/site/dist/', [System.StringComparison]::Ordinal)) { Stop-ReleaseValidation 'Archive contains a file outside the release layout.' }
    $relative = $path.Substring('apps/site/dist/'.Length)
    $parts = $relative.Split('/')
    foreach ($part in $parts) {
        if ($part.StartsWith('.') -and $part -cne '.well-known') { Stop-ReleaseValidation 'Archive contains a disallowed hidden asset path.' }
        if ($part -match '^(?i:_worker\.js|_routes\.json|\.assetsignore)$' -or $part -match '^(?i:src|source|private|raw|node_modules|\.git)$') { Stop-ReleaseValidation 'Archive contains a disallowed executable, private, or source path.' }
    }
    $leaf = $parts[$parts.Length - 1]
    if ($leaf -ceq '_headers' -or $leaf -ceq '_redirects') { return }
    $extension = [System.IO.Path]::GetExtension($leaf).ToLowerInvariant()
    if ($extension -ceq '.map' -or -not ($script:AllowedExtensions -ccontains $extension)) { Stop-ReleaseValidation 'Archive contains an unsupported static file class.' }
}

function Get-ValidatedZipEntries {
    param([System.IO.Compression.ZipArchive]$Archive)
    if ($Archive.Entries.Count -lt 1 -or $Archive.Entries.Count -gt $script:MaxEntries) { Stop-ReleaseValidation 'Archive entry count is outside policy limits.' }
    $explicit = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $nodes = [System.Collections.Generic.Dictionary[string,string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $result = [System.Collections.Generic.List[object]]::new()
    $expanded = [long]0
    foreach ($entry in $Archive.Entries) {
        $isDirectory = $entry.FullName.EndsWith('/')
        $segments = Test-SafeZipName ([string]$entry.FullName) $isDirectory
        $canonical = [string]::Join('/', $segments)
        if (-not $explicit.Add($canonical)) { Stop-ReleaseValidation 'Archive contains duplicate or case-colliding entries.' }
        $attributes = [int]$entry.ExternalAttributes
        $unixType = ($attributes -shr 16) -band 0xF000
        if (($attributes -band 0x400) -ne 0 -or ($unixType -ne 0 -and $unixType -ne 0x8000 -and $unixType -ne 0x4000) -or
            ($isDirectory -and $unixType -eq 0x8000) -or (-not $isDirectory -and $unixType -eq 0x4000)) { Stop-ReleaseValidation 'Archive contains a link, reparse point, or special file.' }
        Assert-ReleaseArchivePath $segments $isDirectory
        for ($i = 1; $i -le $segments.Length; $i++) {
            $prefix = [string]::Join('/', $segments[0..($i - 1)])
            $isLeaf = $i -eq $segments.Length
            $kind = if ($isLeaf -and -not $isDirectory) { 'file' } else { 'directory' }
            if ($nodes.ContainsKey($prefix)) {
                if ($nodes[$prefix] -cne $kind) { Stop-ReleaseValidation 'Archive has a file/directory path conflict.' }
            } else { $nodes.Add($prefix, $kind) }
        }
        if (-not $isDirectory) {
            if ($entry.Length -lt 0 -or $entry.Length -gt $script:MaxFileBytes) { Stop-ReleaseValidation 'Archive member exceeds the file size limit.' }
            $expanded += [long]$entry.Length
            if ($expanded -gt $script:MaxExpandedBytes) { Stop-ReleaseValidation 'Archive exceeds the total expansion limit.' }
            $result.Add([pscustomobject]@{ Entry = $entry; Path = $canonical; Length = [long]$entry.Length })
        }
    }
    if (-not $explicit.Contains('release.json') -or -not $explicit.Contains($script:ConfigPath)) { Stop-ReleaseValidation 'Archive is missing release.json or its Wrangler config.' }
    if (-not $nodes.ContainsKey('apps/site/dist') -or $nodes['apps/site/dist'] -cne 'directory' -or -not ($result | Where-Object { $_.Path.StartsWith('apps/site/dist/') })) { Stop-ReleaseValidation 'Archive is missing the site assets directory or contains no static assets.' }
    if (-not $explicit.Contains('apps/site/dist/index.html') -or -not $explicit.Contains('apps/site/dist/_headers')) { Stop-ReleaseValidation 'Archive is missing the required index.html or generated _headers control file.' }
    return ,$result.ToArray()
}

function Expand-ReleaseArchive {
    param([string]$ArchivePath, [string]$Destination)
    Assert-NoReparsePath $ArchivePath
    Assert-NoReparsePath $Destination
    $file = [System.IO.File]::OpenRead($ArchivePath)
    $archive = $null
    try {
        $archive = [System.IO.Compression.ZipArchive]::new($file, [System.IO.Compression.ZipArchiveMode]::Read, $false)
        $validated = Get-ValidatedZipEntries $archive
        $root = [System.IO.Path]::GetFullPath($Destination).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
        foreach ($item in $validated) {
            $target = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $item.Path.Replace('/', [System.IO.Path]::DirectorySeparatorChar)))
            if (-not $target.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { Stop-ReleaseValidation 'Archive path escaped the operation directory.' }
            $parent = [System.IO.Path]::GetDirectoryName($target)
            Assert-NoReparsePath $parent
            [void][System.IO.Directory]::CreateDirectory($parent)
            Assert-NoReparsePath $parent
            $output = [System.IO.File]::Open($target, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
            $input = $null
            try {
                $input = $item.Entry.Open()
                $buffer = New-Object byte[] 65536
                $copied = [long]0
                while (($read = $input.Read($buffer, 0, $buffer.Length)) -gt 0) {
                    $copied += $read
                    if ($copied -gt $item.Length -or $copied -gt $script:MaxFileBytes) { Stop-ReleaseValidation 'Archive member expanded beyond its declared length.' }
                    $output.Write($buffer, 0, $read)
                }
                if ($copied -ne $item.Length) { Stop-ReleaseValidation 'Archive member length does not match its ZIP metadata.' }
            } finally {
                if ($null -ne $input) { $input.Dispose() }
                $output.Dispose()
            }
        }
        return ,@($validated | ForEach-Object { $_.Path } | Sort-Object -CaseSensitive)
    } catch [System.InvalidOperationException] { throw }
    catch { Stop-ReleaseValidation 'Archive could not be safely read or extracted.' }
    finally {
        if ($null -ne $archive) { $archive.Dispose() }
        $file.Dispose()
    }
}

function Get-FullyQualifiedWindowsPath {
    param([string]$Path)
    if ($Path -notmatch '^[A-Za-z]:[\\/]' -or $Path -match '[*?]' -or $Path -match '(^|[\\/])\.\.?([\\/]|$)') { Stop-ReleaseValidation 'Path must be a fully qualified local Windows path.' }
    return [System.IO.Path]::GetFullPath($Path).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
}

function Assert-FreshOperationRoot {
    param([string]$Path)
    $full = Get-FullyQualifiedWindowsPath $Path
    $volumeRoot = [System.IO.Path]::GetPathRoot($full).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    if ([string]::IsNullOrEmpty($full) -or $full -ceq $volumeRoot -or [System.IO.Directory]::Exists($full) -or [System.IO.File]::Exists($full)) { Stop-ReleaseValidation 'Operation root must be a new, non-root path.' }
    $parent = [System.IO.Path]::GetDirectoryName($full)
    if (-not [System.IO.Directory]::Exists($parent)) { Stop-ReleaseValidation 'Operation root parent must already exist.' }
    $cursor = $parent
    while (-not [string]::IsNullOrEmpty($cursor)) {
        if (([System.IO.File]::GetAttributes($cursor) -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-ReleaseValidation 'Operation root path crosses a reparse point.' }
        $next = [System.IO.Path]::GetDirectoryName($cursor)
        if ($next -ceq $cursor) { break }
        $cursor = $next
    }
    [void][System.IO.Directory]::CreateDirectory($full)
    return $full
}

function Assert-NoReparsePath {
    param([string]$Path)
    $cursor = Get-FullyQualifiedWindowsPath $Path
    while (-not [string]::IsNullOrEmpty($cursor)) {
        if (Test-Path -LiteralPath $cursor) {
            if (([System.IO.File]::GetAttributes($cursor) -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-ReleaseValidation 'A release operation path crosses a reparse point.' }
        }
        $next = [System.IO.Path]::GetDirectoryName($cursor)
        if ([string]::IsNullOrEmpty($next) -or $next -ceq $cursor) { break }
        $cursor = $next
    }
}

function Save-ArtifactZip {
    param([System.Net.Http.HttpClient]$ApiClient, [string]$ArtifactId, [string]$Destination, [long]$ExpectedSize)
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, [System.Uri]::new("https://api.github.com/repos/$($script:Repo)/actions/artifacts/$ArtifactId/zip"))
    $response = $null
    $signedClient = $null
    try {
        $response = $ApiClient.SendAsync($request).GetAwaiter().GetResult()
        if ([int]$response.StatusCode -ne 302 -or $null -eq $response.Headers.Location) { Stop-ReleaseValidation 'GitHub artifact download did not return the expected redirect.' }
        $signedUri = $response.Headers.Location
        if (-not $signedUri.IsAbsoluteUri -or $signedUri.Scheme -cne 'https' -or -not [string]::IsNullOrEmpty($signedUri.UserInfo)) { Stop-ReleaseValidation 'Artifact download redirect is not a safe HTTPS URL.' }
        $handler = [System.Net.Http.HttpClientHandler]::new()
        $handler.AllowAutoRedirect = $false
        $signedClient = [System.Net.Http.HttpClient]::new($handler, $true)
        $signedClient.Timeout = [TimeSpan]::FromMinutes(3)
        $signedClient.DefaultRequestHeaders.Add('User-Agent', 'xpotato-site-release-consumer')
        $downloadRequest = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $signedUri)
        $downloadResponse = $null
        try {
            $downloadResponse = $signedClient.SendAsync($downloadRequest, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
            if ([int]$downloadResponse.StatusCode -ne 200) { Stop-ReleaseValidation 'Artifact archive transfer failed.' }
            if ($null -ne $downloadResponse.Content.Headers.ContentLength -and [long]$downloadResponse.Content.Headers.ContentLength -ne $ExpectedSize) { Stop-ReleaseValidation 'Artifact archive transfer size does not match API metadata.' }
            $input = $downloadResponse.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
            $output = [System.IO.File]::Open($Destination, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
            try {
                $buffer = New-Object byte[] 65536
                $total = [long]0
                while (($read = $input.Read($buffer, 0, $buffer.Length)) -gt 0) {
                    $total += $read
                    if ($total -gt $script:MaxArchiveBytes -or $total -gt $ExpectedSize) { Stop-ReleaseValidation 'Artifact archive exceeds API size or policy limit.' }
                    $output.Write($buffer, 0, $read)
                }
                if ($total -ne $ExpectedSize) { Stop-ReleaseValidation 'Artifact archive transfer is incomplete.' }
            } finally { $output.Dispose(); $input.Dispose() }
        } finally {
            if ($null -ne $downloadResponse) { $downloadResponse.Dispose() }
            $downloadRequest.Dispose()
        }
    } catch [System.InvalidOperationException] { throw }
    catch { Stop-ReleaseValidation 'Artifact archive transfer failed; URL and response details were omitted.' }
    finally {
        if ($null -ne $response) { $response.Dispose() }
        if ($null -ne $signedClient) { $signedClient.Dispose() }
        $request.Dispose()
    }
}

function Read-ReleaseJson {
    param([string]$Path)
    $info = [System.IO.FileInfo]::new($Path)
    if (-not $info.Exists -or $info.Length -lt 2 -or $info.Length -gt 262144) { Stop-ReleaseValidation 'release.json is missing or exceeds its size limit.' }
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    $text = ConvertFrom-StrictUtf8 $bytes 'release.json'
    try { return ConvertFrom-Json -InputObject $text -ErrorAction Stop }
    catch { Stop-ReleaseValidation 'release.json is not valid JSON.' }
}

function Assert-PackageMatchesSource {
    param([string]$StagingRoot, [pscustomobject]$Context, [System.Net.Http.HttpClient]$Client)
    $releasePath = Join-Path $StagingRoot 'release.json'
    $release = Read-ReleaseJson $releasePath
    $release = Assert-ReleaseRecord $release $Context
    $policy = Get-SourcePolicy $Client $Context.SourceSha ([string]$release.wranglerVersion)
    if ([string]$release.wranglerVersion -cne $policy.WranglerVersion) { Stop-ReleaseValidation 'Release Wrangler version does not match the source lock.' }
    $artifactConfig = [System.IO.File]::ReadAllBytes((Join-Path $StagingRoot $script:ConfigPath))
    if (-not (Test-ByteArraysEqual $artifactConfig $policy.ConfigBytes)) { Stop-ReleaseValidation 'Packaged Wrangler config bytes differ from source at the selected SHA.' }
    return [pscustomobject]@{ Release = $release; Policy = $policy }
}

function Write-ReleaseIdentity {
    param([string]$OperationRoot, [pscustomobject]$Context, [string]$ArchiveDigest, $Release)
    $identity = [ordered]@{
        identityContract = $script:IdentityContract
        mode = $Context.Mode
        repository = $script:Repo
        sourceSha = $Context.SourceSha
        workflowPath = $script:WorkflowPath
        runId = $Context.RunId
        runAttempt = $Context.RunAttempt
        artifactId = $Context.ArtifactId
        archiveDigest = $ArchiveDigest
        expiresAt = $Context.Expiration
        event = $Context.Event
        productionEligible = [bool]$Context.ProductionEligible
        releaseContract = $Release.releaseContract
        writtenAt = [DateTimeOffset]::UtcNow.ToString('o')
    }
    $json = ConvertTo-Json -InputObject $identity -Depth 5
    [System.IO.File]::WriteAllText((Join-Path $OperationRoot 'identity.json'), $json, [System.Text.UTF8Encoding]::new($false))
}

function Get-ReleaseArtifact {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][ValidateSet('Candidate', 'Production')][string]$Mode,
        [Parameter(Mandatory = $true)][string]$RunId,
        [Parameter(Mandatory = $true)][int]$RunAttempt,
        [Parameter(Mandatory = $true)][string]$ArtifactId,
        [Parameter(Mandatory = $true)][string]$SourceSha,
        [Parameter(Mandatory = $true)][string]$ExpectedDigest,
        [Parameter(Mandatory = $true)][string]$OperationRoot
    )
    $root = Assert-FreshOperationRoot $OperationRoot
    Assert-NoReparsePath $root
    $token = Get-GitHubToken
    $client = New-GitHubApiClient $token
    try {
        $context = Get-GitHubRunContext $Mode $RunId $RunAttempt $ArtifactId $SourceSha $ExpectedDigest $client
        $archivePath = Join-Path $root 'archive.zip'
        Save-ArtifactZip $client $ArtifactId $archivePath ([long]$context.Artifact.size_in_bytes)
        Assert-NoReparsePath $archivePath
        if (('sha256:' + (Get-FileSha256 $archivePath)) -cne $ExpectedDigest) { Stop-ReleaseValidation 'Downloaded raw archive SHA-256 does not match the API and caller digest.' }
        $staging = Join-Path $root 'staging'
        if ([System.IO.Directory]::Exists($staging) -or [System.IO.File]::Exists($staging)) { Stop-ReleaseValidation 'Staging path is not fresh.' }
        Assert-NoReparsePath $staging
        [void][System.IO.Directory]::CreateDirectory($staging)
        Assert-NoReparsePath $staging
        [void](Expand-ReleaseArchive $archivePath $staging)
        $package = Assert-PackageMatchesSource $staging $context $client
        Write-ReleaseIdentity $root $context $ExpectedDigest $package.Release
        return [pscustomobject]@{ OperationRoot = $root; ArchivePath = $archivePath; StagingRoot = $staging; ConfigPath = (Join-Path $staging $script:ConfigPath); AssetsPath = (Join-Path $staging 'apps/site/dist'); IdentityPath = (Join-Path $root 'identity.json'); Mode = $Mode; ProductionEligible = [bool]$context.ProductionEligible }
    } finally { $client.Dispose(); $token = $null }
}

function Assert-ReleaseIdentity {
    param($Identity, [pscustomobject]$Context)
    Assert-ExactProperties $Identity @('identityContract', 'mode', 'repository', 'sourceSha', 'workflowPath', 'runId', 'runAttempt', 'artifactId', 'archiveDigest', 'expiresAt', 'event', 'productionEligible', 'releaseContract', 'writtenAt') 'Local release identity'
    if ([string]$Identity.identityContract -cne $script:IdentityContract -or [string]$Identity.mode -cne 'Production') { Stop-ReleaseValidation 'Only a production-acquired identity can pass production handoff.' }
    if ([string]$Identity.repository -cne $script:Repo -or [string]$Identity.workflowPath -cne $script:WorkflowPath -or [string]$Identity.releaseContract -cne $script:ReleaseContract) { Stop-ReleaseValidation 'Local identity contract is invalid.' }
    if ([string]$Identity.sourceSha -cne $Context.SourceSha -or [string]$Identity.runId -cne $Context.RunId -or [int]$Identity.runAttempt -ne $Context.RunAttempt -or [string]$Identity.artifactId -cne $Context.ArtifactId) { Stop-ReleaseValidation 'Local identity does not match authenticated selection.' }
    if ([string]$Identity.event -cne $Context.Event -or $Identity.productionEligible -isnot [bool] -or $Identity.productionEligible -ne $true -or $Context.ProductionEligible -ne $true) { Stop-ReleaseValidation 'Local identity is not production eligible.' }
    Assert-Digest ([string]$Identity.archiveDigest) 'Local archive digest'
    if ([string]$Identity.archiveDigest -cne $Context.ExpectedDigest) { Stop-ReleaseValidation 'Local identity digest does not match caller selection.' }
    try { $recordExpiry = [DateTimeOffset]::Parse([string]$Identity.expiresAt).ToUniversalTime() }
    catch { Stop-ReleaseValidation 'Local identity expiry is invalid.' }
    if ($recordExpiry -le [DateTimeOffset]::UtcNow -or $recordExpiry -ne [DateTimeOffset]::Parse([string]$Context.Expiration).ToUniversalTime()) { Stop-ReleaseValidation 'Local identity is expired or differs from API retention.' }
}

function Assert-StagingMatchesArchive {
    param([string]$ArchivePath, [string]$StagingRoot, [string]$ExpectedDigest)
    $stream = [System.IO.File]::Open($ArchivePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
    $archive = $null
    $archiveHasher = [System.Security.Cryptography.SHA256]::Create()
    $heldFiles = [System.Collections.Generic.List[System.IO.FileStream]]::new()
    try {
        $observedDigest = 'sha256:' + [System.BitConverter]::ToString($archiveHasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
        if ($observedDigest -cne $ExpectedDigest) { Stop-ReleaseValidation 'Raw archive digest changed after authenticated metadata validation.' }
        $stream.Position = 0
        $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Read, $true)
        $entries = Get-ValidatedZipEntries $archive
        $expected = [System.Collections.Generic.Dictionary[string,object]]::new([System.StringComparer]::Ordinal)
        foreach ($entry in $entries) { $expected.Add([string]$entry.Path, $entry) }
        $actual = [System.Collections.Generic.Dictionary[string,object]]::new([System.StringComparer]::Ordinal)
        $root = [System.IO.Path]::GetFullPath($StagingRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
        Assert-NoReparsePath $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
        $pending = [System.Collections.Generic.Stack[string]]::new()
        $pending.Push($root.TrimEnd([System.IO.Path]::DirectorySeparatorChar))
        while ($pending.Count -gt 0) {
            $directory = $pending.Pop()
            Assert-NoReparsePath $directory
            foreach ($child in [System.IO.Directory]::EnumerateFileSystemEntries($directory)) {
                $attributes = [System.IO.File]::GetAttributes($child)
                if (($attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-ReleaseValidation 'Staging contains a reparse point.' }
                if (($attributes -band [System.IO.FileAttributes]::Directory) -ne 0) {
                    $pending.Push($child)
                } else {
                    $full = [System.IO.Path]::GetFullPath($child)
                    if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { Stop-ReleaseValidation 'Staging file escaped its root.' }
                    $relative = $full.Substring($root.Length).Replace([System.IO.Path]::DirectorySeparatorChar, '/')
                    if ($actual.ContainsKey($relative)) { Stop-ReleaseValidation 'Staging contains duplicate case-sensitive paths.' }
                    $held = [System.IO.File]::Open($child, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
                    $heldFiles.Add($held)
                    $actual.Add($relative, [pscustomobject]@{ Path = $child; Stream = $held })
                }
            }
        }
        if ($actual.Count -ne $expected.Count) { Stop-ReleaseValidation 'Staging file path set differs from the immutable archive.' }
        foreach ($relative in $expected.Keys) {
            if (-not $actual.ContainsKey($relative)) { Stop-ReleaseValidation 'Staging file path set differs from the immutable archive.' }
            $zipEntry = $expected[$relative]
            $zipStream = $zipEntry.Entry.Open()
            $hash = [System.Security.Cryptography.SHA256]::Create()
            try {
                $archiveHash = [System.BitConverter]::ToString($hash.ComputeHash($zipStream)).Replace('-', '').ToLowerInvariant()
                $stagedStream = $actual[$relative].Stream
                $stagedStream.Position = 0
                $stagedHash = [System.BitConverter]::ToString($hash.ComputeHash($stagedStream)).Replace('-', '').ToLowerInvariant()
                if ($archiveHash -cne $stagedHash -or [long]$stagedStream.Length -ne [long]$zipEntry.Length) { Stop-ReleaseValidation "Staging bytes changed for '$relative'." }
            } finally {
                $hash.Dispose()
                $zipStream.Dispose()
            }
        }
    } catch [System.InvalidOperationException] { throw }
    catch { Stop-ReleaseValidation 'Staging/archive comparison failed.' }
    finally {
        foreach ($held in $heldFiles) { $held.Dispose() }
        if ($null -ne $archive) { $archive.Dispose() }
        $archiveHasher.Dispose()
        $stream.Dispose()
    }
}

function Test-SiteArtifactHandoff {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$OperationRoot,
        [Parameter(Mandatory = $true)][string]$ExpectedDigest,
        [Parameter(Mandatory = $true)][string]$SourceSha,
        [Parameter(Mandatory = $true)][string]$RunId,
        [Parameter(Mandatory = $true)][int]$RunAttempt,
        [Parameter(Mandatory = $true)][string]$ArtifactId
    )
    Assert-Sha40 $SourceSha 'Source SHA'
    Assert-Digest $ExpectedDigest 'Expected archive digest'
    if ($RunId -cnotmatch '^[1-9][0-9]*$' -or $ArtifactId -cnotmatch '^[1-9][0-9]*$' -or $RunAttempt -lt 1) { Stop-ReleaseValidation 'Caller-selected run or artifact identity is invalid.' }
    $root = Get-FullyQualifiedWindowsPath $OperationRoot
    if (-not [System.IO.Directory]::Exists($root) -or ([System.IO.File]::GetAttributes($root) -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-ReleaseValidation 'Selected operation root is missing or unsafe.' }
    Assert-NoReparsePath $root
    $archivePath = Join-Path $root 'archive.zip'
    $staging = Join-Path $root 'staging'
    $identityPath = Join-Path $root 'identity.json'
    foreach ($path in @($archivePath, $identityPath)) {
        if (-not [System.IO.File]::Exists($path) -or ([System.IO.File]::GetAttributes($path) -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-ReleaseValidation 'Selected release evidence is missing or unsafe.' }
    }
    if (-not [System.IO.Directory]::Exists($staging) -or ([System.IO.File]::GetAttributes($staging) -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { Stop-ReleaseValidation 'Selected staging directory is missing or unsafe.' }
    $identityInfo = [System.IO.FileInfo]::new($identityPath)
    if ($identityInfo.Length -lt 2 -or $identityInfo.Length -gt 32768) { Stop-ReleaseValidation 'Local release identity has an invalid size.' }
    $identityText = ConvertFrom-StrictUtf8 ([System.IO.File]::ReadAllBytes($identityPath)) 'Local release identity'
    try { $identity = ConvertFrom-Json -InputObject $identityText -ErrorAction Stop }
    catch { Stop-ReleaseValidation 'Local release identity is malformed.' }
    if ($identity -isnot [pscustomobject] -or [string]$identity.mode -cne 'Production') { Stop-ReleaseValidation 'Candidate identities cannot pass production handoff.' }
    if ([string]$identity.runId -cne $RunId -or [int]$identity.runAttempt -ne $RunAttempt -or [string]$identity.artifactId -cne $ArtifactId -or [string]$identity.sourceSha -cne $SourceSha -or [string]$identity.archiveDigest -cne $ExpectedDigest) { Stop-ReleaseValidation 'Local identity differs from caller-selected artifact identity.' }
    $token = Get-GitHubToken
    $client = New-GitHubApiClient $token
    try {
        $context = Get-GitHubRunContext 'Production' $RunId $RunAttempt $ArtifactId $SourceSha $ExpectedDigest $client
        Assert-ReleaseIdentity $identity $context
        $package = Assert-PackageMatchesSource $staging $context $client
        Assert-StagingMatchesArchive $archivePath $staging $ExpectedDigest
        return [pscustomobject]@{
            ArtifactHandoffVerified = $true
            OperationRoot = $root
            ArchivePath = $archivePath
            StagingRoot = $staging
            ConfigPath = (Join-Path $staging $script:ConfigPath)
            AssetsPath = (Join-Path $staging 'apps/site/dist')
            IdentityPath = $identityPath
            SourceSha = $SourceSha
            ArtifactId = $context.ArtifactId
            ArchiveDigest = $ExpectedDigest
            ExpiresAt = $context.Expiration
            WranglerVersion = [string]$package.Release.wranglerVersion
            DeployExecuted = $false
        }
    } finally { $client.Dispose(); $token = $null }
}

Export-ModuleMember -Function Assert-HasProperties, Assert-ExactProperties, Assert-Sha40, Assert-Digest, ConvertFrom-StrictUtf8, Get-BytesSha256, Get-FileSha256, Test-ByteArraysEqual, Get-GitHubToken, New-GitHubApiClient, Invoke-GitHubJson, Get-GitHubRunContext, Get-GitHubSourceBytes, Get-SourcePolicy, Get-ValidatedZipEntries, Expand-ReleaseArchive, Get-ReleaseArtifact, Test-SiteArtifactHandoff, Stop-ReleaseValidation

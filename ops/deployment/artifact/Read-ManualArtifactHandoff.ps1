#Requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$OperationRoot,
  [Parameter(Mandatory=$true)][string]$ArtifactId,
  [Parameter(Mandatory=$true)][string]$RunId,
  [Parameter(Mandatory=$true)][int]$RunAttempt,
  [Parameter(Mandatory=$true)][string]$ExpectedDigest,
  [Parameter(Mandatory=$true)][string]$SourceSha
)
$ErrorActionPreference='Stop'
$handoff = & (Join-Path $PSScriptRoot 'Test-SiteArtifactHandoff.ps1') @PSBoundParameters
if ($handoff.ArtifactHandoffVerified -ne $true -or $handoff.DeployExecuted -ne $false) { throw 'Canonical handoff required' }
[ordered]@{ mode='Production'; sourceSha=$handoff.SourceSha; artifactId=$handoff.ArtifactId; digest=$handoff.ArchiveDigest } | ConvertTo-Json -Compress

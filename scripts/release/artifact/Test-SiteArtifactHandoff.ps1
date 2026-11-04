#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$OperationRoot,
    [Parameter(Mandatory = $true)][string]$ArtifactId,
    [Parameter(Mandatory = $true)][string]$RunId,
    [Parameter(Mandatory = $true)][int]$RunAttempt,
    [Parameter(Mandatory = $true)][string]$ExpectedDigest,
    [Parameter(Mandatory = $true)][string]$SourceSha
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'ReleaseConsumer.psm1') -Force
ReleaseConsumer\Test-SiteArtifactHandoff @PSBoundParameters

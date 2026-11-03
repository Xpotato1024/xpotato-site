#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][ValidateSet('Candidate', 'Production')][string]$Mode,
    [Parameter(Mandatory = $true)][string]$ArtifactId,
    [Parameter(Mandatory = $true)][string]$ExpectedDigest,
    [Parameter(Mandatory = $true)][string]$SourceSha,
    [Parameter(Mandatory = $true)][string]$RunId,
    [Parameter(Mandatory = $true)][int]$RunAttempt,
    [Parameter(Mandatory = $true)][string]$OperationRoot
)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'ReleaseConsumer.psm1') -Force
ReleaseConsumer\Get-ReleaseArtifact @PSBoundParameters

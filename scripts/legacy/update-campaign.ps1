[CmdletBinding()]
param(
    [string]$RepoUrl,
    [string]$CorePath,
    [string]$Ref,
    [switch]$LatestTag,
    [switch]$DryRun,
    [switch]$Force,
    [switch]$SkipActualize
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$updateCoreScript = Join-Path $repoRoot "scripts/update-core.ps1"
$actualizeScript = Join-Path $repoRoot "scripts/actualize-campaign.ps1"

if (-not (Test-Path -LiteralPath $updateCoreScript -PathType Leaf)) {
    throw "Missing script: $updateCoreScript"
}
if (-not (Test-Path -LiteralPath $actualizeScript -PathType Leaf)) {
    throw "Missing script: $actualizeScript"
}

$coreArgs = @("-ExecutionPolicy", "Bypass", "-File", $updateCoreScript)
if (-not [string]::IsNullOrWhiteSpace($RepoUrl)) { $coreArgs += @("-RepoUrl", $RepoUrl) }
if (-not [string]::IsNullOrWhiteSpace($CorePath)) { $coreArgs += @("-CorePath", $CorePath) }
if (-not [string]::IsNullOrWhiteSpace($Ref)) { $coreArgs += @("-Ref", $Ref) }
if ($LatestTag) { $coreArgs += "-LatestTag" }
if ($DryRun) { $coreArgs += "-DryRun" }
if ($Force) { $coreArgs += "-Force" }

Write-Host "Phase 1/2: Update Core"
& powershell @coreArgs
$updateExit = $LASTEXITCODE
if ($updateExit -ne 0) {
    exit $updateExit
}

if ($DryRun) {
    Write-Host ""
    Write-Host "Dry run completed. Actualization was skipped."
    exit 0
}

if ($SkipActualize) {
    Write-Host ""
    Write-Host "Core updated. Actualization skipped by request."
    exit 0
}

Write-Host ""
Write-Host "Phase 2/2: Actualize Campaign"
& powershell -ExecutionPolicy Bypass -File $actualizeScript
$actualizeExit = $LASTEXITCODE
exit $actualizeExit

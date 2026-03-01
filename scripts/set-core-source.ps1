[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$RepoUrl,
    [string]$DefaultRef = "main",
    [switch]$UseLatestTag
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Get-Location).Path
$frameworkDir = Join-Path $repoRoot ".framework"
$configPath = Join-Path $frameworkDir "core-source.json"

if (-not (Test-Path -LiteralPath $frameworkDir)) {
    New-Item -ItemType Directory -Path $frameworkDir -Force | Out-Null
}

$config = [ordered]@{
    repo_url = $RepoUrl
    default_ref = $DefaultRef
    use_latest_tag = [bool]$UseLatestTag
    updated_at_utc = [DateTime]::UtcNow.ToString("o")
}

$config | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $configPath -Encoding UTF8

Write-Host "Core source configuration saved:"
Write-Host "  File: $configPath"
Write-Host "  Repo: $RepoUrl"
Write-Host "  Default ref: $DefaultRef"
Write-Host "  Use latest tag: $([bool]$UseLatestTag)"
exit 0

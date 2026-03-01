[CmdletBinding()]
param(
    [string]$RepoUrl = "https://github.com/NekoVika/Gurps-Assistant.git",
    [string]$DefaultRef = "main",
    [switch]$UseLatestTag
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Dir {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Resolve-GlobalHome {
    param([string]$RepoRoot)
    $candidates = New-Object System.Collections.Generic.List[string]
    if (-not [string]::IsNullOrWhiteSpace($env:GURPSAI_HOME)) {
        $candidates.Add($env:GURPSAI_HOME)
    }
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $candidates.Add((Join-Path $env:USERPROFILE ".gurps-assistant"))
    }
    $candidates.Add((Join-Path $RepoRoot ".app-global"))

    foreach ($candidate in $candidates) {
        try {
            Ensure-Dir -Path $candidate
            $probe = Join-Path $candidate (".write-test-{0}-{1}" -f $PID, [Guid]::NewGuid().ToString("N"))
            Set-Content -LiteralPath $probe -Value "ok" -Encoding ASCII
            Remove-Item -LiteralPath $probe -Force
            return $candidate
        } catch {
            continue
        }
    }
    throw "Could not find a writable global home. Set GURPSAI_HOME to a writable directory."
}

$repoRoot = (Get-Location).Path
$globalHome = Resolve-GlobalHome -RepoRoot $repoRoot
$configPath = Join-Path $globalHome "core-source.json"

$config = [ordered]@{
    repo_url = $RepoUrl
    default_ref = $DefaultRef
    use_latest_tag = [bool]$UseLatestTag
    updated_at_utc = [DateTime]::UtcNow.ToString("o")
}

$config | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $configPath -Encoding UTF8

Write-Host "Core source configuration saved:"
Write-Host "  File: $configPath"
Write-Host "  Global home: $globalHome"
Write-Host "  Repo: $RepoUrl"
Write-Host "  Default ref: $DefaultRef"
Write-Host "  Use latest tag: $([bool]$UseLatestTag)"
exit 0

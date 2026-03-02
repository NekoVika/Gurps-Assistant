[CmdletBinding()]
param(
    [switch]$SkipPathUpdate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if ((Split-Path -Leaf $scriptRoot) -ieq "legacy") {
    $scriptRoot = Split-Path -Parent $scriptRoot
}
$coreRoot = Split-Path -Parent $scriptRoot
$appScript = Join-Path $scriptRoot "app.ps1"
$aiScript = Join-Path $scriptRoot "ai.ps1"
$aiAgentScript = Join-Path $scriptRoot "ai-agent.ps1"
$setCoreSourceScript = Join-Path $scriptRoot "set-core-source.ps1"

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

function Path-ContainsEntry {
    param(
        [string[]]$Entries,
        [string]$Candidate
    )
    foreach ($entry in $Entries) {
        if ([string]::Equals($entry.TrimEnd("\"), $Candidate.TrimEnd("\"), [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    return $false
}

if (-not (Test-Path -LiteralPath $appScript -PathType Leaf)) {
    throw "Missing app entry script: $appScript"
}
if (-not (Test-Path -LiteralPath $aiScript -PathType Leaf)) {
    throw "Missing AI script: $aiScript"
}
if (-not (Test-Path -LiteralPath $aiAgentScript -PathType Leaf)) {
    throw "Missing AI agent script: $aiAgentScript"
}
if (-not (Test-Path -LiteralPath $setCoreSourceScript -PathType Leaf)) {
    throw "Missing core source script: $setCoreSourceScript"
}

$globalHome = Resolve-GlobalHome -RepoRoot $coreRoot
$binDir = Join-Path $globalHome "bin"
Ensure-Dir -Path $binDir

$launcherPs1 = Join-Path $binDir "gurpsai.ps1"
$launcherCmd = Join-Path $binDir "gurpsai.cmd"
$configPath = Join-Path $globalHome "core-source.json"

$escapedCoreRoot = $coreRoot.Replace("'", "''")
$launcherPs1Body = @"
`$ErrorActionPreference = "Stop"
`$coreRoot = '$escapedCoreRoot'
`$app = Join-Path `$coreRoot 'scripts/app.ps1'
`$ai = Join-Path `$coreRoot 'scripts/ai.ps1'
if (-not (Test-Path -LiteralPath `$app -PathType Leaf)) {
    throw "Missing app script at '`$app'. Re-run install from a valid core checkout."
}
if (-not (Test-Path -LiteralPath `$ai -PathType Leaf)) {
    throw "Missing AI script at '`$ai'. Re-run install from a valid core checkout."
}
if (`$args.Count -gt 0 -and `$args[0].ToLowerInvariant() -eq 'ai') {
    `$aiArgs = @()
    if (`$args.Count -gt 1) {
        `$aiArgs = `$args[1..(`$args.Count - 1)]
    }
    & powershell -ExecutionPolicy Bypass -File `$ai @aiArgs
    exit `$LASTEXITCODE
}
& powershell -ExecutionPolicy Bypass -File `$app @args
exit `$LASTEXITCODE
"@
Set-Content -LiteralPath $launcherPs1 -Value $launcherPs1Body -Encoding UTF8

$launcherCmdBody = @"
@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gurpsai.ps1" %*
exit /b %ERRORLEVEL%
"@
Set-Content -LiteralPath $launcherCmd -Value $launcherCmdBody -Encoding ASCII

if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
    & powershell -ExecutionPolicy Bypass -File $setCoreSourceScript -UseLatestTag
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to initialize global source config."
    }
}

& powershell -ExecutionPolicy Bypass -File $aiScript providers | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Failed to initialize AI provider config."
}

& powershell -ExecutionPolicy Bypass -File $appScript init
if ($LASTEXITCODE -ne 0) {
    throw "Failed to initialize app state."
}

$pathChanged = $false
if (-not $SkipPathUpdate) {
    $userPathRaw = [Environment]::GetEnvironmentVariable("Path", "User")
    $entries = @()
    if (-not [string]::IsNullOrWhiteSpace($userPathRaw)) {
        $entries = @(
            $userPathRaw -split ";" |
            ForEach-Object { $_.Trim() } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        )
    }

    if (-not (Path-ContainsEntry -Entries $entries -Candidate $binDir)) {
        $newEntries = @($entries + $binDir)
        $newPath = ($newEntries -join ";")
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        $pathChanged = $true
    }
}

Write-Host ""
Write-Host "GURPSAI install complete."
Write-Host "  Core root: $coreRoot"
Write-Host "  Global home: $globalHome"
Write-Host "  Launcher: $launcherCmd"
if ($SkipPathUpdate) {
    Write-Host "  PATH update: skipped by -SkipPathUpdate"
} elseif ($pathChanged) {
    Write-Host "  PATH update: added $binDir (new shells only)"
} else {
    Write-Host "  PATH update: already present"
}
Write-Host ""
Write-Host "Usage:"
Write-Host "  gurpsai help"
Write-Host "  gurpsai ai help"
Write-Host "  gurpsai init"
Write-Host "  gurpsai new -Name MyCampaign"
exit 0

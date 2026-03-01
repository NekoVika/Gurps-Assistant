[CmdletBinding()]
param(
    [string]$RepoUrl,
    [string]$CorePath,
    [string]$Ref = "main",
    [switch]$DryRun,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Dir {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Invoke-Git {
    param([string]$Args, [string]$WorkingDir = $null)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "git"
    $psi.Arguments = $Args
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    if ($null -ne $WorkingDir) {
        $psi.WorkingDirectory = $WorkingDir
    }
    $p = New-Object System.Diagnostics.Process
    $p.StartInfo = $psi
    [void]$p.Start()
    $stdout = $p.StandardOutput.ReadToEnd()
    $stderr = $p.StandardError.ReadToEnd()
    $p.WaitForExit()
    if ($p.ExitCode -ne 0) {
        throw "git $Args failed:`n$stderr"
    }
    return $stdout
}

$repoRoot = (Get-Location).Path
$hasRepo = -not [string]::IsNullOrWhiteSpace($RepoUrl)
$hasCorePath = -not [string]::IsNullOrWhiteSpace($CorePath)
if (($hasRepo -and $hasCorePath) -or (-not $hasRepo -and -not $hasCorePath)) {
    throw "Provide exactly one source: either -RepoUrl or -CorePath."
}

$coreSourcePath = $null
if ($hasCorePath) {
    $coreSourcePath = (Resolve-Path -LiteralPath $CorePath).Path
    Write-Host "Using local core path: $coreSourcePath"
} else {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        throw "git is required for -RepoUrl mode, but was not found in PATH."
    }

    $cacheRoot = Join-Path $repoRoot ".framework/cache"
    Ensure-Dir -Path $cacheRoot

    $repoHash = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($RepoUrl))
    $repoHash = $repoHash.Replace("=", "").Replace("+", "-").Replace("/", "_")
    $coreCacheDir = Join-Path $cacheRoot $repoHash

    if (-not (Test-Path -LiteralPath $coreCacheDir)) {
        Write-Host "Cloning core repo..."
        Invoke-Git -Args ("clone `"{0}`" `"{1}`"" -f $RepoUrl, $coreCacheDir) | Out-Null
    } else {
        Write-Host "Refreshing core repo cache..."
        Invoke-Git -Args "fetch --all --tags --prune" -WorkingDir $coreCacheDir | Out-Null
    }

    Write-Host "Checking out ref: $Ref"
    Invoke-Git -Args ("checkout --force `"{0}`"" -f $Ref) -WorkingDir $coreCacheDir | Out-Null
    $coreSourcePath = $coreCacheDir
}

$syncScript = Join-Path $repoRoot "scripts/framework-sync.ps1"
if (-not (Test-Path -LiteralPath $syncScript -PathType Leaf)) {
    throw "Missing sync script at '$syncScript'."
}

$syncArgs = @(
    "-ExecutionPolicy", "Bypass",
    "-File", $syncScript,
    "-CorePath", $coreSourcePath
)
if ($DryRun) { $syncArgs += "-DryRun" }
if ($Force) { $syncArgs += "-Force" }

Write-Host "Running framework sync..."
& powershell @syncArgs
$syncExit = $LASTEXITCODE

if ($syncExit -ne 0) {
    exit $syncExit
}

Write-Host ""
Write-Host "Update Core finished successfully."
if ($hasRepo) {
    Write-Host "  Repo: $RepoUrl"
    Write-Host "  Ref:  $Ref"
}
Write-Host "  Source: $coreSourcePath"
exit 0

[CmdletBinding()]
param(
    [string]$RepoUrl,
    [string]$CorePath,
    [string]$Ref = "main",
    [switch]$LatestTag,
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
    param([string]$GitArgs, [string]$WorkingDir = $null)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "git"
    $psi.Arguments = $GitArgs
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
        throw "git $GitArgs failed:`n$stderr"
    }
    return $stdout
}

$repoRoot = (Get-Location).Path
$configPath = Join-Path $repoRoot ".framework/core-source.json"
$hasRepo = -not [string]::IsNullOrWhiteSpace($RepoUrl)
$hasCorePath = -not [string]::IsNullOrWhiteSpace($CorePath)

if ($hasRepo -and $hasCorePath) {
    throw "Provide exactly one source: either -RepoUrl or -CorePath."
}

# If no explicit source is provided, use saved core-source config.
if (-not $hasRepo -and -not $hasCorePath) {
    if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
        throw "No source provided and no config found at '$configPath'. Run scripts/set-core-source.ps1 first, or pass -RepoUrl/-CorePath."
    }

    $cfg = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    if (-not [string]::IsNullOrWhiteSpace($cfg.repo_url)) {
        $RepoUrl = [string]$cfg.repo_url
        $hasRepo = $true
    }

    if ($PSBoundParameters.ContainsKey("Ref") -eq $false -and -not [string]::IsNullOrWhiteSpace($cfg.default_ref)) {
        $Ref = [string]$cfg.default_ref
    }
    if ($PSBoundParameters.ContainsKey("LatestTag") -eq $false -and $cfg.use_latest_tag -eq $true) {
        $LatestTag = $true
    }

    Write-Host "Using configured core source from .framework/core-source.json"
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
        Invoke-Git -GitArgs ("clone `"{0}`" `"{1}`"" -f $RepoUrl, $coreCacheDir) | Out-Null
    } else {
        Write-Host "Refreshing core repo cache..."
        Invoke-Git -GitArgs "fetch --all --tags --prune" -WorkingDir $coreCacheDir | Out-Null
    }

    $resolvedRef = $Ref
    if ($LatestTag) {
        $tagsRaw = Invoke-Git -GitArgs "tag --sort=-v:refname" -WorkingDir $coreCacheDir
        $tags = @($tagsRaw -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        if ($tags.Count -eq 0) {
            throw "No tags found in core repository. Cannot use -LatestTag."
        }
        $resolvedRef = $tags[0].Trim()
    }

    Write-Host "Checking out ref: $resolvedRef"
    Invoke-Git -GitArgs ("checkout --force `"{0}`"" -f $resolvedRef) -WorkingDir $coreCacheDir | Out-Null
    if (-not $LatestTag) {
        try {
            Invoke-Git -GitArgs "pull --ff-only" -WorkingDir $coreCacheDir | Out-Null
        } catch {
            Write-Host "Warning: pull --ff-only skipped for ref '$resolvedRef'."
        }
    }
    $coreSourcePath = $coreCacheDir
    $Ref = $resolvedRef
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
    Write-Host "  LatestTag: $([bool]$LatestTag)"
}
Write-Host "  Source: $coreSourcePath"
exit 0

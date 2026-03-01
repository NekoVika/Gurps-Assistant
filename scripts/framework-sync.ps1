[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$CorePath,
    [switch]$DryRun,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-HashOrNull {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $null
    }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Get-RelativePathSafe {
    param(
        [string]$BasePath,
        [string]$FullPath
    )
    $baseResolved = (Resolve-Path -LiteralPath $BasePath).Path
    $fullResolved = (Resolve-Path -LiteralPath $FullPath).Path

    if (-not $baseResolved.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
        $baseResolved = $baseResolved + [System.IO.Path]::DirectorySeparatorChar
    }

    $baseUri = New-Object System.Uri($baseResolved)
    $fullUri = New-Object System.Uri($fullResolved)
    $relative = $baseUri.MakeRelativeUri($fullUri).ToString()
    $relative = [System.Uri]::UnescapeDataString($relative)
    return $relative -replace "/", [System.IO.Path]::DirectorySeparatorChar
}

function Ensure-ParentDir {
    param([string]$Path)
    $parent = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
}

function Copy-CoreFile {
    param(
        [string]$SourcePath,
        [string]$TargetPath,
        [bool]$Simulate
    )
    if ($Simulate) {
        return
    }
    Ensure-ParentDir -Path $TargetPath
    Copy-Item -LiteralPath $SourcePath -Destination $TargetPath -Force
}

function Backup-TargetFile {
    param(
        [string]$TargetPath,
        [string]$RepoRoot,
        [string]$Timestamp,
        [bool]$Simulate
    )
    if ($Simulate) {
        return
    }
    if (-not (Test-Path -LiteralPath $TargetPath -PathType Leaf)) {
        return
    }
    $rel = Get-RelativePathSafe -BasePath $RepoRoot -FullPath $TargetPath
    $backupRoot = Join-Path $RepoRoot ".framework/backups/$Timestamp"
    $backupPath = Join-Path $backupRoot $rel
    Ensure-ParentDir -Path $backupPath
    Copy-Item -LiteralPath $TargetPath -Destination $backupPath -Force
}

$repoRoot = (Get-Location).Path
$resolvedCore = (Resolve-Path -LiteralPath $CorePath).Path
$manifestPath = Join-Path $resolvedCore ".framework/framework.manifest.json"

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Manifest not found at '$manifestPath'."
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$stateDir = Join-Path $repoRoot ".framework"
$statePath = Join-Path $stateDir "install-state.json"

$state = $null
if (Test-Path -LiteralPath $statePath -PathType Leaf) {
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
} else {
    $state = [PSCustomObject]@{
        framework_name = $manifest.framework_name
        framework_version = $null
        source_core_path = $null
        installed_at_utc = $null
        files = @{}
    }
}

# Normalize state.files into a hashtable for predictable read/write behavior.
$normalizedFiles = @{}
if ($null -ne $state.files) {
    if ($state.files -is [hashtable]) {
        $normalizedFiles = $state.files
    } else {
        foreach ($p in $state.files.PSObject.Properties) {
            $normalizedFiles[$p.Name] = $p.Value
        }
    }
}
$state.files = $normalizedFiles

$allCoreFiles = New-Object System.Collections.Generic.List[string]

foreach ($root in $manifest.managed_roots) {
    $rootPath = Join-Path $resolvedCore $root
    if (-not (Test-Path -LiteralPath $rootPath)) {
        continue
    }
    Get-ChildItem -LiteralPath $rootPath -File -Recurse | ForEach-Object {
        $rel = Get-RelativePathSafe -BasePath $resolvedCore -FullPath $_.FullName
        $allCoreFiles.Add($rel)
    }
}

foreach ($file in $manifest.managed_files) {
    $filePath = Join-Path $resolvedCore $file
    if (Test-Path -LiteralPath $filePath -PathType Leaf) {
        $allCoreFiles.Add($file)
    }
}

$managedUnique = $allCoreFiles | Sort-Object -Unique

$created = 0
$updated = 0
$unchanged = 0
$skipped = 0
$conflicts = 0
$timestamp = [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss")

if ($DryRun) {
    Write-Host "Dry run mode is ON. No files will be changed."
}

foreach ($relPath in $managedUnique) {
    $coreFile = Join-Path $resolvedCore $relPath
    $targetFile = Join-Path $repoRoot $relPath

    $coreHash = Get-HashOrNull -Path $coreFile
    if ($null -eq $coreHash) {
        continue
    }

    $targetExists = Test-Path -LiteralPath $targetFile -PathType Leaf
    $targetHash = Get-HashOrNull -Path $targetFile

    $stateEntry = $null
    if ($state.files.ContainsKey($relPath)) {
        $stateEntry = $state.files[$relPath]
    }

    $lastAppliedHash = $null
    $lastCoreHash = $null
    if ($null -ne $stateEntry) {
        $lastAppliedHash = $stateEntry.last_applied_hash
        $lastCoreHash = $stateEntry.last_core_hash
    }

    $action = $null
    if (-not $targetExists) {
        $action = "create"
    } elseif ($targetHash -eq $coreHash) {
        $action = "unchanged"
    } elseif ($null -eq $stateEntry) {
        $action = if ($Force) { "force-update" } else { "conflict-no-state" }
    } elseif ($targetHash -eq $lastAppliedHash) {
        $action = "update"
    } elseif ($coreHash -eq $lastCoreHash) {
        $action = "keep-local"
    } else {
        $action = if ($Force) { "force-update" } else { "conflict-local-and-core-changed" }
    }

    switch ($action) {
        "create" {
            Write-Host "[CREATE ] $relPath"
            Copy-CoreFile -SourcePath $coreFile -TargetPath $targetFile -Simulate:$DryRun
            $created++
        }
        "update" {
            Write-Host "[UPDATE ] $relPath"
            Copy-CoreFile -SourcePath $coreFile -TargetPath $targetFile -Simulate:$DryRun
            $updated++
        }
        "force-update" {
            Write-Host "[FORCE  ] $relPath"
            Backup-TargetFile -TargetPath $targetFile -RepoRoot $repoRoot -Timestamp $timestamp -Simulate:$DryRun
            Copy-CoreFile -SourcePath $coreFile -TargetPath $targetFile -Simulate:$DryRun
            $updated++
        }
        "unchanged" {
            Write-Host "[OK     ] $relPath"
            $unchanged++
        }
        "keep-local" {
            Write-Host "[LOCAL  ] $relPath (core unchanged, local edits kept)"
            $unchanged++
        }
        "conflict-no-state" {
            Write-Host "[SKIP   ] $relPath (exists but no prior state; use -Force to overwrite)"
            $skipped++
            $conflicts++
        }
        "conflict-local-and-core-changed" {
            Write-Host "[SKIP   ] $relPath (local + core changed; use -Force to overwrite)"
            $skipped++
            $conflicts++
        }
        default {
            throw "Unknown action '$action' for '$relPath'."
        }
    }

    if ($action -in @("create", "update", "force-update", "unchanged", "keep-local")) {
        if (-not $DryRun) {
            $finalHash = Get-HashOrNull -Path $targetFile
            $state.files[$relPath] = [ordered]@{
                last_applied_hash = $finalHash
                last_core_hash = $coreHash
                updated_at_utc = [DateTime]::UtcNow.ToString("o")
            }
        }
    }
}

if (-not $DryRun) {
    if (-not (Test-Path -LiteralPath $stateDir)) {
        New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    }
    $state.framework_name = $manifest.framework_name
    $state.framework_version = $manifest.framework_version
    $state.source_core_path = $resolvedCore
    $state.installed_at_utc = [DateTime]::UtcNow.ToString("o")
    $state | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $statePath -Encoding UTF8
}

Write-Host ""
Write-Host "Framework sync summary:"
Write-Host "  Core:      $($manifest.framework_name) v$($manifest.framework_version)"
Write-Host "  Target:    $repoRoot"
Write-Host "  Created:   $created"
Write-Host "  Updated:   $updated"
Write-Host "  Unchanged: $unchanged"
Write-Host "  Skipped:   $skipped"
Write-Host "  Conflicts: $conflicts"

if ($conflicts -gt 0 -and -not $Force) {
    Write-Host ""
    Write-Host "Conflicts detected. Re-run with -Force to overwrite conflicted files."
    exit 2
}

exit 0

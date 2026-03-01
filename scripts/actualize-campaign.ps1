[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-Dir {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Add-Issue {
    param(
        [System.Collections.Generic.List[object]]$List,
        [string]$Severity,
        [string]$Code,
        [string]$Message
    )
    $List.Add([PSCustomObject]@{
        severity = $Severity
        code = $Code
        message = $Message
    }) | Out-Null
}

function Read-StateValue {
    param([string]$StateText, [string]$Label)
    $pattern = "\*\*\s*$([Regex]::Escape($Label))\s*:\s*\*\*\s*(.+)"
    $m = [Regex]::Match($StateText, $pattern)
    if ($m.Success) {
        return $m.Groups[1].Value.Trim()
    }
    return $null
}

$root = (Get-Location).Path
$issues = New-Object System.Collections.Generic.List[object]

$requiredFiles = @(
    "AGENTS.md",
    "SYSTEM.md",
    "README.md",
    "state.md",
    "master_philosophy.md",
    ".agents/workflows/INDEX.md",
    ".planning/MAP.md"
)

$requiredDirs = @(
    ".agents/agents",
    ".agents/workflows",
    ".planning/_templates",
    "01_World_Bible",
    "02_Characters",
    "03_Story"
)

foreach ($f in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $f) -PathType Leaf)) {
        Add-Issue -List $issues -Severity "ERROR" -Code "MISSING_FILE" -Message "Missing required file: $f"
    }
}

foreach ($d in $requiredDirs) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $d) -PathType Container)) {
        Add-Issue -List $issues -Severity "ERROR" -Code "MISSING_DIR" -Message "Missing required directory: $d"
    }
}

$statePath = Join-Path $root "state.md"
if (Test-Path -LiteralPath $statePath -PathType Leaf) {
    $stateText = Get-Content -LiteralPath $statePath -Raw
    $episodeValue = Read-StateValue -StateText $stateText -Label "Current Episode"
    $chapterValue = Read-StateValue -StateText $stateText -Label "Current Chapter"

    if ($null -ne $episodeValue -and $episodeValue -notmatch "(?i)\[none\]|none|n/a") {
        $episodeCode = [Regex]::Match($episodeValue, "Episode_\d+")
        if ($episodeCode.Success) {
            $episodeDir = Join-Path $root ("03_Story/{0}" -f $episodeCode.Value)
            if (-not (Test-Path -LiteralPath $episodeDir -PathType Container)) {
                Add-Issue -List $issues -Severity "ERROR" -Code "STATE_EPISODE_MISSING" -Message "state.md references $($episodeCode.Value), but folder is missing in 03_Story."
            }

            if ($null -ne $chapterValue -and $chapterValue -notmatch "(?i)\[none\]|none|n/a") {
                $chapterCode = [Regex]::Match($chapterValue, "Chapter_\d+")
                if ($chapterCode.Success) {
                    $chapterDir = Join-Path $episodeDir $chapterCode.Value
                    if (-not (Test-Path -LiteralPath $chapterDir -PathType Container)) {
                        Add-Issue -List $issues -Severity "ERROR" -Code "STATE_CHAPTER_MISSING" -Message "state.md references $($chapterCode.Value), but folder is missing under $($episodeCode.Value)."
                    } else {
                        $encDir = Join-Path $chapterDir "Encounters"
                        if (-not (Test-Path -LiteralPath $encDir -PathType Container)) {
                            Add-Issue -List $issues -Severity "WARN" -Code "ENCOUNTERS_DIR_MISSING" -Message "Chapter exists but Encounters/ is missing at 03_Story/$($episodeCode.Value)/$($chapterCode.Value)/."
                        }
                    }
                } else {
                    Add-Issue -List $issues -Severity "WARN" -Code "STATE_CHAPTER_FORMAT" -Message "Current Chapter in state.md does not match expected format (Chapter_XX)."
                }
            }
        } else {
            Add-Issue -List $issues -Severity "WARN" -Code "STATE_EPISODE_FORMAT" -Message "Current Episode in state.md does not match expected format (Episode_XX)."
        }
    }
}

$indexPath = Join-Path $root ".agents/workflows/INDEX.md"
if (Test-Path -LiteralPath $indexPath -PathType Leaf) {
    $lines = Get-Content -LiteralPath $indexPath
    foreach ($line in $lines) {
        $m = [Regex]::Match($line, "->\s*`?(.+?\.md)`?$")
        if ($m.Success) {
            $relativeWorkflowPath = $m.Groups[1].Value.Trim()
            $wfPath = Join-Path $root $relativeWorkflowPath
            if (-not (Test-Path -LiteralPath $wfPath -PathType Leaf)) {
                Add-Issue -List $issues -Severity "ERROR" -Code "WORKFLOW_INDEX_BROKEN" -Message "Workflow index points to missing file: $relativeWorkflowPath"
            }
        }
    }
}

$frameworkStatePath = Join-Path $root ".framework/install-state.json"
if (-not (Test-Path -LiteralPath $frameworkStatePath -PathType Leaf)) {
    Add-Issue -List $issues -Severity "WARN" -Code "NO_INSTALL_STATE" -Message "No .framework/install-state.json found. Run an update/sync first."
}

$reportDir = Join-Path $root ".framework/reports"
Ensure-Dir -Path $reportDir
$timestamp = [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss")
$reportPath = Join-Path $reportDir ("actualize-{0}.md" -f $timestamp)

$errorCount = @($issues | Where-Object { $_.severity -eq "ERROR" }).Count
$warnCount = @($issues | Where-Object { $_.severity -eq "WARN" }).Count
$status = if ($errorCount -gt 0) { "FAIL" } else { "PASS" }

$report = New-Object System.Collections.Generic.List[string]
$report.Add("# Campaign Actualization Report") | Out-Null
$report.Add("") | Out-Null
$report.Add("- Status: **$status**") | Out-Null
$report.Add("- Generated (UTC): $([DateTime]::UtcNow.ToString("o"))") | Out-Null
$report.Add("- Errors: $errorCount") | Out-Null
$report.Add("- Warnings: $warnCount") | Out-Null
$report.Add("") | Out-Null

if ($issues.Count -eq 0) {
    $report.Add("No issues detected.") | Out-Null
} else {
    $report.Add("## Findings") | Out-Null
    foreach ($i in $issues) {
        $report.Add("- [$($i.severity)] $($i.code): $($i.message)") | Out-Null
    }
}

$report | Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Host "Actualization status: $status"
Write-Host "Errors: $errorCount"
Write-Host "Warnings: $warnCount"
Write-Host "Report: $reportPath"

if ($errorCount -gt 0) {
    exit 2
}
exit 0

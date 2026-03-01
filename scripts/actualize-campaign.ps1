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

$requiredPersonas = @(
    "Narrator",
    "RulesLawyer",
    "WorldBuilder",
    "SessionPlanner"
)

$requiredTemplates = @(
    "Encounter_Template.md",
    "Location_Template.md",
    "NPC_Template.md",
    "Episode_Overview_Template.md",
    "Chapter_Template.md"
)

$requiredWorkflows = @(
    "new_campaign",
    "catch_up",
    "new_episode",
    "new_chapter",
    "prep_session",
    "start_session",
    "conclude_session",
    "create_npc",
    "brainstorm",
    "update_framework",
    "update_core",
    "actualize",
    "configure_core_source",
    "update_campaign"
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

$agentsRoot = Join-Path $root ".agents/agents"
foreach ($persona in $requiredPersonas) {
    $personaPath = Join-Path $agentsRoot ("{0}.md" -f $persona)
    if (-not (Test-Path -LiteralPath $personaPath -PathType Leaf)) {
        Add-Issue -List $issues -Severity "ERROR" -Code "MISSING_PERSONA" -Message "Missing required persona file: .agents/agents/$persona.md"
    }
}

$templatesRoot = Join-Path $root ".planning/_templates"
foreach ($template in $requiredTemplates) {
    $templatePath = Join-Path $templatesRoot $template
    if (-not (Test-Path -LiteralPath $templatePath -PathType Leaf)) {
        Add-Issue -List $issues -Severity "ERROR" -Code "MISSING_TEMPLATE" -Message "Missing required template: .planning/_templates/$template"
    }
}

$workflowRoot = Join-Path $root ".agents/workflows"
foreach ($workflow in $requiredWorkflows) {
    $wfPath = Join-Path $workflowRoot ("{0}.md" -f $workflow)
    if (-not (Test-Path -LiteralPath $wfPath -PathType Leaf)) {
        Add-Issue -List $issues -Severity "ERROR" -Code "MISSING_WORKFLOW" -Message "Missing required workflow file: .agents/workflows/$workflow.md"
    }
}

$agentsPath = Join-Path $root "AGENTS.md"
if (Test-Path -LiteralPath $agentsPath -PathType Leaf) {
    $agentsText = Get-Content -LiteralPath $agentsPath -Raw
    if ($agentsText -notmatch "(?is)Slash command style.*?/new_campaign") {
        Add-Issue -List $issues -Severity "ERROR" -Code "AGENTS_TRIGGER_SLASH_MISSING" -Message "AGENTS.md must document slash workflow invocation (for example /new_campaign)."
    }
    if ($agentsText -notmatch "(?is)Natural language style.*?run new_campaign workflow") {
        Add-Issue -List $issues -Severity "ERROR" -Code "AGENTS_TRIGGER_NL_MISSING" -Message "AGENTS.md must document natural-language workflow invocation (for example run new_campaign workflow)."
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
    $indexText = ($lines -join "`n")
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

    foreach ($workflow in $requiredWorkflows) {
        $expectedLink = ".agents/workflows/$workflow.md"
        if ($indexText -notmatch [Regex]::Escape($expectedLink)) {
            Add-Issue -List $issues -Severity "ERROR" -Code "WORKFLOW_INDEX_MISSING_ENTRY" -Message "Workflow index is missing mapping for: $workflow"
        }
    }
}

$frameworkStatePath = Join-Path $root ".framework/install-state.json"
if (-not (Test-Path -LiteralPath $frameworkStatePath -PathType Leaf)) {
    Add-Issue -List $issues -Severity "WARN" -Code "NO_INSTALL_STATE" -Message "No .framework/install-state.json found. Run an update/sync first."
}

$gmScriptPath = Join-Path $root "scripts/gm.ps1"
if (Test-Path -LiteralPath $gmScriptPath -PathType Leaf) {
    try {
        $workflowOutput = & powershell -ExecutionPolicy Bypass -File $gmScriptPath workflows 2>&1
        $workflowExit = $LASTEXITCODE
        if ($workflowExit -ne 0) {
            Add-Issue -List $issues -Severity "WARN" -Code "GM_WORKFLOWS_COMMAND_FAILED" -Message "scripts/gm.ps1 workflows exited with code $workflowExit"
        } elseif (($workflowOutput | Out-String) -notmatch "(?i)new_campaign") {
            Add-Issue -List $issues -Severity "WARN" -Code "GM_WORKFLOWS_OUTPUT_UNEXPECTED" -Message "scripts/gm.ps1 workflows output did not include new_campaign."
        }
    } catch {
        Add-Issue -List $issues -Severity "WARN" -Code "GM_WORKFLOWS_EXCEPTION" -Message ("Failed to run scripts/gm.ps1 workflows: {0}" -f $_.Exception.Message)
    }
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

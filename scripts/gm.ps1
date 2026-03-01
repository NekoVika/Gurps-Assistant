[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Command = "help",
    [Parameter(Position = 1)]
    [string]$Subcommand,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = (Get-Location).Path

function Run-Script {
    param([string]$ScriptName, [string[]]$ScriptArgs)
    $path = Join-Path $root ("scripts/{0}" -f $ScriptName)
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Missing script: $path"
    }
    & powershell -ExecutionPolicy Bypass -File $path @ScriptArgs
    exit $LASTEXITCODE
}

function Get-WorkflowNames {
    $workflowDir = Join-Path $root ".agents/workflows"
    if (-not (Test-Path -LiteralPath $workflowDir -PathType Container)) {
        return @()
    }

    $reserved = @("INDEX.md")
    $names = Get-ChildItem -LiteralPath $workflowDir -File -Filter *.md |
        Where-Object { $reserved -notcontains $_.Name } |
        ForEach-Object { [System.IO.Path]::GetFileNameWithoutExtension($_.Name) } |
        Sort-Object
    return @($names)
}

function Show-WorkflowHelp {
    $names = Get-WorkflowNames
    Write-Host "Workflow commands (AI-level):"
    foreach ($n in $names) {
        Write-Host ("  {0}" -f $n)
    }
    Write-Host ""
    Write-Host "Run in Codex chat with one of these:"
    Write-Host "  run <workflow_name> workflow"
    Write-Host "  /<workflow_name>"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  run create_npc workflow"
    Write-Host "  /prep_session"
}

function Print-WorkflowPrompt {
    param([string]$WorkflowName)
    if ([string]::IsNullOrWhiteSpace($WorkflowName)) {
        throw "Missing workflow name. Example: .\scripts\gm.ps1 workflow create_npc"
    }

    $path = Join-Path $root (".agents/workflows/{0}.md" -f $WorkflowName)
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Unknown workflow '$WorkflowName'. Run .\scripts\gm.ps1 workflows"
    }

    $prompt = "run $WorkflowName workflow"
    Write-Host $prompt
}

switch ($Command.ToLowerInvariant()) {
    "help" {
        Write-Host "GM command router"
        Write-Host ""
        Write-Host "Usage:"
        Write-Host "  .\scripts\gm.ps1 <command> [args]"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  help                         Show this list"
        Write-Host "  configure-source [args]      Run set-core-source.ps1"
        Write-Host "  update-core [args]           Run update-core.ps1"
        Write-Host "  update [args]                Run update-campaign.ps1"
        Write-Host "  actualize                    Run actualize-campaign.ps1"
        Write-Host "  sync [args]                  Run framework-sync.ps1"
        Write-Host "  ai [args]                    Run ai.ps1 provider commands"
        Write-Host "  workflows                    List AI workflow commands"
        Write-Host "  workflow <name>              Print prompt to run a workflow"
        Write-Host ""
        Write-Host "Examples:"
        Write-Host "  .\scripts\gm.ps1 update -DryRun"
        Write-Host "  .\scripts\gm.ps1 update"
        Write-Host "  .\scripts\gm.ps1 ai providers"
        Write-Host "  .\scripts\gm.ps1 ai configure -Provider chatgpt -ApiKeyEnv OPENAI_API_KEY -Model gpt-5 -SetDefault"
        Write-Host "  .\scripts\gm.ps1 ai chat -Prompt ""Generate three faction hooks."""
        Write-Host "  .\scripts\gm.ps1 ai agent -Task ""Refresh state.md from latest notes"" -DryRun"
        Write-Host "  .\scripts\gm.ps1 workflows"
        Write-Host "  .\scripts\gm.ps1 workflow create_npc"
        Write-Host "  .\scripts\gm.ps1 configure-source -RepoUrl ""https://github.com/NekoVika/Gurps-Assistant.git"" -DefaultRef ""main"" -UseLatestTag"
        exit 0
    }
    "configure-source" { Run-Script -ScriptName "set-core-source.ps1" -ScriptArgs $Args }
    "update-core" { Run-Script -ScriptName "update-core.ps1" -ScriptArgs $Args }
    "update" { Run-Script -ScriptName "update-campaign.ps1" -ScriptArgs $Args }
    "actualize" { Run-Script -ScriptName "actualize-campaign.ps1" -ScriptArgs $Args }
    "sync" { Run-Script -ScriptName "framework-sync.ps1" -ScriptArgs $Args }
    "ai" {
        $aiArgs = @()
        if (-not [string]::IsNullOrWhiteSpace($Subcommand)) {
            $aiArgs += $Subcommand
        }
        if ($null -ne $Args -and $Args.Count -gt 0) {
            $aiArgs += $Args
        }
        Run-Script -ScriptName "ai.ps1" -ScriptArgs $aiArgs
    }
    "workflows" { Show-WorkflowHelp; exit 0 }
    "workflow" { Print-WorkflowPrompt -WorkflowName $Subcommand; exit 0 }
    default {
        Write-Host "Unknown command: $Command"
        Write-Host "Run .\scripts\gm.ps1 help"
        exit 1
    }
}

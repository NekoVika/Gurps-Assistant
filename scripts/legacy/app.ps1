[CmdletBinding()]
param(
    [ValidateSet("help", "init", "new", "register", "load", "list", "current", "update", "actualize", "workflows", "workflow")]
    [string]$Command = "help",
    [string]$Name,
    [string]$Path,
    [string]$Ref,
    [switch]$LatestTag,
    [switch]$DryRun,
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if ((Split-Path -Leaf $scriptRoot) -ieq "legacy") {
    $scriptRoot = Split-Path -Parent $scriptRoot
}
$coreRoot = Split-Path -Parent $scriptRoot
$defaultCoreRepo = "https://github.com/NekoVika/Gurps-Assistant.git"

function Ensure-Dir {
    param([string]$DirPath)
    if (-not (Test-Path -LiteralPath $DirPath)) {
        New-Item -ItemType Directory -Path $DirPath -Force | Out-Null
    }
}

function Resolve-GlobalHome {
    $candidates = New-Object System.Collections.Generic.List[string]
    if (-not [string]::IsNullOrWhiteSpace($env:GURPSAI_HOME)) {
        $candidates.Add($env:GURPSAI_HOME)
    }
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $candidates.Add((Join-Path $env:USERPROFILE ".gurps-assistant"))
    }
    $candidates.Add((Join-Path $coreRoot ".app-global"))

    foreach ($candidate in $candidates) {
        try {
            Ensure-Dir -DirPath $candidate
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

$globalHome = Resolve-GlobalHome
$statePath = Join-Path $globalHome "state.json"

function New-DefaultState {
    return [ordered]@{
        schema_version = 1
        core_repo_url = $defaultCoreRepo
        core_path = $coreRoot
        active_campaign = $null
        campaigns = @{}
        created_at_utc = [DateTime]::UtcNow.ToString("o")
        updated_at_utc = [DateTime]::UtcNow.ToString("o")
    }
}

function Normalize-CampaignMap {
    param($CampaignsValue)
    $out = @{}
    if ($null -eq $CampaignsValue) {
        return $out
    }
    if ($CampaignsValue -is [hashtable]) {
        return $CampaignsValue
    }
    foreach ($p in $CampaignsValue.PSObject.Properties) {
        $out[$p.Name] = [string]$p.Value
    }
    return $out
}

function Load-State {
    Ensure-Dir -DirPath $globalHome
    if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) {
        $state = New-DefaultState
        $state | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $statePath -Encoding UTF8
        return $state
    }
    $loaded = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $state = [ordered]@{
        schema_version = if ($null -ne $loaded.schema_version) { [int]$loaded.schema_version } else { 1 }
        core_repo_url = if (-not [string]::IsNullOrWhiteSpace([string]$loaded.core_repo_url)) { [string]$loaded.core_repo_url } else { $defaultCoreRepo }
        core_path = if (-not [string]::IsNullOrWhiteSpace([string]$loaded.core_path)) { [string]$loaded.core_path } else { $coreRoot }
        active_campaign = if (-not [string]::IsNullOrWhiteSpace([string]$loaded.active_campaign)) { [string]$loaded.active_campaign } else { $null }
        campaigns = Normalize-CampaignMap -CampaignsValue $loaded.campaigns
        created_at_utc = if (-not [string]::IsNullOrWhiteSpace([string]$loaded.created_at_utc)) { [string]$loaded.created_at_utc } else { [DateTime]::UtcNow.ToString("o") }
        updated_at_utc = [DateTime]::UtcNow.ToString("o")
    }
    return $state
}

function Save-State {
    param([hashtable]$State)
    Ensure-Dir -DirPath $globalHome
    $State.updated_at_utc = [DateTime]::UtcNow.ToString("o")
    $State | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $statePath -Encoding UTF8
}

function Resolve-CampaignPathFromInput {
    param(
        [hashtable]$State,
        [string]$InputName,
        [string]$InputPath
    )
    if (-not [string]::IsNullOrWhiteSpace($InputPath)) {
        return (Resolve-Path -LiteralPath $InputPath).Path
    }
    if (-not [string]::IsNullOrWhiteSpace($InputName)) {
        if (-not $State.campaigns.ContainsKey($InputName)) {
            throw "Unknown campaign name '$InputName'."
        }
        return [string]$State.campaigns[$InputName]
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$State.active_campaign)) {
        $activeName = [string]$State.active_campaign
        if ($State.campaigns.ContainsKey($activeName)) {
            return [string]$State.campaigns[$activeName]
        }
    }
    throw "No campaign selected. Use: gurpsai load -Name <campaign>"
}

function Register-Campaign {
    param(
        [hashtable]$State,
        [string]$CampaignName,
        [string]$CampaignPath
    )
    $resolved = (Resolve-Path -LiteralPath $CampaignPath).Path
    $State.campaigns[$CampaignName] = $resolved
    $State.active_campaign = $CampaignName
    Save-State -State $State
}

function Ensure-CampaignBootstrap {
    param(
        [string]$CampaignPath
    )
    $campaignScripts = Join-Path $CampaignPath "scripts"
    $campaignUpdateScript = Join-Path $campaignScripts "update-campaign.ps1"
    if (Test-Path -LiteralPath $campaignUpdateScript -PathType Leaf) {
        return
    }

    Write-Host "Campaign does not have update scripts yet. Bootstrapping from core..."
    $syncScript = Join-Path $coreRoot "scripts/framework-sync.ps1"
    Push-Location $CampaignPath
    try {
        & powershell -ExecutionPolicy Bypass -File $syncScript -CorePath $coreRoot
        if ($LASTEXITCODE -ne 0) {
            throw "Bootstrap failed with exit code $LASTEXITCODE."
        }
    } finally {
        Pop-Location
    }
}

function Show-Help {
    Write-Host "Gurps Assistant Application Commands"
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  gurpsai <command> [options]"
    Write-Host "  (or: .\scripts\app.ps1 <command> [options])"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  help                          Show this help"
    Write-Host "  init                          Initialize global app state"
    Write-Host "  new -Name <n> [-Path <p>]     Create + register a new campaign"
    Write-Host "  register [-Name <n>] -Path <p> Register existing campaign folder"
    Write-Host "  load [-Name <n>] [-Path <p>]  Set active campaign"
    Write-Host "  list                          List registered campaigns"
    Write-Host "  current                       Show active campaign"
    Write-Host "  update [-Name/-Path] [flags]  Run update pipeline on campaign"
    Write-Host "  actualize [-Name/-Path]       Run actualization on campaign"
    Write-Host "  workflows                     List AI workflow names"
    Write-Host "  workflow -Name <n>            Print prompt to run workflow in chat"
    Write-Host "  ai ...                        AI provider commands (via gurpsai ai ...)"
    Write-Host ""
    Write-Host "Update flags:"
    Write-Host "  -DryRun  -Force  -Ref <tag|branch>  -LatestTag"
    Write-Host ""
    Write-Host "Default behavior:"
    Write-Host "  update uses global source config from set-core-source.ps1."
    Write-Host "  Use -Ref/-LatestTag to override target revision."
}

$state = Load-State

switch ($Command) {
    "help" {
        Show-Help
        exit 0
    }
    "init" {
        $state.core_repo_url = $defaultCoreRepo
        $state.core_path = $coreRoot
        Save-State -State $state
        Write-Host "Global app state initialized:"
        Write-Host "  State: $statePath"
        Write-Host "  Core repo: $($state.core_repo_url)"
        Write-Host "  Core path: $($state.core_path)"
        exit 0
    }
    "new" {
        if ([string]::IsNullOrWhiteSpace($Name) -and [string]::IsNullOrWhiteSpace($Path)) {
            throw "Provide -Name and optionally -Path."
        }

        $targetPath = $null
        if (-not [string]::IsNullOrWhiteSpace($Path)) {
            $targetPath = $Path
        } else {
            $campaignsRoot = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "GurpsCampaigns"
            $targetPath = Join-Path $campaignsRoot $Name
        }

        if ([string]::IsNullOrWhiteSpace($Name)) {
            $Name = Split-Path -Leaf $targetPath
        }

        if (Test-Path -LiteralPath $targetPath) {
            $existingItems = @(Get-ChildItem -LiteralPath $targetPath -Force)
            if ($existingItems.Count -gt 0) {
                throw "Target path already exists and is not empty: $targetPath"
            }
        } else {
            New-Item -ItemType Directory -Path $targetPath -Force | Out-Null
        }

        foreach ($dir in @("01_World_Bible", "02_Characters", "03_Story")) {
            $p = Join-Path $targetPath $dir
            if (-not (Test-Path -LiteralPath $p)) {
                New-Item -ItemType Directory -Path $p -Force | Out-Null
            }
        }

        foreach ($seed in @("00_System_Rules.md", "state.md")) {
            $src = Join-Path $coreRoot $seed
            $dst = Join-Path $targetPath $seed
            if ((Test-Path -LiteralPath $src -PathType Leaf) -and -not (Test-Path -LiteralPath $dst -PathType Leaf)) {
                Copy-Item -LiteralPath $src -Destination $dst -Force
            }
        }

        $syncScript = Join-Path $coreRoot "scripts/framework-sync.ps1"
        Push-Location $targetPath
        try {
            & powershell -ExecutionPolicy Bypass -File $syncScript -CorePath $coreRoot
            if ($LASTEXITCODE -ne 0) {
                throw "Initial core sync failed with exit code $LASTEXITCODE."
            }
        } finally {
            Pop-Location
        }

        Register-Campaign -State $state -CampaignName $Name -CampaignPath $targetPath
        Write-Host "Campaign created and loaded:"
        Write-Host "  Name: $Name"
        Write-Host "  Path: $targetPath"
        exit 0
    }
    "register" {
        if ([string]::IsNullOrWhiteSpace($Path)) {
            throw "register requires -Path"
        }
        $resolved = (Resolve-Path -LiteralPath $Path).Path
        if (-not (Test-Path -LiteralPath $resolved -PathType Container)) {
            throw "Not a directory: $resolved"
        }
        if ([string]::IsNullOrWhiteSpace($Name)) {
            $Name = Split-Path -Leaf $resolved
        }
        Register-Campaign -State $state -CampaignName $Name -CampaignPath $resolved
        Write-Host "Campaign registered and loaded:"
        Write-Host "  Name: $Name"
        Write-Host "  Path: $resolved"
        exit 0
    }
    "load" {
        if (-not [string]::IsNullOrWhiteSpace($Path)) {
            $resolved = (Resolve-Path -LiteralPath $Path).Path
            if ([string]::IsNullOrWhiteSpace($Name)) {
                $Name = Split-Path -Leaf $resolved
            }
            Register-Campaign -State $state -CampaignName $Name -CampaignPath $resolved
            Write-Host "Campaign loaded:"
            Write-Host "  Name: $Name"
            Write-Host "  Path: $resolved"
            exit 0
        }

        if ([string]::IsNullOrWhiteSpace($Name)) {
            throw "load requires -Name or -Path"
        }
        if (-not $state.campaigns.ContainsKey($Name)) {
            throw "Unknown campaign: $Name"
        }
        $state.active_campaign = $Name
        Save-State -State $state
        Write-Host "Active campaign: $Name"
        Write-Host "Path: $($state.campaigns[$Name])"
        exit 0
    }
    "list" {
        $active = [string]$state.active_campaign
        if ($state.campaigns.Count -eq 0) {
            Write-Host "No campaigns registered."
            exit 0
        }
        foreach ($k in ($state.campaigns.Keys | Sort-Object)) {
            $mark = if ($k -eq $active) { "*" } else { " " }
            Write-Host ("{0} {1} -> {2}" -f $mark, $k, $state.campaigns[$k])
        }
        exit 0
    }
    "current" {
        if ([string]::IsNullOrWhiteSpace([string]$state.active_campaign)) {
            Write-Host "No active campaign."
            exit 0
        }
        $activeName = [string]$state.active_campaign
        Write-Host "Active campaign: $activeName"
        Write-Host "Path: $($state.campaigns[$activeName])"
        exit 0
    }
    "update" {
        $campaignPath = Resolve-CampaignPathFromInput -State $state -InputName $Name -InputPath $Path
        Ensure-CampaignBootstrap -CampaignPath $campaignPath
        $updateScript = Join-Path $campaignPath "scripts/update-campaign.ps1"
        $updateArgs = @("-ExecutionPolicy", "Bypass", "-File", $updateScript)
        if ($DryRun) { $updateArgs += "-DryRun" }
        if ($Force) { $updateArgs += "-Force" }
        if (-not [string]::IsNullOrWhiteSpace($Ref)) { $updateArgs += @("-Ref", $Ref) }
        if ($LatestTag) { $updateArgs += "-LatestTag" }

        Push-Location $campaignPath
        try {
            & powershell @updateArgs
            exit $LASTEXITCODE
        } finally {
            Pop-Location
        }
    }
    "actualize" {
        $campaignPath = Resolve-CampaignPathFromInput -State $state -InputName $Name -InputPath $Path
        Ensure-CampaignBootstrap -CampaignPath $campaignPath
        $script = Join-Path $campaignPath "scripts/actualize-campaign.ps1"
        Push-Location $campaignPath
        try {
            & powershell -ExecutionPolicy Bypass -File $script
            exit $LASTEXITCODE
        } finally {
            Pop-Location
        }
    }
    "workflows" {
        $workflowDir = Join-Path $coreRoot ".agents/workflows"
        if (-not (Test-Path -LiteralPath $workflowDir -PathType Container)) {
            throw "Missing workflow directory: $workflowDir"
        }
        Get-ChildItem -LiteralPath $workflowDir -File -Filter *.md |
            Where-Object { $_.Name -ne "INDEX.md" } |
            Sort-Object Name |
            ForEach-Object { [System.IO.Path]::GetFileNameWithoutExtension($_.Name) }
        exit 0
    }
    "workflow" {
        if ([string]::IsNullOrWhiteSpace($Name)) {
            throw "workflow requires -Name"
        }
        $wfPath = Join-Path $coreRoot (".agents/workflows/{0}.md" -f $Name)
        if (-not (Test-Path -LiteralPath $wfPath -PathType Leaf)) {
            throw "Unknown workflow: $Name"
        }
        Write-Host ("run {0} workflow" -f $Name)
        exit 0
    }
    default {
        throw "Unknown command: $Command"
    }
}

[CmdletBinding()]
param(
    [ValidateSet("help", "providers", "show-config", "configure", "set-default", "chat", "workflow", "agent")]
    [string]$Command = "help",
    [string]$Provider,
    [string]$Model,
    [string]$ApiKeyEnv,
    [string]$Endpoint,
    [string]$Prompt,
    [string]$PromptFile,
    [string]$SystemPrompt,
    [string]$SystemFile,
    [string]$Task,
    [string]$WorkflowName,
    [string]$CampaignPath,
    [int]$MaxSteps = 20,
    [switch]$SetDefault,
    [switch]$Disable,
    [switch]$PrintPromptOnly,
    [switch]$SkipStartupDocs,
    [switch]$Raw,
    [switch]$DryRun,
    [switch]$RequireApproval,
    [string]$Resume
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$coreRoot = Split-Path -Parent $scriptRoot

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

function Parse-DotEnvLine {
    param([string]$Line)
    if ([string]::IsNullOrWhiteSpace($Line)) {
        return $null
    }

    $trimmed = $Line.Trim()
    if ($trimmed.StartsWith("#")) {
        return $null
    }

    $eqIndex = $trimmed.IndexOf("=")
    if ($eqIndex -lt 1) {
        return $null
    }

    $name = $trimmed.Substring(0, $eqIndex).Trim()
    if ($name.StartsWith("export ")) {
        $name = $name.Substring(7).Trim()
    }
    if ([string]::IsNullOrWhiteSpace($name)) {
        return $null
    }

    $value = $trimmed.Substring($eqIndex + 1).Trim()
    if ($value.Length -ge 2) {
        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
    }

    return [PSCustomObject]@{
        name = $name
        value = $value
    }
}

function Import-DotEnvFile {
    param(
        [string]$FilePath,
        [switch]$OverrideExisting
    )
    if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
        return 0
    }

    $count = 0
    foreach ($line in (Get-Content -LiteralPath $FilePath)) {
        $parsed = Parse-DotEnvLine -Line $line
        if ($null -eq $parsed) {
            continue
        }
        $current = [Environment]::GetEnvironmentVariable($parsed.name)
        if (-not $OverrideExisting -and -not [string]::IsNullOrWhiteSpace($current)) {
            continue
        }
        [Environment]::SetEnvironmentVariable($parsed.name, $parsed.value, "Process")
        $count++
    }
    return $count
}

function Resolve-ProviderAlias {
    param([string]$Name)
    if ([string]::IsNullOrWhiteSpace($Name)) {
        return $null
    }

    switch ($Name.Trim().ToLowerInvariant()) {
        "chatgpt" { return "chatgpt" }
        "openai" { return "chatgpt" }
        "gemini" { return "gemini" }
        "deepseek" { return "deepseek" }
        default { return $Name.Trim().ToLowerInvariant() }
    }
}

function New-ProviderDefaults {
    return [ordered]@{
        chatgpt = [ordered]@{
            display_name = "ChatGPT (OpenAI)"
            api_style = "openai_responses"
            endpoint = "https://api.openai.com/v1/responses"
            api_key_env = "OPENAI_API_KEY"
            model = "gpt-5"
            enabled = $false
        }
        gemini = [ordered]@{
            display_name = "Gemini"
            api_style = "gemini_generate_content"
            endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            api_key_env = "GEMINI_API_KEY"
            model = "gemini-2.5-pro"
            enabled = $false
        }
        deepseek = [ordered]@{
            display_name = "DeepSeek"
            api_style = "openai_chat"
            endpoint = "https://api.deepseek.com/v1/chat/completions"
            api_key_env = "DEEPSEEK_API_KEY"
            model = "deepseek-chat"
            enabled = $false
        }
    }
}

function New-DefaultConfig {
    $providers = New-ProviderDefaults
    return [ordered]@{
        schema_version = 1
        default_provider = "chatgpt"
        providers = $providers
        updated_at_utc = [DateTime]::UtcNow.ToString("o")
    }
}

function Merge-ProviderConfig {
    param(
        [hashtable]$DefaultProvider,
        $LoadedProvider
    )

    if ($null -eq $LoadedProvider) {
        return $DefaultProvider
    }

    foreach ($key in @("display_name", "api_style", "endpoint", "api_key_env", "model")) {
        if ($null -ne $LoadedProvider.$key -and -not [string]::IsNullOrWhiteSpace([string]$LoadedProvider.$key)) {
            $DefaultProvider[$key] = [string]$LoadedProvider.$key
        }
    }
    if ($null -ne $LoadedProvider.enabled) {
        $DefaultProvider["enabled"] = [bool]$LoadedProvider.enabled
    }
    return $DefaultProvider
}

function Load-Config {
    param([string]$Path)
    $config = New-DefaultConfig

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $config
    }

    $loaded = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    if ($null -ne $loaded.default_provider -and -not [string]::IsNullOrWhiteSpace([string]$loaded.default_provider)) {
        $config.default_provider = Resolve-ProviderAlias -Name ([string]$loaded.default_provider)
    }

    foreach ($providerName in @("chatgpt", "gemini", "deepseek")) {
        $config.providers[$providerName] = Merge-ProviderConfig -DefaultProvider $config.providers[$providerName] -LoadedProvider $loaded.providers.$providerName
    }

    return $config
}

function Save-Config {
    param(
        [string]$Path,
        [hashtable]$Config
    )
    $Config.updated_at_utc = [DateTime]::UtcNow.ToString("o")
    $Config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Ensure-ProviderExists {
    param(
        [hashtable]$Config,
        [string]$ProviderName
    )
    if (-not $Config.providers.Contains($ProviderName)) {
        throw "Unknown provider '$ProviderName'. Run: scripts/ai.ps1 providers"
    }
}

function Resolve-ProviderName {
    param(
        [hashtable]$Config,
        [string]$InputProvider
    )
    $name = Resolve-ProviderAlias -Name $InputProvider
    if ([string]::IsNullOrWhiteSpace($name)) {
        $name = Resolve-ProviderAlias -Name $Config.default_provider
    }
    if ([string]::IsNullOrWhiteSpace($name)) {
        throw "No provider selected and no default provider configured."
    }
    Ensure-ProviderExists -Config $Config -ProviderName $name
    return $name
}

function Read-OptionalText {
    param(
        [string]$InlineText,
        [string]$FilePath
    )
    $parts = New-Object System.Collections.Generic.List[string]
    if (-not [string]::IsNullOrWhiteSpace($InlineText)) {
        $parts.Add($InlineText) | Out-Null
    }
    if (-not [string]::IsNullOrWhiteSpace($FilePath)) {
        $resolved = (Resolve-Path -LiteralPath $FilePath).Path
        $parts.Add((Get-Content -LiteralPath $resolved -Raw)) | Out-Null
    }
    return ($parts -join "`n`n").Trim()
}

function Build-WorkflowPrompt {
    param(
        [string]$Workflow,
        [string]$CampaignRoot,
        [string]$UserPrompt,
        [bool]$IncludeStartupDocs
    )

    if ([string]::IsNullOrWhiteSpace($Workflow)) {
        throw "workflow command requires -WorkflowName."
    }

    $workflowPath = Join-Path $coreRoot (".agents/workflows/{0}.md" -f $Workflow)
    if (-not (Test-Path -LiteralPath $workflowPath -PathType Leaf)) {
        throw "Unknown workflow '$Workflow' at '$workflowPath'."
    }

    $parts = New-Object System.Collections.Generic.List[string]
    $parts.Add("Execute the workflow '$Workflow' for this GURPSAI campaign.") | Out-Null
    $parts.Add("Follow the workflow instructions exactly and keep output actionable.") | Out-Null
    $parts.Add("") | Out-Null
    $parts.Add("## Workflow File") | Out-Null
    $parts.Add("Path: $workflowPath") | Out-Null
    $parts.Add('```markdown') | Out-Null
    $parts.Add((Get-Content -LiteralPath $workflowPath -Raw).TrimEnd()) | Out-Null
    $parts.Add('```') | Out-Null

    if ($IncludeStartupDocs) {
        $startupFiles = @(
            "state.md",
            "SYSTEM.md",
            "master_philosophy.md",
            ".planning/MAP.md",
            "00_System_Rules.md"
        )
        foreach ($relative in $startupFiles) {
            $fullPath = Join-Path $CampaignRoot $relative
            $parts.Add("") | Out-Null
            $parts.Add("## Context File: $relative") | Out-Null
            if (Test-Path -LiteralPath $fullPath -PathType Leaf) {
                $parts.Add('```markdown') | Out-Null
                $parts.Add((Get-Content -LiteralPath $fullPath -Raw).TrimEnd()) | Out-Null
                $parts.Add('```') | Out-Null
            } else {
                $parts.Add("Missing file: $fullPath") | Out-Null
            }
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($UserPrompt)) {
        $parts.Add("") | Out-Null
        $parts.Add("## User Request") | Out-Null
        $parts.Add($UserPrompt.Trim()) | Out-Null
    }

    return ($parts -join "`n")
}

function Invoke-ProviderRequest {
    param(
        [hashtable]$ProviderConfig,
        [string]$ModelOverride,
        [string]$PromptText,
        [string]$SystemText
    )

    if ([string]::IsNullOrWhiteSpace($PromptText)) {
        throw "Prompt is empty."
    }

    $model = if (-not [string]::IsNullOrWhiteSpace($ModelOverride)) { $ModelOverride } else { [string]$ProviderConfig.model }
    $apiKeyEnv = [string]$ProviderConfig.api_key_env
    if ([string]::IsNullOrWhiteSpace($apiKeyEnv)) {
        throw "Provider config is missing api_key_env."
    }

    $apiKey = [Environment]::GetEnvironmentVariable($apiKeyEnv)
    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        throw "Missing API key. Set environment variable '$apiKeyEnv'."
    }

    $apiStyle = [string]$ProviderConfig.api_style
    $endpoint = [string]$ProviderConfig.endpoint
    if ([string]::IsNullOrWhiteSpace($endpoint)) {
        throw "Provider config is missing endpoint."
    }

    switch ($apiStyle) {
        "openai_responses" {
            $messages = New-Object System.Collections.Generic.List[object]
            if (-not [string]::IsNullOrWhiteSpace($SystemText)) {
                $messages.Add(@{
                        role = "system"
                        content = @(
                            @{
                                type = "input_text"
                                text = $SystemText
                            }
                        )
                    }) | Out-Null
            }
            $messages.Add(@{
                    role = "user"
                    content = @(
                        @{
                            type = "input_text"
                            text = $PromptText
                        }
                    )
                }) | Out-Null

            $body = @{
                model = $model
                input = @($messages)
            }
            $headers = @{
                Authorization = "Bearer $apiKey"
                "Content-Type" = "application/json"
            }
            $rawResponse = Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -Body ($body | ConvertTo-Json -Depth 12)
            $textParts = New-Object System.Collections.Generic.List[string]
            if ($null -ne $rawResponse.output_text -and -not [string]::IsNullOrWhiteSpace([string]$rawResponse.output_text)) {
                $textParts.Add([string]$rawResponse.output_text) | Out-Null
            } else {
                foreach ($item in @($rawResponse.output)) {
                    foreach ($content in @($item.content)) {
                        if ($null -ne $content.text -and -not [string]::IsNullOrWhiteSpace([string]$content.text)) {
                            $textParts.Add([string]$content.text) | Out-Null
                        }
                    }
                }
            }

            return [PSCustomObject]@{
                text = ($textParts -join "`n").Trim()
                raw = $rawResponse
            }
        }
        "openai_chat" {
            $messages = New-Object System.Collections.Generic.List[object]
            if (-not [string]::IsNullOrWhiteSpace($SystemText)) {
                $messages.Add(@{ role = "system"; content = $SystemText }) | Out-Null
            }
            $messages.Add(@{ role = "user"; content = $PromptText }) | Out-Null

            $body = @{
                model = $model
                messages = @($messages)
            }
            $headers = @{
                Authorization = "Bearer $apiKey"
                "Content-Type" = "application/json"
            }
            $rawResponse = Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -Body ($body | ConvertTo-Json -Depth 12)
            $text = [string]$rawResponse.choices[0].message.content
            return [PSCustomObject]@{
                text = $text.Trim()
                raw = $rawResponse
            }
        }
        "gemini_generate_content" {
            $resolvedEndpoint = $endpoint.Replace("{model}", [Uri]::EscapeDataString($model))
            $delimiter = if ($resolvedEndpoint.Contains("?")) { "&" } else { "?" }
            $uri = "{0}{1}key={2}" -f $resolvedEndpoint, $delimiter, [Uri]::EscapeDataString($apiKey)

            $body = @{
                contents = @(
                    @{
                        role = "user"
                        parts = @(
                            @{
                                text = $PromptText
                            }
                        )
                    }
                )
            }
            if (-not [string]::IsNullOrWhiteSpace($SystemText)) {
                $body["systemInstruction"] = @{
                    parts = @(
                        @{
                            text = $SystemText
                        }
                    )
                }
            }

            $rawResponse = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 12)
            $textParts = New-Object System.Collections.Generic.List[string]
            foreach ($candidate in @($rawResponse.candidates)) {
                foreach ($part in @($candidate.content.parts)) {
                    if ($null -ne $part.text -and -not [string]::IsNullOrWhiteSpace([string]$part.text)) {
                        $textParts.Add([string]$part.text) | Out-Null
                    }
                }
            }
            return [PSCustomObject]@{
                text = ($textParts -join "`n").Trim()
                raw = $rawResponse
            }
        }
        default {
            throw "Unsupported api_style '$apiStyle'."
        }
    }
}

function Show-Help {
    Write-Host "AI provider CLI for GURPSAI"
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  scripts/ai.ps1 <command> [options]"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  help                                Show this help"
    Write-Host "  providers                           List providers and status"
    Write-Host "  show-config                         Print global config location"
    Write-Host "  configure -Provider <name> [...]    Configure provider settings"
    Write-Host "  set-default -Provider <name>        Set default provider"
    Write-Host "  chat -Prompt <text> [...]           Send a direct prompt"
    Write-Host "  workflow -WorkflowName <name> [...] Run a workflow prompt via AI"
    Write-Host "  agent -Task <text> [...]             Run tool-loop agent with file access"
    Write-Host ""
    Write-Host "Provider names:"
    Write-Host "  chatgpt | openai | gemini | deepseek"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  scripts/ai.ps1 configure -Provider chatgpt -ApiKeyEnv OPENAI_API_KEY -Model gpt-5 -SetDefault"
    Write-Host "  scripts/ai.ps1 configure -Provider gemini -ApiKeyEnv GEMINI_API_KEY -Model gemini-2.5-pro"
    Write-Host "  scripts/ai.ps1 configure -Provider deepseek -ApiKeyEnv DEEPSEEK_API_KEY -Model deepseek-chat"
    Write-Host "  scripts/ai.ps1 chat -Provider chatgpt -Prompt ""Summarize this chapter plan."""
    Write-Host "  scripts/ai.ps1 workflow -WorkflowName prep_session -CampaignPath ""D:\RPG\MyCampaign"" -Prompt ""Prepare next session for 3 PCs."""
    Write-Host "  scripts/ai.ps1 workflow -WorkflowName create_npc -PrintPromptOnly"
    Write-Host "  scripts/ai.ps1 agent -CampaignPath ""D:\RPG\MyCampaign"" -Task ""Update state.md with recap"" -DryRun"
}

$globalHome = Resolve-GlobalHome -RepoRoot $coreRoot
$globalEnvPath = Join-Path $globalHome ".env"
$cwdEnvPath = Join-Path (Get-Location).Path ".env"
[void](Import-DotEnvFile -FilePath $globalEnvPath)
if ($cwdEnvPath -ne $globalEnvPath) {
    [void](Import-DotEnvFile -FilePath $cwdEnvPath)
}
$configPath = Join-Path $globalHome "ai-config.json"
$configExisted = Test-Path -LiteralPath $configPath -PathType Leaf
$config = Load-Config -Path $configPath
if (-not $configExisted) {
    Save-Config -Path $configPath -Config $config
}

switch ($Command) {
    "help" {
        Show-Help
        exit 0
    }
    "providers" {
        Write-Host "AI Providers"
        Write-Host "  Config:  $configPath"
        Write-Host "  Default: $($config.default_provider)"
        Write-Host ""
        foreach ($name in @("chatgpt", "gemini", "deepseek")) {
            $p = $config.providers[$name]
            $keySet = -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable([string]$p.api_key_env))
            $mark = if ([string]$config.default_provider -eq $name) { "*" } else { " " }
            Write-Host ("{0} {1}" -f $mark, $name)
            Write-Host ("    display:      {0}" -f $p.display_name)
            Write-Host ("    enabled:      {0}" -f [bool]$p.enabled)
            Write-Host ("    model:        {0}" -f $p.model)
            Write-Host ("    endpoint:     {0}" -f $p.endpoint)
            Write-Host ("    api_key_env:  {0} (set={1})" -f $p.api_key_env, $keySet)
        }
        exit 0
    }
    "show-config" {
        Write-Host "AI config file: $configPath"
        Write-Host "Global home:    $globalHome"
        exit 0
    }
    "configure" {
        $providerName = Resolve-ProviderAlias -Name $Provider
        if ([string]::IsNullOrWhiteSpace($providerName)) {
            throw "configure requires -Provider."
        }
        Ensure-ProviderExists -Config $config -ProviderName $providerName

        $p = $config.providers[$providerName]
        if (-not [string]::IsNullOrWhiteSpace($Model)) { $p.model = $Model }
        if (-not [string]::IsNullOrWhiteSpace($ApiKeyEnv)) { $p.api_key_env = $ApiKeyEnv }
        if (-not [string]::IsNullOrWhiteSpace($Endpoint)) { $p.endpoint = $Endpoint }
        $p.enabled = if ($Disable) { $false } else { $true }
        $config.providers[$providerName] = $p

        if ($SetDefault) {
            $config.default_provider = $providerName
        }

        Save-Config -Path $configPath -Config $config

        Write-Host "Provider configured: $providerName"
        Write-Host "  Enabled:     $([bool]$p.enabled)"
        Write-Host "  Model:       $($p.model)"
        Write-Host "  Endpoint:    $($p.endpoint)"
        Write-Host "  API key env: $($p.api_key_env)"
        if ($SetDefault) {
            Write-Host "  Default:     yes"
        }
        Write-Host "Config: $configPath"
        exit 0
    }
    "set-default" {
        $providerName = Resolve-ProviderAlias -Name $Provider
        if ([string]::IsNullOrWhiteSpace($providerName)) {
            throw "set-default requires -Provider."
        }
        Ensure-ProviderExists -Config $config -ProviderName $providerName
        $config.default_provider = $providerName
        Save-Config -Path $configPath -Config $config
        Write-Host "Default provider: $providerName"
        Write-Host "Config: $configPath"
        exit 0
    }
    "chat" {
        $providerName = Resolve-ProviderName -Config $config -InputProvider $Provider
        $providerConfig = $config.providers[$providerName]
        if (-not [bool]$providerConfig.enabled) {
            throw "Provider '$providerName' is disabled. Run configure first."
        }

        $promptText = Read-OptionalText -InlineText $Prompt -FilePath $PromptFile
        if ([string]::IsNullOrWhiteSpace($promptText)) {
            throw "chat requires -Prompt or -PromptFile."
        }
        $systemText = Read-OptionalText -InlineText $SystemPrompt -FilePath $SystemFile

        Write-Host ("Sending prompt to {0} ({1})..." -f $providerName, $providerConfig.model)
        $result = Invoke-ProviderRequest -ProviderConfig $providerConfig -ModelOverride $Model -PromptText $promptText -SystemText $systemText

        if ($Raw) {
            $result.raw | ConvertTo-Json -Depth 20
        } else {
            Write-Host ""
            Write-Output $result.text
        }
        exit 0
    }
    "workflow" {
        $promptText = Read-OptionalText -InlineText $Prompt -FilePath $PromptFile
        $campaignRoot = if (-not [string]::IsNullOrWhiteSpace($CampaignPath)) { (Resolve-Path -LiteralPath $CampaignPath).Path } else { (Get-Location).Path }
        $fullPrompt = Build-WorkflowPrompt -Workflow $WorkflowName -CampaignRoot $campaignRoot -UserPrompt $promptText -IncludeStartupDocs:(-not $SkipStartupDocs)
        if ($PrintPromptOnly) {
            Write-Output $fullPrompt
            exit 0
        }

        $providerName = Resolve-ProviderName -Config $config -InputProvider $Provider
        $providerConfig = $config.providers[$providerName]
        if (-not [bool]$providerConfig.enabled) {
            throw "Provider '$providerName' is disabled. Run configure first."
        }

        $defaultSystem = "You are an expert GURPS 4e GM assistant. Follow provided workflow and context files exactly."
        $systemText = Read-OptionalText -InlineText $SystemPrompt -FilePath $SystemFile
        if ([string]::IsNullOrWhiteSpace($systemText)) {
            $systemText = $defaultSystem
        }

        Write-Host ("Sending workflow '{0}' to {1} ({2})..." -f $WorkflowName, $providerName, $providerConfig.model)
        $result = Invoke-ProviderRequest -ProviderConfig $providerConfig -ModelOverride $Model -PromptText $fullPrompt -SystemText $systemText

        if ($Raw) {
            $result.raw | ConvertTo-Json -Depth 20
        } else {
            Write-Host ""
            Write-Output $result.text
        }
        exit 0
    }
    "agent" {
        if ([string]::IsNullOrWhiteSpace($Task)) {
            throw "agent requires -Task."
        }

        $agentScript = Join-Path $scriptRoot "ai-agent.ps1"
        if (-not (Test-Path -LiteralPath $agentScript -PathType Leaf)) {
            throw "Missing script: $agentScript"
        }

        $agentArgs = @(
            "-ExecutionPolicy", "Bypass",
            "-File", $agentScript,
            "-Task", $Task
        )
        if (-not [string]::IsNullOrWhiteSpace($CampaignPath)) { $agentArgs += @("-CampaignPath", $CampaignPath) }
        if (-not [string]::IsNullOrWhiteSpace($Provider)) { $agentArgs += @("-Provider", $Provider) }
        if (-not [string]::IsNullOrWhiteSpace($Model)) { $agentArgs += @("-Model", $Model) }
        if ($PSBoundParameters.ContainsKey("MaxSteps")) { $agentArgs += @("-MaxSteps", [string]$MaxSteps) }
        if ($DryRun) { $agentArgs += "-DryRun" }
        if ($RequireApproval) { $agentArgs += "-RequireApproval" }
        if (-not [string]::IsNullOrWhiteSpace($Resume)) { $agentArgs += @("-Resume", $Resume) }

        & powershell @agentArgs
        exit $LASTEXITCODE
    }
    default {
        throw "Unknown command: $Command"
    }
}

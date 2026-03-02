[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Task,
    [string]$CampaignPath,
    [string]$Provider,
    [string]$Model,
    [int]$MaxSteps = 20,
    [switch]$DryRun,
    [switch]$RequireApproval,
    [string]$Resume
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if ((Split-Path -Leaf $scriptRoot) -ieq "legacy") {
    $scriptRoot = Split-Path -Parent $scriptRoot
}
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
    param([string]$FilePath)
    if (-not (Test-Path -LiteralPath $FilePath -PathType Leaf)) {
        return
    }
    foreach ($line in (Get-Content -LiteralPath $FilePath)) {
        $parsed = Parse-DotEnvLine -Line $line
        if ($null -eq $parsed) {
            continue
        }
        $existing = [Environment]::GetEnvironmentVariable($parsed.name)
        if (-not [string]::IsNullOrWhiteSpace($existing)) {
            continue
        }
        [Environment]::SetEnvironmentVariable($parsed.name, $parsed.value, "Process")
    }
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
    param([hashtable]$DefaultProvider, $LoadedProvider)
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
    $cfg = New-DefaultConfig
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $cfg
    }

    $loaded = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    if ($null -ne $loaded.default_provider -and -not [string]::IsNullOrWhiteSpace([string]$loaded.default_provider)) {
        $cfg.default_provider = Resolve-ProviderAlias -Name ([string]$loaded.default_provider
        )
    }
    foreach ($providerName in @("chatgpt", "gemini", "deepseek")) {
        $cfg.providers[$providerName] = Merge-ProviderConfig -DefaultProvider $cfg.providers[$providerName] -LoadedProvider $loaded.providers.$providerName
    }
    return $cfg
}

function Resolve-ProviderName {
    param([hashtable]$Config, [string]$InputProvider)
    $providerName = Resolve-ProviderAlias -Name $InputProvider
    if ([string]::IsNullOrWhiteSpace($providerName)) {
        $providerName = Resolve-ProviderAlias -Name $Config.default_provider
    }
    if ([string]::IsNullOrWhiteSpace($providerName)) {
        throw "No provider selected and no default provider configured."
    }
    if (-not $Config.providers.Contains($providerName)) {
        throw "Unknown provider '$providerName'."
    }
    return $providerName
}

function Invoke-ProviderRequest {
    param(
        [hashtable]$ProviderConfig,
        [string]$ModelOverride,
        [string]$PromptText,
        [string]$SystemText
    )

    $model = if (-not [string]::IsNullOrWhiteSpace($ModelOverride)) { $ModelOverride } else { [string]$ProviderConfig.model }
    $apiKeyEnv = [string]$ProviderConfig.api_key_env
    $apiKey = [Environment]::GetEnvironmentVariable($apiKeyEnv)
    if ([string]::IsNullOrWhiteSpace($apiKey)) {
        throw "Missing API key. Set environment variable '$apiKeyEnv'."
    }

    $apiStyle = [string]$ProviderConfig.api_style
    $endpoint = [string]$ProviderConfig.endpoint
    switch ($apiStyle) {
        "openai_responses" {
            $messages = @()
            if (-not [string]::IsNullOrWhiteSpace($SystemText)) {
                $messages += @{
                    role = "system"
                    content = @(@{ type = "input_text"; text = $SystemText })
                }
            }
            $messages += @{
                role = "user"
                content = @(@{ type = "input_text"; text = $PromptText })
            }

            $body = @{
                model = $model
                input = @($messages)
            }
            $headers = @{
                Authorization = "Bearer $apiKey"
                "Content-Type" = "application/json"
            }
            $rawResponse = Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -Body ($body | ConvertTo-Json -Depth 16)
            $text = [string]$rawResponse.output_text
            if ([string]::IsNullOrWhiteSpace($text)) {
                $parts = New-Object System.Collections.Generic.List[string]
                foreach ($item in @($rawResponse.output)) {
                    foreach ($content in @($item.content)) {
                        if ($null -ne $content.text -and -not [string]::IsNullOrWhiteSpace([string]$content.text)) {
                            $parts.Add([string]$content.text) | Out-Null
                        }
                    }
                }
                $text = ($parts -join "`n")
            }
            return [PSCustomObject]@{
                text = $text
                raw = $rawResponse
            }
        }
        "openai_chat" {
            $messages = @()
            if (-not [string]::IsNullOrWhiteSpace($SystemText)) {
                $messages += @{ role = "system"; content = $SystemText }
            }
            $messages += @{ role = "user"; content = $PromptText }
            $body = @{
                model = $model
                messages = @($messages)
            }
            $headers = @{
                Authorization = "Bearer $apiKey"
                "Content-Type" = "application/json"
            }
            $rawResponse = Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -Body ($body | ConvertTo-Json -Depth 16)
            return [PSCustomObject]@{
                text = [string]$rawResponse.choices[0].message.content
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
                        parts = @(@{ text = $PromptText })
                    }
                )
            }
            if (-not [string]::IsNullOrWhiteSpace($SystemText)) {
                $body["systemInstruction"] = @{
                    parts = @(@{ text = $SystemText })
                }
            }
            $rawResponse = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 16)
            $parts = New-Object System.Collections.Generic.List[string]
            foreach ($candidate in @($rawResponse.candidates)) {
                foreach ($part in @($candidate.content.parts)) {
                    if ($null -ne $part.text -and -not [string]::IsNullOrWhiteSpace([string]$part.text)) {
                        $parts.Add([string]$part.text) | Out-Null
                    }
                }
            }
            return [PSCustomObject]@{
                text = ($parts -join "`n")
                raw = $rawResponse
            }
        }
        default {
            throw "Unsupported api_style '$apiStyle'."
        }
    }
}

function New-RunId {
    return "{0}-{1}" -f ([DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss")), ([Guid]::NewGuid().ToString("N").Substring(0, 8))
}

function Write-JsonFile {
    param([string]$Path, $Data, [int]$Depth = 16)
    $Data | ConvertTo-Json -Depth $Depth | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Append-Event {
    param([string]$EventFile, $Payload)
    $json = $Payload | ConvertTo-Json -Depth 16 -Compress
    Add-Content -LiteralPath $EventFile -Encoding UTF8 -Value $json
}

function Resolve-AllowedPath {
    param([string]$BasePath, [string]$InputPath)
    $resolved = $null
    if ([System.IO.Path]::IsPathRooted($InputPath)) {
        $resolved = [System.IO.Path]::GetFullPath($InputPath)
    } else {
        $resolved = [System.IO.Path]::GetFullPath((Join-Path $BasePath $InputPath))
    }
    return $resolved
}

function Is-PathUnderRoot {
    param([string]$Path, [string]$Root)
    $fullPath = [System.IO.Path]::GetFullPath($Path).TrimEnd("\")
    $fullRoot = [System.IO.Path]::GetFullPath($Root).TrimEnd("\")
    if ($fullPath.Length -lt $fullRoot.Length) {
        return $false
    }
    return $fullPath.Equals($fullRoot, [StringComparison]::OrdinalIgnoreCase) -or
        $fullPath.StartsWith($fullRoot + "\", [StringComparison]::OrdinalIgnoreCase)
}

function Ensure-ReadablePath {
    param([string]$Path, [string[]]$ReadRoots)
    foreach ($root in $ReadRoots) {
        if (Is-PathUnderRoot -Path $Path -Root $root) {
            return
        }
    }
    throw "Read path not allowed: $Path"
}

function Ensure-WritablePath {
    param([string]$Path, [string]$WriteRoot)
    if (-not (Is-PathUnderRoot -Path $Path -Root $WriteRoot)) {
        throw "Write path not allowed: $Path"
    }
}

function Limit-Text {
    param([string]$Text, [int]$MaxChars = 30000)
    if ($null -eq $Text) {
        return ""
    }
    if ($Text.Length -le $MaxChars) {
        return $Text
    }
    return $Text.Substring(0, $MaxChars) + "`n...<truncated>"
}

function Get-ToolSpecsText {
    return @'
Tool schema:
1) {"type":"tool_call","tool":"get_state","args":{}}
2) {"type":"tool_call","tool":"list_files","args":{"path":".","glob":"*","max_results":500}}
3) {"type":"tool_call","tool":"read_file","args":{"path":"state.md","start_line":1,"max_lines":300}}
4) {"type":"tool_call","tool":"search","args":{"pattern":"Current Episode","path":".","glob":"*.md","max_results":200}}
5) {"type":"tool_call","tool":"write_file","args":{"path":"notes.md","content":"...","create_dirs":true}}
6) {"type":"tool_call","tool":"apply_patch","args":{"patch_text":"<unified diff>"}}
7) {"type":"final","summary":"one-paragraph summary","final_markdown":"user-facing result"}
8) {"type":"error","summary":"why task cannot proceed"}
'@
}

function Convert-TextToAction {
    param([string]$Text)
    $raw = $Text.Trim()
    if ($raw.StartsWith('```')) {
        $lines = $raw -split "`r?`n"
        if ($lines.Count -ge 3) {
            $raw = (($lines | Select-Object -Skip 1 | Select-Object -SkipLast 1) -join "`n").Trim()
        }
    }
    try {
        $action = $raw | ConvertFrom-Json
    } catch {
        throw "Model response is not valid JSON action."
    }
    if ($null -eq $action.type) {
        throw "Action missing 'type'."
    }
    return $action
}

function Confirm-Action {
    param([string]$Message)
    $resp = Read-Host "$Message [y/N]"
    return $resp -match "^(?i)y(es)?$"
}

function Execute-ToolCall {
    param(
        [string]$ToolName,
        $ArgsObj,
        [string]$CampaignRoot,
        [string]$CoreRoot,
        [string[]]$ReadRoots,
        [switch]$DryRun,
        [switch]$RequireApproval
    )

    switch ($ToolName) {
        "get_state" {
            return @{
                cwd = (Get-Location).Path
                campaign_root = $CampaignRoot
                core_root = $CoreRoot
                limits = @{
                    max_steps = $MaxSteps
                    max_lines_per_read = 300
                    max_chars_per_result = 30000
                }
            }
        }
        "list_files" {
            $path = if ($null -ne $ArgsObj.path) { [string]$ArgsObj.path } else { "." }
            $glob = if ($null -ne $ArgsObj.glob -and -not [string]::IsNullOrWhiteSpace([string]$ArgsObj.glob)) { [string]$ArgsObj.glob } else { "*" }
            $maxResults = if ($null -ne $ArgsObj.max_results) { [int]$ArgsObj.max_results } else { 500 }
            $maxResults = [Math]::Min([Math]::Max($maxResults, 1), 2000)

            $resolvedPath = Resolve-AllowedPath -BasePath $CampaignRoot -InputPath $path
            Ensure-ReadablePath -Path $resolvedPath -ReadRoots $ReadRoots
            if (-not (Test-Path -LiteralPath $resolvedPath)) {
                throw "Path does not exist: $resolvedPath"
            }

            $files = Get-ChildItem -LiteralPath $resolvedPath -Recurse -File | Select-Object -ExpandProperty FullName
            $out = New-Object System.Collections.Generic.List[string]
            foreach ($file in $files) {
                $rel = [System.IO.Path]::GetRelativePath($CampaignRoot, $file)
                if ($rel -like $glob) {
                    $out.Add($rel) | Out-Null
                }
                if ($out.Count -ge $maxResults) {
                    break
                }
            }
            return @{
                count = $out.Count
                files = @($out)
            }
        }
        "read_file" {
            $path = [string]$ArgsObj.path
            if ([string]::IsNullOrWhiteSpace($path)) {
                throw "read_file requires args.path"
            }
            $startLine = if ($null -ne $ArgsObj.start_line) { [int]$ArgsObj.start_line } else { 1 }
            $maxLines = if ($null -ne $ArgsObj.max_lines) { [int]$ArgsObj.max_lines } else { 300 }
            $startLine = [Math]::Max(1, $startLine)
            $maxLines = [Math]::Min([Math]::Max(1, $maxLines), 1000)

            $resolvedPath = Resolve-AllowedPath -BasePath $CampaignRoot -InputPath $path
            Ensure-ReadablePath -Path $resolvedPath -ReadRoots $ReadRoots
            if (-not (Test-Path -LiteralPath $resolvedPath -PathType Leaf)) {
                throw "File not found: $resolvedPath"
            }

            $lines = Get-Content -LiteralPath $resolvedPath
            $slice = @($lines | Select-Object -Skip ($startLine - 1) -First $maxLines)
            return @{
                path = $resolvedPath
                start_line = $startLine
                line_count = $slice.Count
                content = ($slice -join "`n")
            }
        }
        "search" {
            $pattern = [string]$ArgsObj.pattern
            if ([string]::IsNullOrWhiteSpace($pattern)) {
                throw "search requires args.pattern"
            }
            $path = if ($null -ne $ArgsObj.path) { [string]$ArgsObj.path } else { "." }
            $glob = if ($null -ne $ArgsObj.glob -and -not [string]::IsNullOrWhiteSpace([string]$ArgsObj.glob)) { [string]$ArgsObj.glob } else { "*" }
            $maxResults = if ($null -ne $ArgsObj.max_results) { [int]$ArgsObj.max_results } else { 200 }
            $maxResults = [Math]::Min([Math]::Max($maxResults, 1), 1000)

            $resolvedPath = Resolve-AllowedPath -BasePath $CampaignRoot -InputPath $path
            Ensure-ReadablePath -Path $resolvedPath -ReadRoots $ReadRoots
            if (-not (Test-Path -LiteralPath $resolvedPath)) {
                throw "Path does not exist: $resolvedPath"
            }

            $rows = New-Object System.Collections.Generic.List[string]
            if (Get-Command rg -ErrorAction SilentlyContinue) {
                $rgOut = & rg --line-number --no-heading --glob $glob $pattern $resolvedPath
                if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 1) {
                    throw "rg failed with exit code $LASTEXITCODE"
                }
                foreach ($line in @($rgOut)) {
                    $rows.Add([string]$line) | Out-Null
                    if ($rows.Count -ge $maxResults) { break }
                }
            } else {
                $matches = Get-ChildItem -LiteralPath $resolvedPath -Recurse -File | Select-String -Pattern $pattern
                foreach ($m in $matches) {
                    $rows.Add(("{0}:{1}:{2}" -f $m.Path, $m.LineNumber, $m.Line.Trim())) | Out-Null
                    if ($rows.Count -ge $maxResults) { break }
                }
            }
            return @{
                count = $rows.Count
                results = @($rows)
            }
        }
        "write_file" {
            $path = [string]$ArgsObj.path
            $content = [string]$ArgsObj.content
            if ([string]::IsNullOrWhiteSpace($path)) {
                throw "write_file requires args.path"
            }
            $createDirs = if ($null -ne $ArgsObj.create_dirs) { [bool]$ArgsObj.create_dirs } else { $true }
            $resolvedPath = Resolve-AllowedPath -BasePath $CampaignRoot -InputPath $path
            Ensure-WritablePath -Path $resolvedPath -WriteRoot $CampaignRoot

            if ($RequireApproval) {
                if (-not (Confirm-Action -Message ("Approve write_file to {0}?" -f $resolvedPath))) {
                    return @{ approved = $false; status = "skipped_by_user" }
                }
            }
            if ($DryRun) {
                return @{ dry_run = $true; path = $resolvedPath; bytes = [Text.Encoding]::UTF8.GetByteCount($content) }
            }

            $parent = Split-Path -Parent $resolvedPath
            if ($createDirs -and -not [string]::IsNullOrWhiteSpace($parent)) {
                Ensure-Dir -Path $parent
            }
            Set-Content -LiteralPath $resolvedPath -Value $content -Encoding UTF8
            return @{ written = $true; path = $resolvedPath; bytes = [Text.Encoding]::UTF8.GetByteCount($content) }
        }
        "apply_patch" {
            $patchText = [string]$ArgsObj.patch_text
            if ([string]::IsNullOrWhiteSpace($patchText)) {
                throw "apply_patch requires args.patch_text"
            }

            if ($RequireApproval) {
                if (-not (Confirm-Action -Message "Approve apply_patch operation?")) {
                    return @{ approved = $false; status = "skipped_by_user" }
                }
            }
            if ($DryRun) {
                return @{ dry_run = $true; bytes = [Text.Encoding]::UTF8.GetByteCount($patchText) }
            }

            if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
                throw "apply_patch requires git installed."
            }

            $tmpPatch = Join-Path ([System.IO.Path]::GetTempPath()) ("gurpsai-agent-{0}.patch" -f [Guid]::NewGuid().ToString("N"))
            Set-Content -LiteralPath $tmpPatch -Value $patchText -Encoding UTF8
            try {
                Push-Location $CampaignRoot
                & git apply --whitespace=nowarn $tmpPatch
                if ($LASTEXITCODE -ne 0) {
                    throw "git apply failed with exit code $LASTEXITCODE"
                }
            } finally {
                Pop-Location
                Remove-Item -LiteralPath $tmpPatch -Force -ErrorAction SilentlyContinue
            }
            return @{ applied = $true }
        }
        default {
            throw "Unknown tool: $ToolName"
        }
    }
}

function Render-HistoryText {
    param([System.Collections.Generic.List[object]]$History, [int]$MaxChars = 20000)
    $parts = New-Object System.Collections.Generic.List[string]
    foreach ($item in $History) {
        $parts.Add(("### {0}`n{1}" -f $item.role, $item.content)) | Out-Null
    }
    return Limit-Text -Text ($parts -join "`n`n") -MaxChars $MaxChars
}

$globalHome = Resolve-GlobalHome -RepoRoot $coreRoot
$globalEnvPath = Join-Path $globalHome ".env"
$campaignRoot = if (-not [string]::IsNullOrWhiteSpace($CampaignPath)) { (Resolve-Path -LiteralPath $CampaignPath).Path } else { (Get-Location).Path }
$cwdEnvPath = Join-Path $campaignRoot ".env"

Import-DotEnvFile -FilePath $globalEnvPath
if ($cwdEnvPath -ne $globalEnvPath) {
    Import-DotEnvFile -FilePath $cwdEnvPath
}

$aiConfigPath = Join-Path $globalHome "ai-config.json"
$config = Load-Config -Path $aiConfigPath
$providerName = Resolve-ProviderName -Config $config -InputProvider $Provider
$providerConfig = $config.providers[$providerName]
if (-not [bool]$providerConfig.enabled) {
    throw "Provider '$providerName' is disabled. Run: gurpsai ai configure -Provider $providerName ..."
}

$runId = if (-not [string]::IsNullOrWhiteSpace($Resume)) { $Resume } else { New-RunId }
$runsRoot = Join-Path $campaignRoot ".framework/agent-runs"
Ensure-Dir -Path $runsRoot
$runDir = Join-Path $runsRoot $runId
Ensure-Dir -Path $runDir
$metaPath = Join-Path $runDir "meta.json"
$eventsPath = Join-Path $runDir "events.jsonl"
$finalPath = Join-Path $runDir "final.md"
$patchOutPath = Join-Path $runDir "patch.diff"
$errorPath = Join-Path $runDir "errors.log"

$meta = [ordered]@{
    run_id = $runId
    started_at_utc = [DateTime]::UtcNow.ToString("o")
    campaign_root = $campaignRoot
    core_root = $coreRoot
    provider = $providerName
    model = if (-not [string]::IsNullOrWhiteSpace($Model)) { $Model } else { [string]$providerConfig.model }
    task = $Task
    options = @{
        max_steps = $MaxSteps
        dry_run = [bool]$DryRun
        require_approval = [bool]$RequireApproval
    }
}
Write-JsonFile -Path $metaPath -Data $meta -Depth 16

$history = New-Object 'System.Collections.Generic.List[object]'
$history.Add([PSCustomObject]@{ role = "user"; content = $Task }) | Out-Null

$readRoots = @($campaignRoot, $coreRoot)
$systemPrompt = @"
You are a local coding agent operating through tools.
Return exactly one JSON object per turn, with no markdown and no extra text.
Use only this schema:
{"type":"tool_call","tool":"<name>","args":{...}}
or
{"type":"final","summary":"...","final_markdown":"..."}
or
{"type":"error","summary":"..."}

Rules:
- Prefer small, incremental tool calls.
- Never assume file contents; read/search first.
- Keep args minimal and valid.
- Stop with type=final when done.
"@

$lastPatch = $null
for ($step = 1; $step -le $MaxSteps; $step++) {
    $turnPrompt = @"
Task:
$Task

Run state:
- step: $step / $MaxSteps
- campaign_root: $campaignRoot
- dry_run: $([bool]$DryRun)
- require_approval: $([bool]$RequireApproval)

$(Get-ToolSpecsText)

Conversation so far:
$(Render-HistoryText -History $history)
"@

    Append-Event -EventFile $eventsPath -Payload @{
        ts_utc = [DateTime]::UtcNow.ToString("o")
        type = "model_request"
        step = $step
        prompt = Limit-Text -Text $turnPrompt
    }

    try {
        $modelResult = Invoke-ProviderRequest -ProviderConfig $providerConfig -ModelOverride $Model -PromptText $turnPrompt -SystemText $systemPrompt
        $modelText = [string]$modelResult.text
    } catch {
        $_ | Out-String | Set-Content -LiteralPath $errorPath -Encoding UTF8
        throw
    }

    Append-Event -EventFile $eventsPath -Payload @{
        ts_utc = [DateTime]::UtcNow.ToString("o")
        type = "model_response"
        step = $step
        text = Limit-Text -Text $modelText
    }

    $action = $null
    try {
        $action = Convert-TextToAction -Text $modelText
    } catch {
        $history.Add([PSCustomObject]@{ role = "assistant"; content = $modelText }) | Out-Null
        $history.Add([PSCustomObject]@{ role = "user"; content = "Invalid action JSON. Reply again using exact schema." }) | Out-Null
        continue
    }

    $actionType = [string]$action.type
    if ($actionType -eq "final") {
        $finalMarkdown = [string]$action.final_markdown
        $summary = [string]$action.summary
        if ([string]::IsNullOrWhiteSpace($finalMarkdown)) {
            $finalMarkdown = $summary
        }
        Set-Content -LiteralPath $finalPath -Value $finalMarkdown -Encoding UTF8
        Append-Event -EventFile $eventsPath -Payload @{
            ts_utc = [DateTime]::UtcNow.ToString("o")
            type = "final"
            step = $step
            summary = $summary
        }
        Write-Host "Agent run complete: $runId"
        Write-Host "Run dir: $runDir"
        Write-Host ""
        Write-Output $finalMarkdown
        exit 0
    }

    if ($actionType -eq "error") {
        $summary = [string]$action.summary
        if ([string]::IsNullOrWhiteSpace($summary)) {
            $summary = "Agent returned error without summary."
        }
        Set-Content -LiteralPath $errorPath -Value $summary -Encoding UTF8
        throw $summary
    }

    if ($actionType -ne "tool_call") {
        $history.Add([PSCustomObject]@{ role = "assistant"; content = $modelText }) | Out-Null
        $history.Add([PSCustomObject]@{ role = "user"; content = "Unknown action type. Use tool_call|final|error." }) | Out-Null
        continue
    }

    $toolName = [string]$action.tool
    $toolArgs = $action.args
    if ($null -eq $toolArgs) {
        $toolArgs = @{}
    }

    Append-Event -EventFile $eventsPath -Payload @{
        ts_utc = [DateTime]::UtcNow.ToString("o")
        type = "tool_call"
        step = $step
        tool = $toolName
        args = $toolArgs
    }

    try {
        $toolResult = Execute-ToolCall -ToolName $toolName -ArgsObj $toolArgs -CampaignRoot $campaignRoot -CoreRoot $coreRoot -ReadRoots $readRoots -DryRun:$DryRun -RequireApproval:$RequireApproval
        if ($toolName -eq "apply_patch" -and $null -ne $toolArgs.patch_text) {
            $lastPatch = [string]$toolArgs.patch_text
        }
    } catch {
        $toolResult = @{
            error = $_.Exception.Message
        }
    }

    $toolResultJson = $toolResult | ConvertTo-Json -Depth 16
    Append-Event -EventFile $eventsPath -Payload @{
        ts_utc = [DateTime]::UtcNow.ToString("o")
        type = "tool_result"
        step = $step
        tool = $toolName
        result = Limit-Text -Text $toolResultJson
    }

    $history.Add([PSCustomObject]@{
        role = "assistant"
        content = ($action | ConvertTo-Json -Depth 16 -Compress)
    }) | Out-Null
    $history.Add([PSCustomObject]@{
        role = "user"
        content = ("Tool result for {0}: {1}" -f $toolName, (Limit-Text -Text $toolResultJson -MaxChars 12000))
    }) | Out-Null
}

if (-not [string]::IsNullOrWhiteSpace($lastPatch)) {
    Set-Content -LiteralPath $patchOutPath -Value $lastPatch -Encoding UTF8
}

$timeoutMessage = "Agent did not finish within max steps ($MaxSteps). Review run logs at $runDir."
Set-Content -LiteralPath $errorPath -Value $timeoutMessage -Encoding UTF8
throw $timeoutMessage

[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonScript = Join-Path $scriptRoot "python/gurpsai.py"
$legacyScript = Join-Path $scriptRoot "legacy/ai.ps1"

function Find-PythonExecutable {
    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($env:GURPSAI_PYTHON)) {
        $candidates += $env:GURPSAI_PYTHON
    }
    $candidates += @("python", "python3")

    foreach ($candidate in $candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }
        try {
            & $candidate --version *> $null
            if ($LASTEXITCODE -eq 0) {
                return $candidate
            }
        } catch {
            continue
        }
    }
    return $null
}

$pythonExe = Find-PythonExecutable
if ($pythonExe -and (Test-Path -LiteralPath $pythonScript -PathType Leaf)) {
    & $pythonExe $pythonScript "ai" @Args
    exit $LASTEXITCODE
}

if (-not (Test-Path -LiteralPath $legacyScript -PathType Leaf)) {
    throw "Missing legacy script fallback: $legacyScript"
}

& powershell -ExecutionPolicy Bypass -File $legacyScript @Args
exit $LASTEXITCODE

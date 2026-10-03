<#
.SYNOPSIS
  Start the whole app for development — backend, frontend, and a browser — from one command.

.DESCRIPTION
  Running the app by hand means two terminals, an environment variable, and
  remembering which port is which. This does all of it, waits until both servers
  actually answer, opens the browser, and streams both logs into one window
  prefixed [api] and [web].

  Ctrl+C stops both. Nothing is left running behind your back — that was the
  failure mode of starting them in separate windows.

  The backend is launched as `python -m uvicorn` with PYTHONPATH=src rather than
  the installed `gurpsai` console script, so it runs the code in this working
  tree whether or not the package is currently pip-installed.

.PARAMETER Stop
  Kill whatever is already listening on the two ports and exit. Use this when a
  previous run was orphaned — a closed window, a hard kill.

.PARAMETER NoBrowser
  Start both servers but don't open a browser tab.

.PARAMETER NoReload
  Turn off backend autoreload. Slightly faster to start; needs a restart to pick
  up Python changes.

.PARAMETER Install
  Run `npm install` before starting, even if node_modules is already there.

.EXAMPLE
  .\dev.cmd
  Start everything with the defaults.

.EXAMPLE
  .\scripts\dev.ps1 -Stop
  Clean up an orphaned pair of servers.
#>
[CmdletBinding()]
param(
  [int]$ApiPort = 8000,
  [int]$WebPort = 5173,
  [switch]$NoBrowser,
  [switch]$NoReload,
  [switch]$Install,
  [switch]$Stop
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root '.dev-logs'
$web = Join-Path $root 'web'

# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

function Write-Step([string]$text) { Write-Host "  $text" -ForegroundColor Cyan }
function Write-Warn([string]$text) { Write-Host "  $text" -ForegroundColor Yellow }
function Write-Bad ([string]$text) { Write-Host "  $text" -ForegroundColor Red }

function Get-PortOwner([int]$port) {
  # Get-NetTCPConnection is the clean way; netstat is the fallback for when the
  # cmdlet is unavailable or the connection table is being awkward.
  try {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop
    if ($conn) { return @($conn | Select-Object -ExpandProperty OwningProcess -Unique) }
  } catch {
    $lines = netstat -ano -p TCP | Select-String ":$port\s.*LISTENING"
    if ($lines) {
      return @($lines | ForEach-Object { ($_ -split '\s+')[-1] } | Sort-Object -Unique)
    }
  }
  return @()
}

function Stop-Port([int]$port, [string]$label) {
  $owners = Get-PortOwner $port
  if (-not $owners) { return $false }
  foreach ($procId in $owners) {
    Write-Step "stopping $label on port $port (pid $procId)"
    # /T because npm spawns node and killing only the parent orphans the child.
    & taskkill /T /F /PID $procId | Out-Null
  }
  return $true
}

function Wait-ForPort([int]$port, [System.Diagnostics.Process]$proc, [string]$label, [int]$timeoutSeconds = 90) {
  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  while ($watch.Elapsed.TotalSeconds -lt $timeoutSeconds) {
    if ($proc -and $proc.HasExited) {
      Write-Bad "$label exited before it started listening (exit code $($proc.ExitCode))."
      return $false
    }
    $client = New-Object System.Net.Sockets.TcpClient
    try {
      $client.Connect('127.0.0.1', $port)
      return $true
    } catch {
      # not up yet
    } finally {
      $client.Dispose()
    }
    Drain-Logs
    Start-Sleep -Milliseconds 250
  }
  Write-Bad "$label did not answer on port $port within $timeoutSeconds seconds."
  return $false
}

# Tail several files from one thread: remember how far we have read into each,
# then print whatever is new. Keeps Ctrl+C responsive, which background jobs
# and Get-Content -Wait do not.
$script:offsets = @{}
$script:sources = @()

function Add-LogSource([string]$label, [string]$path, [string]$color) {
  $script:sources += [pscustomobject]@{ Label = $label; Path = $path; Color = $color }
  $script:offsets[$path] = 0
}

function Drain-Logs {
  foreach ($source in $script:sources) {
    if (-not (Test-Path $source.Path)) { continue }
    $text = ''
    try {
      $stream = [System.IO.File]::Open(
        $source.Path,
        [System.IO.FileMode]::Open,
        [System.IO.FileAccess]::Read,
        [System.IO.FileShare]::ReadWrite
      )
    } catch {
      continue
    }
    try {
      if ($stream.Length -lt $script:offsets[$source.Path]) { $script:offsets[$source.Path] = 0 }
      $null = $stream.Seek($script:offsets[$source.Path], [System.IO.SeekOrigin]::Begin)
      $reader = New-Object System.IO.StreamReader($stream)
      $text = $reader.ReadToEnd()
      $script:offsets[$source.Path] = $stream.Length
    } finally {
      $stream.Dispose()
    }
    if (-not $text) { continue }
    foreach ($line in ($text -split "`r?`n")) {
      if ($line.Trim()) {
        Write-Host ("[{0}] " -f $source.Label) -ForegroundColor $source.Color -NoNewline
        Write-Host $line
      }
    }
  }
}

# --------------------------------------------------------------------------
# -Stop: clean up and leave
# --------------------------------------------------------------------------

if ($Stop) {
  $killedApi = Stop-Port $ApiPort 'backend'
  $killedWeb = Stop-Port $WebPort 'frontend'
  if (-not ($killedApi -or $killedWeb)) { Write-Step 'nothing was listening on either port' }
  exit 0
}

# --------------------------------------------------------------------------
# preflight
# --------------------------------------------------------------------------

Write-Host ''
Write-Host 'GURPS Assistant - dev' -ForegroundColor White

foreach ($tool in @('python', 'npm')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    Write-Bad "$tool is not on PATH. Install it, or open a shell where it is."
    exit 1
  }
}

foreach ($port in @(@{ P = $ApiPort; N = 'backend' }, @{ P = $WebPort; N = 'frontend' })) {
  if (Get-PortOwner $port.P) {
    Write-Bad "port $($port.P) is already in use ($($port.N))."
    Write-Warn "if that is a leftover from an earlier run:  .\scripts\dev.ps1 -Stop"
    exit 1
  }
}

if (-not (Test-Path (Join-Path $root '.env'))) {
  Write-Warn 'no .env in the repo root - AI features will fail until you copy .env.example and add a key'
}

if ($Install -or -not (Test-Path (Join-Path $web 'node_modules'))) {
  Write-Step 'npm install'
  Push-Location $web
  try {
    & npm install
    if ($LASTEXITCODE -ne 0) { Write-Bad 'npm install failed.'; exit 1 }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $logDir)) { $null = New-Item -ItemType Directory -Path $logDir }

$apiOut = Join-Path $logDir 'api.out.log'
$apiErr = Join-Path $logDir 'api.err.log'
$webOut = Join-Path $logDir 'web.out.log'
$webErr = Join-Path $logDir 'web.err.log'
foreach ($file in @($apiOut, $apiErr, $webOut, $webErr)) { Set-Content -Path $file -Value '' -Encoding utf8 }

# uvicorn logs to stderr, vite to stdout; tail all four rather than guess.
Add-LogSource 'api' $apiErr 'DarkCyan'
Add-LogSource 'api' $apiOut 'DarkCyan'
Add-LogSource 'web' $webErr 'DarkYellow'
Add-LogSource 'web' $webOut 'DarkYellow'

# --------------------------------------------------------------------------
# start
# --------------------------------------------------------------------------

$apiProc = $null
$webProc = $null

try {
  $env:PYTHONPATH = 'src'

  $apiArgs = @(
    '-m', 'uvicorn', 'gurpsai.api.main:app',
    '--host', '127.0.0.1',
    '--port', "$ApiPort"
  )
  if (-not $NoReload) { $apiArgs += '--reload' }

  Write-Step "backend  -> http://127.0.0.1:$ApiPort"
  $apiProc = Start-Process -FilePath 'python' -ArgumentList $apiArgs `
    -WorkingDirectory $root -NoNewWindow -PassThru `
    -RedirectStandardOutput $apiOut -RedirectStandardError $apiErr

  Write-Step "frontend -> http://127.0.0.1:$WebPort"
  # Ask for npm.cmd by name: plain `npm` resolves to npm.ps1 on this machine,
  # which Start-Process cannot launch ("%1 is not a valid Win32 application").
  $npm = Get-Command 'npm.cmd' -ErrorAction SilentlyContinue
  if ($npm) { $npmPath = $npm.Source } else { $npmPath = 'npm.cmd' }
  $webProc = Start-Process -FilePath $npmPath -ArgumentList @('run', 'dev', '--', '--port', "$WebPort") `
    -WorkingDirectory $web -NoNewWindow -PassThru `
    -RedirectStandardOutput $webOut -RedirectStandardError $webErr

  if (-not (Wait-ForPort $ApiPort $apiProc 'backend')) { exit 1 }
  if (-not (Wait-ForPort $WebPort $webProc 'frontend')) { exit 1 }

  # The port answering is not the same as the app working; /health proves the
  # campaign loaded and tells us which version is actually running.
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$ApiPort/health" -TimeoutSec 10
    Write-Step "backend healthy - version $($health.version)"
  } catch {
    Write-Warn 'backend is listening but /health did not answer cleanly'
  }

  Write-Host ''
  Write-Host "  ready - http://localhost:$WebPort" -ForegroundColor Green
  Write-Host '  Ctrl+C stops both servers.' -ForegroundColor DarkGray
  Write-Host ''

  if (-not $NoBrowser) { Start-Process "http://localhost:$WebPort" }

  while ($true) {
    if ($apiProc.HasExited) { Drain-Logs; Write-Bad 'backend exited.'; break }
    if ($webProc.HasExited) { Drain-Logs; Write-Bad 'frontend exited.'; break }
    Drain-Logs
    Start-Sleep -Milliseconds 300
  }
} finally {
  Write-Host ''
  Write-Step 'shutting down'
  foreach ($proc in @($apiProc, $webProc)) {
    if ($proc -and -not $proc.HasExited) {
      & taskkill /T /F /PID $proc.Id 2>$null | Out-Null
    }
  }
  # npm/vite sometimes survives its parent; make sure the ports are actually free.
  $null = Stop-Port $ApiPort 'backend'
  $null = Stop-Port $WebPort 'frontend'
  Write-Step "logs kept in .dev-logs\"
}

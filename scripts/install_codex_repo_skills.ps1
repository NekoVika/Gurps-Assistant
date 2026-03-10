[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$SourceRoot = (Join-Path $PSScriptRoot "..\\skills"),
  [string]$DestinationRoot,
  [string]$Namespace = "",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

function Resolve-CodexSkillsRoot {
  param([string]$ExplicitRoot)

  if ($ExplicitRoot) {
    return (Resolve-Path -Path $ExplicitRoot).Path
  }

  if ($env:CODEX_HOME) {
    $codexHome = (Resolve-Path -Path $env:CODEX_HOME).Path
    $maybeSkills = Join-Path $codexHome "skills"
    if (Test-Path $maybeSkills) { return $maybeSkills }
    if ((Split-Path $codexHome -Leaf) -ieq "skills") { return $codexHome }
  }

  return (Join-Path $env:USERPROFILE ".codex\\skills")
}

$sourceRootResolved = (Resolve-Path -Path $SourceRoot).Path
$skillsRoot = Resolve-CodexSkillsRoot -ExplicitRoot $DestinationRoot

if (-not (Test-Path $skillsRoot)) {
  if ($PSCmdlet.ShouldProcess($skillsRoot, "Create Codex skills directory")) {
    New-Item -ItemType Directory -Force -Path $skillsRoot | Out-Null
  }
}

$skillDirs = Get-ChildItem -Path $sourceRootResolved -Directory
if (-not $skillDirs) {
  throw "No repo skills found under: $sourceRootResolved"
}

foreach ($skillDir in $skillDirs) {
  $destBase = $skillsRoot
  if ($Namespace) {
    $destBase = Join-Path $skillsRoot $Namespace
  }

  $destPath = Join-Path $destBase $skillDir.Name

  if ((Test-Path $destPath) -and (-not $Force)) {
    Write-Host "Skip (already exists): $destPath  (use -Force to overwrite)"
    continue
  }

  if ($PSCmdlet.ShouldProcess($destPath, "Install repo skill '$($skillDir.Name)'")) {
    New-Item -ItemType Directory -Force -Path $destBase | Out-Null
    if (Test-Path $destPath) {
      Remove-Item -Recurse -Force -Path $destPath
    }
    Copy-Item -Recurse -Force -Path $skillDir.FullName -Destination $destPath
    Write-Host "Installed: $destPath"
  }
}

Write-Host "Done. Restart Codex CLI to refresh skill discovery if needed."


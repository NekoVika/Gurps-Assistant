$ErrorActionPreference = 'Stop'

function Get-CharacterFiles {
  param(
    [string]$Root = 'Campaign/02_Characters'
  )

  if (-not (Test-Path $Root)) {
    throw "Missing characters root: $Root"
  }

  $mainCast = Get-ChildItem -Recurse -File -Filter *.md (Join-Path $Root 'Main_Cast') -ErrorAction SilentlyContinue
  $bestiary = Get-ChildItem -Recurse -File -Filter *.md (Join-Path $Root 'Bestiary') -ErrorAction SilentlyContinue

  [pscustomobject]@{
    MainCast = @($mainCast)
    Bestiary = @($bestiary)
  }
}

function Assert-HasMetaLine {
  param(
    [string]$Content,
    [string]$Key,
    [string]$Path
  )

  $pattern = "(?m)^\*\*$([regex]::Escape($Key)):\*\*"
  if ($Content -notmatch $pattern) {
    throw "[$Path] Missing meta line: **${Key}:**"
  }
}

function Assert-HasSection {
  param(
    [string]$Content,
    [string]$Title,
    [string]$Path
  )

  $pattern = "(?m)^##\s+$([regex]::Escape($Title))\s*$"
  if ($Content -notmatch $pattern) {
    throw "[$Path] Missing section heading: ## $Title"
  }
}

function Assert-NotHasSectionPrefix {
  param(
    [string]$Content,
    [string]$Prefix,
    [string]$Path
  )

  $pattern = "(?m)^##\s+$([regex]::Escape($Prefix))"
  if ($Content -match $pattern) {
    throw "[$Path] Forbidden section heading present: ## $Prefix..."
  }
}

function Assert-NotHasPattern {
  param(
    [string]$Content,
    [string]$Pattern,
    [string]$Message,
    [string]$Path
  )

  if ($Content -match $Pattern) {
    throw "[$Path] $Message"
  }
}

$files = Get-CharacterFiles

$mainMeta = @('Significance', 'Role', 'Location', 'Continuity', 'Status')
$mainSections = @(
  'Narrative & Roleplay',
  'GURPS 4e Statistics',
  'Tactics & Combat Style',
  'PC Hooks',
  'GM Summary (Raw Archive)',
  'Assumptions & Open Questions'
)

$bestiaryMeta = @('Significance', 'Role', 'Location', 'Continuity')
$bestiarySections = @(
  'Narrative & Roleplay',
  'GURPS 4e Statistics',
  'Variations (Significance 0 Only)',
  'Tactics & Combat Style',
  'PC Hooks',
  'GM Summary (Raw Archive)',
  'Assumptions & Open Questions'
)

$problems = New-Object System.Collections.Generic.List[string]

foreach ($file in $files.MainCast) {
  $path = $file.FullName
  $rel = $path.Replace((Get-Location).Path + '\', '')
  $content = Get-Content $path -Raw

  try {
    foreach ($m in $mainMeta) { Assert-HasMetaLine -Content $content -Key $m -Path $rel }
    foreach ($s in $mainSections) { Assert-HasSection -Content $content -Title $s -Path $rel }
    Assert-NotHasSectionPrefix -Content $content -Prefix 'Variations' -Path $rel
    Assert-NotHasPattern -Content $content -Pattern '(?m)^\*\*Status \(Omit for Bestiary\):\*\*' -Message 'Uses deprecated Status label with Bestiary note.' -Path $rel
  } catch {
    $problems.Add($_.Exception.Message) | Out-Null
  }
}

foreach ($file in $files.Bestiary) {
  $path = $file.FullName
  $rel = $path.Replace((Get-Location).Path + '\', '')
  $content = Get-Content $path -Raw

  try {
    foreach ($m in $bestiaryMeta) { Assert-HasMetaLine -Content $content -Key $m -Path $rel }
    foreach ($s in $bestiarySections) { Assert-HasSection -Content $content -Title $s -Path $rel }
    Assert-NotHasPattern -Content $content -Pattern '(?m)^\*\*Status:\*\*' -Message 'Bestiary entry must not include **Status:**' -Path $rel
  } catch {
    $problems.Add($_.Exception.Message) | Out-Null
  }
}

if ($problems.Count -gt 0) {
  $problems | Sort-Object | Get-Unique | ForEach-Object { Write-Error $_ }
  exit 1
}

Write-Host "OK: Character files match templates (Main_Cast + Bestiary)."

param(
  [string]$Campaign = 'Campaign',
  [string]$Contracts = '.planning/contracts',
  [string]$Out = 'Campaign/_reports',
  [string]$Format = 'json,md',
  [switch]$StrictUnknown,
  [switch]$FailOnWarnings,
  [string[]]$OnlyContract = @()
)

$ErrorActionPreference = 'Stop'

$argsList = @(
  'scripts/validate.py',
  '--campaign', $Campaign,
  '--contracts', $Contracts,
  '--out', $Out,
  '--format', $Format
)

if ($StrictUnknown) { $argsList += '--strict-unknown' }
if ($FailOnWarnings) { $argsList += '--fail-on-warnings' }
foreach ($id in $OnlyContract) { $argsList += @('--only-contract', $id) }

python @argsList
exit $LASTEXITCODE

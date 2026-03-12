param(
  [string]$Gcs = '',
  [string]$Md = '',
  [switch]$Sort
)

$ErrorActionPreference = 'Stop'

$argsList = @('scripts/sync_pc_from_gcs.py')

if ($Gcs) { $argsList += $Gcs }
if ($Md) { $argsList += @('--md', $Md) }
if ($Sort) { $argsList += '--sort' }

python @argsList
exit $LASTEXITCODE

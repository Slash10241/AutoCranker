# Reset SQLite demo data to a single "Brake noise" case.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
uv run python scripts/reset_db.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

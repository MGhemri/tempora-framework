# TEMPORA Desktop installer with embedded Microsoft WebView2 bootstrapper.
# Network access is required only when WebView2 Evergreen is missing.
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location $root
try {
  if (-not (Test-Path -LiteralPath 'src-tauri/Cargo.lock' -PathType Leaf)) { throw 'CARGO_LOCK_REQUIRED' }
  & npm run stage:windows-engine
  if ($LASTEXITCODE -ne 0) { throw 'ENGINE_STAGE_FAILED' }
  & npx --no-install tauri build --config src-tauri/tauri.windows.conf.json --config src-tauri/tauri.windows.online.conf.json -- --locked
  if ($LASTEXITCODE -ne 0) { throw 'ONLINE_WEBVIEW_INSTALLER_BUILD_FAILED' }
  & git diff --exit-code -- src-tauri/Cargo.lock
  if ($LASTEXITCODE -ne 0) { throw 'CARGO_LOCK_MODIFIED' }
  Write-Host 'Online NSIS built with WebView2 Embedded Bootstrapper, not an offline installer.'
} finally { Pop-Location }

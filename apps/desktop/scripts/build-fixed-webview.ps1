# Manual, opt-in experiment. Requires an authentic Microsoft WebView2 Fixed
# Version x64 CAB and its independently verified SHA-256 digest.
param(
  [Parameter(Mandatory=$true)][string]$CabPath,
  [Parameter(Mandatory=$true)][string]$ExpectedSha256
)
$ErrorActionPreference = 'Stop'
$here = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location $here
try {
  if (-not (Test-Path -LiteralPath 'src-tauri/Cargo.lock' -PathType Leaf)) {
    throw 'CARGO_LOCK_REQUIRED'
  }
  & (Join-Path $PSScriptRoot 'stage-fixed-webview.ps1') -CabPath $CabPath -ExpectedSha256 $ExpectedSha256
  if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw 'WEBVIEW_STAGING_FAILED' }
  & npm run stage:windows-engine
  if ($LASTEXITCODE -ne 0) { throw 'EMBEDDED_ENGINE_STAGE_FAILED' }
  & npx --no-install tauri build --config src-tauri/tauri.windows.conf.json --config src-tauri/tauri.windows.fixed.conf.json -- --locked
  if ($LASTEXITCODE -ne 0) { throw 'FIXED_WEBVIEW_BUILD_FAILED' }
  & git diff --exit-code -- src-tauri/Cargo.lock
  if ($LASTEXITCODE -ne 0) { throw 'CARGO_LOCK_MODIFIED' }
  Write-Host 'Fixed WebView2 experiment compiled; installed-sandbox GUI validation still required.'
} finally {
  Pop-Location
}

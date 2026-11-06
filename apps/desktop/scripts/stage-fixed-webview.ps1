param(
  [Parameter(Mandatory=$true)][string]$CabPath,
  [Parameter(Mandatory=$true)][string]$ExpectedSha256
)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $CabPath -ErrorAction Stop).Path
if ($ExpectedSha256 -notmatch '^[a-fA-F0-9]{64}$') { throw 'INVALID_WEBVIEW_CAB_SHA256' }
$actual = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $ExpectedSha256.ToLowerInvariant()) { throw 'WEBVIEW_CAB_SHA256_MISMATCH' }
$target = Join-Path $PSScriptRoot '../src-tauri/resources/webview2-fixed'
$target = [System.IO.Path]::GetFullPath($target)
if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
New-Item -ItemType Directory -Path $target -Force | Out-Null
$staging = Join-Path $env:TEMP ('tempora-webview2-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging -Force | Out-Null
try {
  & expand.exe '-F:*' $source $staging | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'WEBVIEW_CAB_EXPANSION_FAILED' }
  $binaries = @(Get-ChildItem -LiteralPath $staging -Recurse -File -Filter msedgewebview2.exe)
  if ($binaries.Count -ne 1) { throw 'WEBVIEW_FIXED_RUNTIME_EXECUTABLE_NOT_UNIQUE' }
  $root = $binaries[0].Directory.FullName
  Copy-Item -Path (Join-Path $root '*') -Destination $target -Recurse -Force
  if (-not (Test-Path (Join-Path $target 'msedgewebview2.exe') -PathType Leaf)) { throw 'WEBVIEW_FIXED_RUNTIME_STAGING_FAILED' }
  Write-Host "Verified fixed WebView2 CAB SHA256: $actual"
  Write-Host "Fixed Runtime staged at: $target"
} finally {
  Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
}

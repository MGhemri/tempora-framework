$ErrorActionPreference = 'Continue'
Write-Host 'TEMPORA Windows WebView2 diagnostic (read-only)'
Write-Host "Windows: $([System.Environment]::OSVersion.VersionString)"
Write-Host "User: $([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)"
$keys = @(
  'HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
  'HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
)
Write-Host "Processor architecture: $env:PROCESSOR_ARCHITECTURE"
Write-Host "64-bit process: $([Environment]::Is64BitProcess)"
Write-Host "64-bit OS: $([Environment]::Is64BitOperatingSystem)"
foreach ($key in $keys) {
  $obj = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
  if ($null -ne $obj) {
    $v = [string]$obj.pv
    Write-Host "Registry $key: pv=$v"
    if (-not $v -or $v -eq '0.0.0.0') { Write-Host "WARNING: Empty/zero WebView2 runtime registration" }
  }
  else { Write-Host "Registry $key: not found" }
}
foreach ($name in @('WEBVIEW2_BROWSER_EXECUTABLE_FOLDER','WEBVIEW2_USER_DATA_FOLDER','WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS')) {
  Write-Host ("Environment {0}: {1}" -f $name,[Environment]::GetEnvironmentVariable($name))
}
$processes = @(Get-Process msedgewebview2 -ErrorAction SilentlyContinue)
Write-Host "WebView2 running process count: $($processes.Count)"
Write-Host 'No system settings have been changed.'

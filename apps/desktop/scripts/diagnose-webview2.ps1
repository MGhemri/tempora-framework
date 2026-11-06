$ErrorActionPreference = 'Continue'
Write-Host 'TEMPORA Windows WebView2 diagnostic (read-only)'
Write-Host "Windows: $([System.Environment]::OSVersion.VersionString)"
Write-Host "User: $([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)"
$keys = @(
  'HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F1E7D8D0-5B6A-4D0C-8A62-CC799A23F9B0}',
  'HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F1E7D8D0-5B6A-4D0C-8A62-CC799A23F9B0}',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F1E7D8D0-5B6A-4D0C-8A62-CC799A23F9B0}'
)
foreach ($key in $keys) {
  $obj = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
  if ($null -ne $obj) { Write-Host "Registry $key: pv=$($obj.pv)" }
  else { Write-Host "Registry $key: not found" }
}
foreach ($name in @('WEBVIEW2_BROWSER_EXECUTABLE_FOLDER','WEBVIEW2_USER_DATA_FOLDER','WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS')) {
  Write-Host ("Environment {0}: {1}" -f $name,[Environment]::GetEnvironmentVariable($name))
}
$processes = @(Get-Process msedgewebview2 -ErrorAction SilentlyContinue)
Write-Host "WebView2 running process count: $($processes.Count)"
Write-Host 'No system settings have been changed.'

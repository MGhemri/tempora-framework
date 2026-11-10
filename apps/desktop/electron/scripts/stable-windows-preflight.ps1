# TEMPORA Desktop 1.0.0 — non-destructive Windows release evidence.
# Never installs, updates, launches or removes software or user corpora.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('Inventory','BeforeUpgrade','AfterUpgrade')]
  [string]$Phase,
  [Parameter(Mandatory=$true)][string]$ReportPath,
  [string]$BaselinePath,
  [string]$NsisInstaller,
  [switch]$RequireValidNsisSignature
)
$ErrorActionPreference='Stop'
if (-not $IsWindows -and $env:OS -cne 'Windows_NT') {
  throw 'TEMPORA_PREFLIGHT_WINDOWS_ONLY'
}
if ($Phase -eq 'AfterUpgrade' -and [string]::IsNullOrWhiteSpace($BaselinePath)) {
  throw 'TEMPORA_UPGRADE_BASELINE_REQUIRED'
}
if ($RequireValidNsisSignature -and [string]::IsNullOrWhiteSpace($NsisInstaller)) {
  throw 'TEMPORA_INSTALLER_PATH_REQUIRED'
}
$os=Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
$packages=@(Get-AppxPackage -Name 'GhemriM.TEMPORADesktop' -ErrorAction Stop)
if ($packages.Count -gt 1) { throw 'TEMPORA_MULTIPLE_STORE_PACKAGES' }
$store=$null
if ($packages.Count -eq 1) {
  $p=$packages[0]
  if ([string]$p.Name -cne 'GhemriM.TEMPORADesktop' -or
      [string]$p.PackageFamilyName -cne 'GhemriM.TEMPORADesktop_y8h1gbsk7napw') {
    throw 'TEMPORA_STORE_IDENTITY_MISMATCH'
  }
  $store=[ordered]@{
    name=[string]$p.Name
    version=[string]$p.Version
    package_family_name=[string]$p.PackageFamilyName
    architecture=[string]$p.Architecture
  }
}
if ($Phase -ne 'Inventory' -and $null -eq $store) {
  throw 'TEMPORA_STORE_INSTALLATION_REQUIRED'
}
if ($Phase -eq 'BeforeUpgrade' -and $store.version -notmatch '^0[.]2[.]0[.][0-9]+$') {
  throw 'TEMPORA_BASELINE_MUST_BE_STORE_0_2_0'
}
if ($Phase -eq 'AfterUpgrade') {
  if ($store.version -notmatch '^1[.]0[.]0[.][0-9]+$') {
    throw 'TEMPORA_UPGRADE_MUST_BE_STORE_1_0_0'
  }
  if (-not (Test-Path -LiteralPath $BaselinePath -PathType Leaf)) {
    throw 'TEMPORA_UPGRADE_BASELINE_FILE_MISSING'
  }
  $before=Get-Content -LiteralPath $BaselinePath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($before.schema_version -cne 'tempora-windows-release-preflight-v1' -or
      $before.phase -cne 'BeforeUpgrade' -or
      $before.store.version -notmatch '^0[.]2[.]0[.][0-9]+$' -or
      $before.store.package_family_name -cne $store.package_family_name) {
    throw 'TEMPORA_UPGRADE_PACKAGE_FAMILY_CHANGED_OR_BASELINE_INVALID'
  }
}
$installer=$null
if (-not [string]::IsNullOrWhiteSpace($NsisInstaller)) {
  $full=(Resolve-Path -LiteralPath $NsisInstaller -ErrorAction Stop).Path
  if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
    throw 'TEMPORA_NSIS_FILE_MISSING'
  }
  $signature=Get-AuthenticodeSignature -LiteralPath $full -ErrorAction Stop
  $hash=(Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($RequireValidNsisSignature -and $signature.Status -ne 'Valid') {
    throw 'TEMPORA_NSIS_AUTHENTICODE_INVALID'
  }
  $installer=[ordered]@{
    file_name=[IO.Path]::GetFileName($full)
    sha256=$hash
    authenticode_status=[string]$signature.Status
    signature_is_valid=($signature.Status -eq 'Valid')
  }
}
$report=[ordered]@{
  schema_version='tempora-windows-release-preflight-v1'
  phase=$Phase
  windows_caption=[string]$os.Caption
  windows_version=[string]$os.Version
  windows_build=[string]$os.BuildNumber
  os_architecture=[string]$os.OSArchitecture
  store=$store
  nsis=$installer
  no_installation_or_software_change_performed=$true
  no_user_corpus_or_personal_file_contents_collected=$true
  clean_vm_status='not_attested_by_script'
  offline_gui_acceptance='manual_not_verified'
  research_data_migration='manual_not_verified'
  microsoft_store_publication='not_performed'
}
$path=[IO.Path]::GetFullPath($ReportPath)
$parent=Split-Path -Path $path -Parent
if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
}
$report | ConvertTo-Json -Depth 6 |
  Set-Content -LiteralPath $path -Encoding UTF8
Write-Host ('TEMPORA Windows inventory recorded: '+$path)
Write-Host ('Phase: '+$Phase+'; Store: '+ $(if ($store) {$store.version} else {'not installed'}))
Write-Host 'This inventory does NOT attest clean-VM, upgrade data safety or certification.'

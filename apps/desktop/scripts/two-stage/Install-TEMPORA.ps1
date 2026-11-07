# TEMPORA Windows experimental two-stage installer orchestrator
# 1) Install/detect Microsoft Evergreen WebView2 in the current Windows session.
# 2) Only after verification, run the independent TEMPORA NSIS installer.
# This does not modify TEMPORA, registry keys, or bypass Microsoft installation.
[CmdletBinding()]
param(
  [string]$WebView2InstallerPath = '',
  [string]$TemporaInstallerPath = '',
  [string]$ExpectedWebView2Sha256 = '',
  [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$clientGuid = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Get-WebView2Version {
  # Microsoft-documented Evergreen registration paths (per-user and per-machine).
  $paths = @(
    "Registry::HKEY_CURRENT_USER\SOFTWARE\Microsoft\EdgeUpdate\Clients\$clientGuid",
    "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$clientGuid",
    "Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\EdgeUpdate\Clients\$clientGuid"
  )
  foreach ($path in $paths) {
    $value = Get-ItemProperty -LiteralPath $path -Name pv -ErrorAction SilentlyContinue
    if ($null -ne $value) {
      $raw = [string]$value.pv
      $version = [version]'0.0.0.0'
      if ([version]::TryParse($raw, [ref]$version) -and $version -gt [version]'0.0.0.0') {
        return $raw
      }
    }
  }
  return $null
}

function Resolve-LocalInstaller([string]$supplied, [string]$filePattern, [string]$label) {
  if ($supplied) {
    if (-not (Test-Path -LiteralPath $supplied -PathType Leaf)) { throw "${label}_FILE_MISSING" }
    return (Resolve-Path -LiteralPath $supplied).Path
  }
  $candidates = @(Get-ChildItem -LiteralPath $scriptDir -File -Filter $filePattern -ErrorAction SilentlyContinue)
  if ($candidates.Count -ne 1) {
    throw "${label}_MISSING_OR_AMBIGUOUS: expected one $filePattern next to installer"
  }
  return $candidates[0].FullName
}

function Assert-MicrosoftInstaller([string]$path) {
  if ($ExpectedWebView2Sha256) {
    if ($ExpectedWebView2Sha256 -notmatch '^[a-fA-F0-9]{64}$') {
      throw 'INVALID_EXPECTED_MICROSOFT_SHA256'
    }
    $actual = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $ExpectedWebView2Sha256.ToLowerInvariant()) {
      throw 'MICROSOFT_WEBVIEW2_SHA256_MISMATCH'
    }
  }
  $signature = Get-AuthenticodeSignature -LiteralPath $path
  if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid -or
      $null -eq $signature.SignerCertificate -or
      $signature.SignerCertificate.Subject -notmatch '(^|,)\s*(CN|O)=Microsoft Corporation(,|$)') {
    throw 'MICROSOFT_WEBVIEW2_AUTHENTICODE_NOT_VALID'
  }
}

try {
  Write-Host 'TEMPORA / Etape 1 sur 2 : verification de Microsoft Edge WebView2 Runtime'
  $installed = Get-WebView2Version
  if ($installed) {
    Write-Output "WEBVIEW2_READY: $installed"
  } elseif ($CheckOnly) {
    Write-Output 'WEBVIEW2_NOT_INSTALLED'
  } else {
    $runtimeExe = Resolve-LocalInstaller $WebView2InstallerPath 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe' 'MICROSOFT_WEBVIEW2_INSTALLER'
    Assert-MicrosoftInstaller $runtimeExe
    Write-Host "Microsoft official standalone installer: $runtimeExe"
    $process = Start-Process -FilePath $runtimeExe -ArgumentList @('/silent','/install') -Wait -PassThru
    if ($process.ExitCode -eq 3010) {
      throw 'WEBVIEW2_RESTART_REQUIRED: restart Windows, then rerun INSTALL_TEMPORA.cmd'
    }
    if ($process.ExitCode -ne 0) {
      throw "WEBVIEW2_INSTALL_FAILED: exit code $($process.ExitCode)"
    }
    # Edge Update may register the newly installed runtime shortly after the installer exits.
    $installed = Get-WebView2Version
    for ($attempt = 0; $attempt -lt 10 -and -not $installed; $attempt++) {
      Start-Sleep -Seconds 2
      $installed = Get-WebView2Version
    }
    if (-not $installed) {
      throw 'WEBVIEW2_NOT_REGISTERED_AFTER_INSTALL: TEMPORA installation blocked'
    }
    Write-Output "WEBVIEW2_READY_AFTER_INSTALL: $installed"
  }
  if ($CheckOnly) { return }
  Write-Host 'TEMPORA / Etape 2 sur 2 : installation de TEMPORA Desktop'
  if (-not $installed) {
    throw 'WEBVIEW2_PREREQUISITE_NOT_MET: refusing to start TEMPORA setup'
  }
  $temporaExe = Resolve-LocalInstaller $TemporaInstallerPath '*setup.exe' 'TEMPORA_NSIS_INSTALLER'
  if ((Split-Path -Leaf $temporaExe) -notmatch '(?i)tempora') {
    throw 'TEMPORA_INSTALLER_NAME_UNEXPECTED'
  }
  Write-Host "Launching TEMPORA installer: $temporaExe"
  $appSetup = Start-Process -FilePath $temporaExe -Wait -PassThru
  if ($appSetup.ExitCode -ne 0) {
    throw "TEMPORA_NSIS_INSTALL_FAILED: exit code $($appSetup.ExitCode)"
  }
  Write-Host 'TEMPORA_SETUP_COMPLETED; GUI must still be tested interactively.'
} catch {
  Write-Error "TEMPORA_TWO_STAGE_BLOCKED: $($_.Exception.Message)"
  exit 1
}

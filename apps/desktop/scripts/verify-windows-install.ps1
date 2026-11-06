param(
  [Parameter(Mandatory=$true)][string]$Installer,
  [Parameter(Mandatory=$true)][string]$InstallDirectory
)
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$installerFile = (Resolve-Path $Installer).Path
# NSIS /D requires a native Windows path: forward slashes are silently stripped.
$InstallDirectory = [System.IO.Path]::GetFullPath($InstallDirectory).Replace("/", "\\")
if (-not (Test-Path $installerFile -PathType Leaf)) { throw "INSTALLER_MISSING" }
if (Test-Path $InstallDirectory) { throw "TEST_DIRECTORY_MUST_BE_EMPTY" }
New-Item -ItemType Directory -Force -Path $InstallDirectory | Out-Null

try {
  Write-Host "Installing unsigned TEMPORA Desktop in isolated directory"
  $installerProcess = Start-Process -FilePath $installerFile -ArgumentList @("/S", "/D=$InstallDirectory") -Wait -PassThru
  if ($installerProcess.ExitCode -ne 0) { throw "NSIS_INSTALL_FAILED: $($installerProcess.ExitCode)" }
  Write-Host "Requested installer directory: $InstallDirectory"
  $installedFiles = @(Get-ChildItem -LiteralPath $InstallDirectory -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 30 -ExpandProperty FullName)
  Write-Host ("Installed tree (up to 30 files): " + ($installedFiles -join "; "))
  $uninstallKeys = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall'
  )
  foreach ($key in $uninstallKeys) {
    Get-ChildItem -Path $key -ErrorAction SilentlyContinue | ForEach-Object {
      $entry = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
      if ($entry.DisplayName -like '*TEMPORA*') {
        Write-Host ('TEMPORA registry: ' + $entry.DisplayName + '; location=' + $entry.InstallLocation)
      }
    }
  }
  $runtimeDir = Join-Path $InstallDirectory "engine"
  $node = Join-Path $runtimeDir "node.exe"
  $worker = Join-Path $runtimeDir "worker.cjs"
  $engine = Join-Path $runtimeDir "node_modules/tempora-framework/package.json"
  $manifestFile = Join-Path $runtimeDir "runtime-manifest.json"
  $lockFile = Join-Path $runtimeDir "package-lock.json"
  $appExe = Join-Path $InstallDirectory "tempora-desktop.exe"
  foreach ($file in @($node, $worker, $engine, $manifestFile, $lockFile, $appExe)) {
    if (-not (Test-Path $file -PathType Leaf)) { throw "MISSING_INSTALLED_ENGINE_FILE: $file" }
  }
  $manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
  $package = Get-Content -LiteralPath $engine -Raw | ConvertFrom-Json
  if ((Get-FileHash $lockFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.lock_sha256) { throw "INSTALLED_LOCKFILE_DIGEST_MISMATCH" }
  if (-not $manifest.dependencies -or $manifest.dependencies.Count -lt 1) { throw "RUNTIME_DEPENDENCY_INVENTORY_MISSING" }
  $signature = Get-AuthenticodeSignature -LiteralPath $appExe
  Write-Host ("Application signature status (informational; not release-ready): " + $signature.Status)
  if ($package.version -ne "3.0.0" -or $manifest.engine -ne "tempora-framework@3.0.0") {
    throw "INSTALLED_ENGINE_VERSION_MISMATCH"
  }
  if ((Get-FileHash $node -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.node_sha256) {
    throw "INSTALLED_NODE_DIGEST_MISMATCH"
  }
  if ((Get-FileHash $worker -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.worker_sha256) {
    throw "INSTALLED_WORKER_DIGEST_MISMATCH"
  }

  # Remove Node from PATH *for the worker process*; this is a true installed-file test,
  # not an accidental invocation of the GitHub runner's globally installed Node.
  $originalPath = $env:PATH
  $originalNodeOptions = $env:NODE_OPTIONS
  $originalNodePath = $env:NODE_PATH
  try {
    $env:PATH = "$env:SystemRoot\System32;$env:SystemRoot"
    Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
    Remove-Item Env:NODE_PATH -ErrorAction SilentlyContinue
    if (Get-Command node -ErrorAction SilentlyContinue) { throw "SYSTEM_NODE_STILL_AVAILABLE" }

    # The GUI is also started without access to the runner-installed Node.js.
    # The installed Tauri GUI must start and remain alive; no keyboard automation or dialogs
    # are asserted here. GUI interaction still requires a clean VM manual acceptance test.
    $appProcess = Start-Process -FilePath $appExe -WorkingDirectory $InstallDirectory -PassThru
    try {
      Start-Sleep -Seconds 6
      $appProcess.Refresh()
      if ($appProcess.HasExited) { throw "INSTALLED_TAURI_GUI_EXITED_EARLY: $($appProcess.ExitCode)" }
      # A living Tauri parent alone is insufficient: a missing WebView2 can leave
      # an empty native window with an error dialog while this process stays alive.
      # Inspect only process descendants of this app, never unrelated browser sessions.
      $allProcesses = @(Get-CimInstance Win32_Process -ErrorAction Stop | Select-Object ProcessId,ParentProcessId,Name)
      $descendants = @([int]$appProcess.Id)
      for ($depth = 0; $depth -lt 5; $depth++) {
        $children = @($allProcesses | Where-Object { $descendants -contains [int]$_.ParentProcessId } | Select-Object -ExpandProperty ProcessId)
        if ($children.Count -eq 0) { break }
        $descendants += $children
      }
      $webviewChildren = @($allProcesses | Where-Object {
        $descendants -contains [int]$_.ProcessId -and $_.Name -ieq 'msedgewebview2.exe'
      })
      if ($webviewChildren.Count -eq 0) { throw "INSTALLED_GUI_WEBVIEW2_PROCESS_MISSING" }
      Write-Host "Installed Tauri GUI stayed alive and spawned WebView2 ($($webviewChildren.Count) process(es))."
    } finally {
      if (-not $appProcess.HasExited) { Stop-Process -Id $appProcess.Id -Force -ErrorAction SilentlyContinue }
      $appProcess.Dispose()
    }

    # Every installed dependency must correspond to the bundled lockfile inventory.
    $locked = Get-Content -LiteralPath $lockFile -Raw | ConvertFrom-Json -AsHashtable
    $installedInventory = @($manifest.dependencies)
    $lockedEntries = @($locked['packages'].GetEnumerator() | Where-Object { $_.Key -like 'node_modules/*' })
    if ($installedInventory.Count -ne $lockedEntries.Count) { throw "RUNTIME_INVENTORY_COUNT_MISMATCH" }
    foreach ($entry in $lockedEntries) {
      $depPath = Join-Path $runtimeDir ($entry.Key.Replace('/', [System.IO.Path]::DirectorySeparatorChar))
      $depManifest = Join-Path $depPath 'package.json'
      if (-not (Test-Path -LiteralPath $depManifest -PathType Leaf)) { throw "INSTALLED_DEPENDENCY_MISSING: $($entry.Key)" }
      $dep = Get-Content -LiteralPath $depManifest -Raw | ConvertFrom-Json
      if ($dep.version -ne $entry.Value['version']) { throw "INSTALLED_DEPENDENCY_VERSION_MISMATCH: $($entry.Key)" }
      $match = @($installedInventory | Where-Object { $_.name -eq $dep.name -and $_.version -eq $dep.version -and $_.license -eq $dep.license })
      if ($match.Count -ne 1) { throw "INSTALLED_DEPENDENCY_INVENTORY_MISMATCH: $($entry.Key)" }
    }
    $smoke = @(
      @{ protocol_version="1.0.0"; request_id="installed_health"; operation="health"; payload=@{} },
      @{ protocol_version="1.0.0"; request_id="installed_validate"; operation="corpus.validate"; payload=@{corpus=@{}} },
      @{ protocol_version="1.0.0"; request_id="installed_digest"; operation="corpus.digest"; payload=@{corpus=@{a=1;b=2}} }
    )
    $inputJson = ($smoke | ForEach-Object { ConvertTo-Json $_ -Compress -Depth 15 }) -join "`n"
    # Feed the installed worker, never the checkout's node_modules or worker.
    $output = $inputJson | & $node $worker
    if ($LASTEXITCODE -ne 0) { throw "INSTALLED_WORKER_FAILED" }
    $answers = @($output | ForEach-Object { $_ | ConvertFrom-Json })
    if ($answers.Count -ne 3) { throw "UNEXPECTED_WORKER_RESPONSE_COUNT" }
    if (-not $answers[0].ok -or $answers[0].result.engine_version -ne "3.0.0") {
      throw "INSTALLED_HEALTH_FAILED"
    }
    if (-not $answers[1].ok -or $answers[1].result.valid -ne $false) {
      throw "INSTALLED_VALIDATION_FAILED"
    }
    if (-not $answers[2].ok -or $answers[2].result.sha256 -notmatch "^[a-f0-9]{64}$") {
      throw "INSTALLED_DIGEST_FAILED"
    }
    Write-Host "Installed TEMPORA Engine works with no system Node in PATH."
    Write-Host "Installed Node SHA256: $($manifest.node_sha256)"
    Write-Host "Installed worker SHA256: $($manifest.worker_sha256)"
  } finally {
    $env:PATH = $originalPath
    if ($null -ne $originalNodeOptions) { $env:NODE_OPTIONS=$originalNodeOptions }
    if ($null -ne $originalNodePath) { $env:NODE_PATH=$originalNodePath }
  }
} finally {
  # Keep the runner clean; this is an unsigned experimental build.
  $uninstaller = Join-Path $InstallDirectory "uninstall.exe"
  if (Test-Path $uninstaller) {
    $uninstall = Start-Process -FilePath $uninstaller -ArgumentList @("/S") -Wait -PassThru
    Write-Host "Uninstaller exit: $($uninstall.ExitCode)"
    if ($uninstall.ExitCode -ne 0) { throw "NSIS_UNINSTALL_FAILED: $($uninstall.ExitCode)" }
    if (Test-Path -LiteralPath (Join-Path $InstallDirectory "tempora-desktop.exe") -PathType Leaf) { throw "NSIS_UNINSTALL_LEFT_EXECUTABLE" }
  }
}

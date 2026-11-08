param(
  [Parameter(Mandatory=$true)][string]$Installer,
  [Parameter(Mandatory=$true)][string]$InstallDirectory
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$installerPath=(Resolve-Path -LiteralPath $Installer).Path
$destination=[IO.Path]::GetFullPath($InstallDirectory)
if (Test-Path -LiteralPath $destination) { throw 'ELECTRON_INSTALL_TEST_DIRECTORY_NOT_EMPTY' }
New-Item -Path $destination -ItemType Directory -Force | Out-Null
try {
  # Keep the check independent of source files: only installed package resources count.
  $arguments=@('/S',('/D='+$destination))
  $process=Start-Process -FilePath $installerPath -ArgumentList $arguments -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw ('ELECTRON_NSIS_INSTALL_FAILED: '+$process.ExitCode) }
  $resources=Join-Path $destination 'resources'
  foreach ($name in @('README.md','synthetic-canonical-v3.json','alnop-geographic-sample.geojson','alnop-canonical-v3-demo.json')) {
    $path=Join-Path $resources ('examples/'+$name)
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
      throw ('ELECTRON_INSTALLED_EXAMPLE_MISSING: '+$name)
    }
  }
  $engine=Join-Path $resources 'engine/node.exe'
  $worker=Join-Path $resources 'engine/worker.cjs'
  if (-not (Test-Path -LiteralPath $engine) -or -not (Test-Path -LiteralPath $worker)) {
    throw 'ELECTRON_INSTALLED_ENGINE_MISSING'
  }
  $validator=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../tests/packaged-engine-smoke.cjs')).Path
  $oldPath=$env:PATH
  $oldNodeOptions=$env:NODE_OPTIONS
  $oldNodePath=$env:NODE_PATH
  try {
    $env:PATH="$env:SystemRoot\System32;$env:SystemRoot"
    Remove-Item Env:NODE_OPTIONS,Env:NODE_PATH -ErrorAction SilentlyContinue
    $packedNode=(Join-Path $resources 'engine/node.exe')
    & $packedNode $validator $resources
    if ($LASTEXITCODE -ne 0) { throw 'ELECTRON_INSTALLED_SAMPLE_VALIDATION_FAILED' }
  } finally {
    $env:PATH=$oldPath
    if ($null -ne $oldNodeOptions) {$env:NODE_OPTIONS=$oldNodeOptions}
    if ($null -ne $oldNodePath) {$env:NODE_PATH=$oldNodePath}
  }
  Write-Host 'Electron NSIS installation includes and validates offline example corpora.'
} finally {
  $uninstaller=Get-ChildItem -LiteralPath $destination -Filter '*uninstall*.exe' -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($uninstaller) {
    $uninstall=Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S' -Wait -PassThru
    Write-Host ('Electron NSIS uninstaller exit: '+$uninstall.ExitCode)
  }
}

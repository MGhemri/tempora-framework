# TEMPORA pre-release Windows icon builder.
# Converts the checked-in small official-brand ICO to a 256x256 PNG
# required by electron-builder. No network, third-party icon fetch, or
# modification to the user's original logo. Source ICO is 16/32/48 px.
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$source = Join-Path $root "build/icon.ico"
$output = Join-Path $root "build/icon-256.png"
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
  throw "TEMPORA_ICON_SOURCE_MISSING"
}
$ico = [System.Drawing.Icon]::new($source)
$sourceBitmap = $ico.ToBitmap()
$targetBitmap = [System.Drawing.Bitmap]::new(256, 256)
$graphics = [System.Drawing.Graphics]::FromImage($targetBitmap)
try {
  $graphics.Clear([System.Drawing.Color]::FromArgb(12, 25, 31))
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.DrawImage($sourceBitmap, [System.Drawing.Rectangle]::new(0, 0, 256, 256))
  $targetBitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $graphics.Dispose()
  $targetBitmap.Dispose()
  $sourceBitmap.Dispose()
  $ico.Dispose()
}
if (-not (Test-Path -LiteralPath $output -PathType Leaf)) {
  throw "TEMPORA_ICON_GENERATION_FAILED"
}
Write-Host "TEMPORA Windows brand icon: $output (256x256)"

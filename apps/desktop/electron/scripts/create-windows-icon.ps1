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
# Some System.Drawing.Icon versions cannot decode PNG-compressed ICO images.
# The checked-in logo contains PNG payloads, which System.Drawing.Image can
# decode directly without relying on the legacy Icon.ToBitmap implementation.
$bytes = [System.IO.File]::ReadAllBytes($source)
if ($bytes.Length -lt 22 -or [BitConverter]::ToUInt16($bytes, 2) -ne 1) {
  throw "TEMPORA_ICON_INVALID_ICO"
}
$count = [int][BitConverter]::ToUInt16($bytes, 4)
$bestSize = 0
$bestOffset = 0
$largestWidth = 0
for ($i = 0; $i -lt $count; $i++) {
  $entry = 6 + 16 * $i
  if ($entry + 16 -gt $bytes.Length) { throw "TEMPORA_ICON_INVALID_ENTRY" }
  $width = if ($bytes[$entry] -eq 0) { 256 } else { [int]$bytes[$entry] }
  $size = [int][BitConverter]::ToUInt32($bytes, $entry + 8)
  $offset = [int][BitConverter]::ToUInt32($bytes, $entry + 12)
  if ($offset -lt 0 -or $size -lt 8 -or ($offset + $size) -gt $bytes.Length) {
    throw "TEMPORA_ICON_INVALID_ENTRY_DATA"
  }
  if ($width -gt $largestWidth) {
    $largestWidth = $width
    $bestSize = $size
    $bestOffset = $offset
  }
}
if ($bestSize -eq 0) { throw "TEMPORA_ICON_PNG_MISSING" }
$pngMagic = [byte[]]@(137,80,78,71,13,10,26,10)
for ($i = 0; $i -lt 8; $i++) {
  if ($bytes[$bestOffset + $i] -ne $pngMagic[$i]) { throw "TEMPORA_ICON_NOT_PNG" }
}
$stream = [System.IO.MemoryStream]::new($bytes, $bestOffset, $bestSize, $false)
$sourceBitmap = [System.Drawing.Image]::FromStream($stream)
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
  $stream.Dispose()
}
if (-not (Test-Path -LiteralPath $output -PathType Leaf)) {
  throw "TEMPORA_ICON_GENERATION_FAILED"
}
Write-Host "TEMPORA Windows brand icon: $output (256x256)"

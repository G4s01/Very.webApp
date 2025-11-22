<#
Generate favicon / PWA icons from a single base PNG on Windows using ImageMagick.

Usage:
  .\tools\generate-icons.ps1 -Src ".\public\base.png" -OutDir ".\public"

Parameters:
  -Src    Path to source PNG (required)
  -OutDir Output directory (default: public)

Requires:
  - ImageMagick (magick) in PATH
  - PowerShell 5+
#>

param(
  [Parameter(Mandatory = $true)]
  [string]$Src,

  [string]$OutDir = "public"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $Src)) {
  Write-Error "Source file not found: $Src"
  exit 1
}

# Ensure output dir exists
if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir | Out-Null
}

# Find ImageMagick
$magickCmd = $null
if (Get-Command magick -ErrorAction SilentlyContinue) {
  $magickCmd = "magick"
} elseif (Get-Command convert -ErrorAction SilentlyContinue) {
  # older installations might expose convert (be careful: Windows has its own convert.exe)
  $magickCmd = "convert"
} else {
  Write-Error "ImageMagick not found. Install ImageMagick and ensure 'magick' is in PATH."
  exit 2
}

Write-Host "Using ImageMagick command: $magickCmd"
Write-Host "Source: $Src"
Write-Host "Output directory: $OutDir"

# List of sizes to generate
$sizes = 16,24,32,48,64,96,128,150,180,192,256,384,512

foreach ($s in $sizes) {
  $dst = Join-Path $OutDir ("favicon-{0}x{0}.png" -f $s)
  Write-Host "Generating $dst"
  # resize preserving aspect and crop/pad to exact square
  & $magickCmd $Src -resize "${s}x${s}^" -gravity center -extent "${s}x${s}" -background none $dst
}

# Canonical/expected filenames
Copy-Item -Force (Join-Path $OutDir "favicon-180x180.png") (Join-Path $OutDir "apple-touch-icon.png")
Copy-Item -Force (Join-Path $OutDir "favicon-192x192.png") (Join-Path $OutDir "android-chrome-192x192.png")
Copy-Item -Force (Join-Path $OutDir "favicon-512x512.png") (Join-Path $OutDir "android-chrome-512x512.png")
Copy-Item -Force (Join-Path $OutDir "favicon-150x150.png") (Join-Path $OutDir "mstile-150x150.png")

# Create multi-resolution ICO (include 16,32,48,96 if present)
$icoInputs = @()
foreach ($i in 16,32,48,96) {
  $f = Join-Path $OutDir ("favicon-{0}x{0}.png" -f $i)
  if (Test-Path $f) { $icoInputs += $f }
}
if ($icoInputs.Count -gt 0) {
  $icoOut = Join-Path $OutDir "favicon.ico"
  Write-Host ("Generating ICO {0} from: {1}" -f $icoOut, ($icoInputs -join ', '))
  & $magickCmd $icoInputs $icoOut
} else {
  Write-Warning "No PNG sizes found for ICO generation; skipping favicon.ico"
}

# Create favicon.svg embedding the PNG as base64 data URI
Write-Host "Generating favicon.svg (PNG embedded as data URI)..."
[byte[]]$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $Src).Path)
$b64 = [System.Convert]::ToBase64String($bytes)
$svgContent = @"
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 659 659" preserveAspectRatio="xMidYMid meet">
  <image width="659" height="659" href="data:image/png;base64,$b64" />
</svg>
"@
$svgPath = Join-Path $OutDir "favicon.svg"
$svgContent | Out-File -FilePath $svgPath -Encoding UTF8

# Optional: generate webp (if cwebp available)
if (Get-Command cwebp -ErrorAction SilentlyContinue) {
  $webpSrc = Join-Path $OutDir "favicon-32x32.png"
  if (Test-Path $webpSrc) {
    $webpOut = Join-Path $OutDir "favicon-32x32.webp"
    Write-Host "Generating webp $webpOut"
    & cwebp -q 80 $webpSrc -o $webpOut | Out-Null
  }
}

Write-Host ""
Write-Host ("Produced files in {0}:" -f $OutDir)
Get-ChildItem -Path $OutDir -Filter "favicon*" -File | Sort-Object Name | ForEach-Object { Write-Host " - " $_.Name }
Get-ChildItem -Path $OutDir -Include "apple-touch-icon.png","android-chrome-*","mstile-150x150.png","favicon.ico","favicon.svg" -File -ErrorAction SilentlyContinue | Sort-Object Name | ForEach-Object { if($_) { Write-Host " - " $_.Name } }

Write-Host ""
Write-Host "Done."
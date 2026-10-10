param(
  [switch]$SkipTests,
  [switch]$Public
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot 'module.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

if (-not $SkipTests) {
  Push-Location $projectRoot
  try { npm test } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { throw 'Os testes falharam.' }
}

Push-Location $projectRoot
try { if ($Public) { node tools/package.mjs --public } else { npm run package } } finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { throw 'O empacotamento falhou.' }

$suffix = if ($Public) { '-public' } else { '' }
$packagePath = Join-Path $projectRoot "dist\$($manifest.id)-$($manifest.version)$suffix\$($manifest.id)"
$zipPath = if ($Public) { Join-Path $projectRoot 'dist\quedaco-personagens-skyfall-rpg.zip' } else { Join-Path $projectRoot "dist\$($manifest.id)-$($manifest.version).zip" }
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath }
# Compress-Archive do Windows PowerShell 5.1 grava as entradas com "\", que o Foundry
# em Linux não interpreta como pasta (ENOENT ao instalar). Montamos o zip à mão com
# separador "/" via System.IO.Compression.
Add-Type -AssemblyName System.IO.Compression | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
$base = (Resolve-Path -LiteralPath $packagePath).Path.TrimEnd('\') + '\'
$fs = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
try {
  $archive = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    Get-ChildItem -LiteralPath $packagePath -Recurse -File | Sort-Object FullName | ForEach-Object {
      $rel = $_.FullName.Substring($base.Length).Replace('\', '/')
      $entry = $archive.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
      $entryStream = $entry.Open()
      try { $bytes = [System.IO.File]::ReadAllBytes($_.FullName); $entryStream.Write($bytes, 0, $bytes.Length) }
      finally { $entryStream.Dispose() }
    }
  } finally { $archive.Dispose() }
} finally { $fs.Dispose() }

$zip = Get-Item -LiteralPath $zipPath
Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $projectRoot 'dist\module.json') -Force
Write-Host "Release pronta: $($zip.FullName) ($($zip.Length) bytes)"

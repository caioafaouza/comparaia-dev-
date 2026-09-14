
# Force UTF8 for special chars
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rootDir = Get-Location
$sourceDir = "$rootDir"
$destDir = "$rootDir/../Programa para Produçao"

Write-Host "Source: $sourceDir"
Write-Host "Dest:   $destDir"

# Function to copy with verbose
function Copy-Folder($src, $dst) {
    Write-Host "Copying $src -> $dst"
    if (!(Test-Path $dst)) { New-Item -ItemType Directory -Path $dst -Force | Out-Null }
    Copy-Item "$src\*" "$dst" -Recurse -Force -ErrorAction Stop
}

# 1. Frontend
if (Test-Path "$sourceDir/dist") {
    Copy-Folder "$sourceDir/dist" "$destDir/dist"
}
else {
    Write-Error "DIST folder missing in Source!"
}

# 2. Server
# We carefully exclude node_modules by copying children
$serverDest = "$destDir/server"
if (!(Test-Path $serverDest)) { New-Item -ItemType Directory -Path $serverDest -Force | Out-Null }

Get-ChildItem "$sourceDir/server" | Where-Object { $_.Name -ne 'node_modules' -and $_.Name -ne 'logs' } | ForEach-Object {
    Write-Host "Copying serverItem: $($_.Name)"
    Copy-Item $_.FullName "$serverDest" -Recurse -Force
}

# 3. Root files
Copy-Item "$sourceDir/package.json" "$destDir/package.json" -Force

# 4. Env
Copy-Item "$sourceDir/server/.env" "$serverDest/.env" -Force

Write-Host "--- Copy Complete ---"
Get-ChildItem $destDir

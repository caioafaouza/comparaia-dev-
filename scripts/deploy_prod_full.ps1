
# Force UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rootDir = Get-Location
$sourceDir = "$rootDir"
$destDir = "$rootDir/../Programa para Produçao"

Write-Host "--- Starting Full Production Build ---"
Write-Host "Source: $sourceDir"
Write-Host "Dest:   $destDir"

# 0. Clean Dest
if (Test-Path $destDir) {
    Write-Host "Cleaning destination..."
    # Remove-Item $destDir -Recurse -Force -ErrorAction SilentlyContinue
    # Safety: Just ensure folders exist
}
else {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

# 1. Build Client (Optional, can skip if already built, but let's ensure freshness)
# Write-Host "Building Frontend..."
# npm run build:client

# 2. Copy Frontend
Write-Host "Copying Frontend..."
if (!(Test-Path "$destDir/dist")) { New-Item -ItemType Directory -Path "$destDir/dist" -Force | Out-Null }
Copy-Item "$sourceDir/dist/*" "$destDir/dist" -Recurse -Force

# 3. Copy Server
Write-Host "Copying Server..."
$serverDest = "$destDir/server"
if (!(Test-Path $serverDest)) { New-Item -ItemType Directory -Path $serverDest -Force | Out-Null }

Get-ChildItem "$sourceDir/server" | Where-Object { $_.Name -ne 'node_modules' -and $_.Name -ne 'logs' -and $_.Name -ne '.env' } | ForEach-Object {
    Copy-Item $_.FullName "$serverDest" -Recurse -Force
}

# 4. Copy & Patch .env
Write-Host "Configuring Environment..."
$envContent = Get-Content "$sourceDir/server/.env"
$newEnv = $envContent | ForEach-Object {
    if ($_ -match "^CORS_ORIGINS=") { "CORS_ORIGINS=*" }
    elseif ($_ -match "^FRONTEND_URL=") { "FRONTEND_URL=https://comparaia.com" }
    elseif ($_ -match "^DB_HOST=") { "DB_HOST=127.0.0.1" } # Assuming local DB on prod
    else { $_ }
}
if ($newEnv -notcontains "CORS_ORIGINS=*") { $newEnv += "CORS_ORIGINS=*" }
$newEnv | Set-Content "$serverDest/.env"

# 5. Copy & Patch Root package.json
Write-Host "Configuring package.json..."
$pkg = Get-Content "$sourceDir/package.json" -Raw | ConvertFrom-Json
$pkg.scripts.start = "npm --workspace server run start"
$pkg | ConvertTo-Json -Depth 10 | Set-Content "$destDir/package.json"

# 6. Create Helper Scripts
Write-Host "Creating Linux Scripts..."

$installScript = "#!/bin/bash`nexport NODE_OPTIONS=`"--max-old-space-size=2048`"`necho `"Cleaning npm cache...`"`nnpm cache clean --force`necho `"Installing dependencies (Low Memory Mode)...`"`nnpm install --omit=dev --no-audit --no-fund --ignore-scripts"

# Write with explicit LF (Unix) line endings
[System.IO.File]::WriteAllText("$destDir/install_low_mem.sh", $installScript)

# start.sh
$startScript = "#!/bin/bash`nexport NODE_ENV=production`nexport PORT=3000`nnode server/index.js"
[System.IO.File]::WriteAllText("$destDir/start.sh", $startScript)

# 7. Copy DB Repair scripts if they exist in source scripts
if (Test-Path "$sourceDir/scripts/seed_prod_init.js") {
    Copy-Item "$sourceDir/scripts/seed_prod_init.js" "$serverDest/seed_prod.js" -Force
}

Write-Host "--- Build Complete! ---"
Write-Host "Files are ready in: $destDir"

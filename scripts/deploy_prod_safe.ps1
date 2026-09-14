
# Set encoding to UTF8 to handle characters like 'ç'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rootDir = Get-Location
$sourceDir = "$rootDir"
$destDir = "$rootDir/../Programa para Produçao"

Write-Host "Source: $sourceDir"
Write-Host "Dest:   $destDir"

# Ensure Dest exists
if (!(Test-Path -LiteralPath "$destDir")) { 
    New-Item -ItemType Directory -Force -Path "$destDir" 
}

# 1. Copy Frontend Build (dist)
Write-Host "Copying 'dist'..."
Robocopy "$sourceDir/dist" "$destDir/dist" /MIR /NFL /NDL /NJH /NJS

# 2. Copy Server (excluding node_modules)
Write-Host "Copying 'server'..."
Robocopy "$sourceDir/server" "$destDir/server" /MIR /XD node_modules logs /NFL /NDL /NJH /NJS

# 3. Copy Package.json
Copy-Item "$sourceDir/package.json" "$destDir/package.json" -Force

# 4. Copy server/.env
Copy-Item "$sourceDir/server/.env" "$destDir/server/.env" -Force

# 5. Create helper batch file
$batPath = "$destDir/iniciar_sistema.bat"
$batContent = @"
@echo off
echo Installing Server Dependencies...
npm install --omit=dev --workspace=server
echo Starting Production Server...
set PORT=3000
set NODE_ENV=production
node server/index.js
pause
"@
[System.IO.File]::WriteAllText($batPath, $batContent)

Write-Host "--- Deployment Complete ---"


$sourceDir = "c:/Users/CaioSouza/OneDrive - MULTIREDE DISTRIBUIDORA LTDA/Área de Trabalho/PROJETO INCTEC CRM/Compara IA/Sistema"
$destDir = "c:/Users/CaioSouza/OneDrive - MULTIREDE DISTRIBUIDORA LTDA/Área de Trabalho/PROJETO INCTEC CRM/Compara IA/Programa para Produçao"

Write-Host "--- Deployment Started ---"
Write-Host "Source: $sourceDir"
Write-Host "Dest:   $destDir"

# Ensure Dest exists
if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Force -Path $destDir }

# 1. Copy Frontend Build (dist)
Write-Host "Copying 'dist'..."
Robocopy "$sourceDir/dist" "$destDir/dist" /MIR /NFL /NDL /NJH /NJS

# 2. Copy Server (excluding node_modules)
Write-Host "Copying 'server'..."
Robocopy "$sourceDir/server" "$destDir/server" /MIR /XD node_modules logs /NFL /NDL /NJH /NJS

# 3. Copy Package.json (Root)
# We might need dependencies install.
Copy-Item "$sourceDir/package.json" "$destDir/package.json" -Force

# 4. Copy server/.env (Critical)
Copy-Item "$sourceDir/server/.env" "$destDir/server/.env" -Force

# 5. Create helper batch file
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
Set-Content "$destDir/iniciar_sistema.bat" $batContent

Write-Host "--- Deployment Complete ---"
Write-Host "Files are in: $destDir"
Write-Host "Run 'iniciar_sistema.bat' inside that folder."

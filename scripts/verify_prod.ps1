
# Force UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rootDir = Get-Location
$parent = (Get-Item $rootDir).Parent
$prodFolder = Get-ChildItem $parent.FullName | Where-Object { $_.Name -like 'Programa*' } | Select-Object -First 1

if (!$prodFolder) {
    Write-Error "Pasta de Produção não encontrada!"
    exit 1
}

Write-Host "Verificando Pasta: $($prodFolder.FullName)"

$missing = 0

# Check Dist
if (Test-Path "$($prodFolder.FullName)/dist/index.html") {
    Write-Host "[OK] dist/index.html encontrado."
}
else {
    Write-Host "[ERRO] dist/index.html NÃO ENCONTRADO." -ForegroundColor Red
    $missing++
}

# Check Server Index
if (Test-Path "$($prodFolder.FullName)/server/index.js") {
    Write-Host "[OK] server/index.js encontrado."
}
else {
    Write-Host "[ERRO] server/index.js NÃO ENCONTRADO." -ForegroundColor Red
    $missing++
}

# Check Env
if (Test-Path "$($prodFolder.FullName)/server/.env") {
    Write-Host "[OK] server/.env encontrado."
}
else {
    Write-Host "[ERRO] server/.env NÃO ENCONTRADO." -ForegroundColor Red
    $missing++
}

# Check Root Package
if (Test-Path "$($prodFolder.FullName)/package.json") {
    Write-Host "[OK] package.json encontrado."
}
else {
    Write-Host "[ERRO] package.json NÃO ENCONTRADO." -ForegroundColor Red
    $missing++
}

if ($missing -eq 0) {
    Write-Host "--- TUDO CERTO! Todos os arquivos críticos estão presentes. ---" -ForegroundColor Green
}
else {
    Write-Host "--- FALHA DE VERIFICAÇÃO: $missing arquivos faltando. ---" -ForegroundColor Red
    exit 1
}

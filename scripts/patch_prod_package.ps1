
# Force UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rootDir = Get-Location
$parent = (Get-Item $rootDir).Parent
$prodFolder = Get-ChildItem $parent.FullName | Where-Object { $_.Name -like 'Programa*' } | Select-Object -First 1

if (!$prodFolder) {
    Write-Error "Pasta de Produção não encontrada!"
    exit 1
}

$pkgPath = "$($prodFolder.FullName)/package.json"

if (!(Test-Path $pkgPath)) {
    Write-Error "package.json não encontrado em: $pkgPath"
    exit 1
}

Write-Host "Lendo package.json..."
$json = Get-Content $pkgPath -Raw | ConvertFrom-Json

# Modify Start Script
Write-Host "Alterando script 'start'..."
$json.scripts.start = "npm --workspace server run start"

# Remove build scripts to avoid confusion (optional but good)
# $json.scripts.build = "echo 'Build already done'"

# Save
$json | ConvertTo-Json -Depth 10 | Set-Content $pkgPath
Write-Host "package.json atualizado com sucesso!"
Write-Host "Novo start: $($json.scripts.start)"

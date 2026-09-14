
# Force UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rootDir = Get-Location
$parent = (Get-Item $rootDir).Parent
$prodFolder = Get-ChildItem $parent.FullName | Where-Object { $_.Name -like 'Programa*' } | Select-Object -First 1

if (!$prodFolder) {
    Write-Error "Pasta de Produção não encontrada!"
    exit 1
}

$envPath = "$($prodFolder.FullName)/server/.env"

if (!(Test-Path $envPath)) {
    Write-Error ".env não encontrado em: $envPath"
    exit 1
}

Write-Host "Lendo .env..."
$content = Get-Content $envPath

# Check if CORS_ORIGINS exists
$found = $false
$newContent = $content | ForEach-Object {
    if ($_ -match "^CORS_ORIGINS=") {
        $found = $true
        "CORS_ORIGINS=*"
    }
    else {
        $_
    }
}

if (!$found) {
    $newContent += "CORS_ORIGINS=*"
}

$newContent | Set-Content $envPath
Write-Host ".env atualizado: CORS_ORIGINS=*"

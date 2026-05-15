$dbFile = "c:\Users\PERSONAL\.gemini\antigravity\scratch\vinyl_stock_manager\db.json"
if (Test-Path $dbFile) {
    $data = Get-Content $dbFile -Raw | ConvertFrom-Json
    $updatedCount = 0
    if ($null -ne $data.stock) {
        foreach ($item in $data.stock) {
            $price = 0
            if ($item.price -as [double]) {
                $price = [double]$item.price
            }
            if ($price -le 0) {
                if ($item.status -ne "borrador") {
                    $item.status = "borrador"
                    $updatedCount++
                }
            }
        }
    }
    $data | ConvertTo-Json -Depth 10 | Set-Content $dbFile
    Write-Host "Successfully updated $updatedCount items to 'borrador' status."
} else {
    Write-Host "db.json not found."
}

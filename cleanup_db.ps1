$data = Get-Content db.json -Raw | ConvertFrom-Json
$data.stock = $data.stock | Where-Object { $_.artist -ne "Desconocido" -and $_.title -ne "Desconocido" }
$data | ConvertTo-Json -Depth 100 | Set-Content db.json
Write-Output "Limpieza completada con éxito."

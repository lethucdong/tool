
$LogPath = "D:\workspace\Tools\farm-tool-nextjs\action_success.log"

Import-Module BurntToast

Write-Host "Watching Farm Tool log..." -ForegroundColor Green
Write-Host "File: $LogPath"

# Chờ file tồn tại
while (-not (Test-Path $LogPath)) {
    Start-Sleep -Seconds 2
}

# Chỉ đọc những dòng mới phát sinh
Get-Content -LiteralPath $LogPath -Tail 0 -Wait -Encoding UTF8 |
ForEach-Object {
    $line = $_

    if (-not [string]::IsNullOrWhiteSpace($line)) {
        Write-Host "[NEW] $line" -ForegroundColor Green

        New-BurntToastNotification `
            -Text "Farm Tool - Success", $line
    }
}

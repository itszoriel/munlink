# MunLink Zambales - Start Project Script
Write-Host "========================================" -ForegroundColor Green
Write-Host "   MunLink Zambales - Starting Project" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Local-only startup (no network access configuration)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting Backend API Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\api; python app.py"

Start-Sleep -Seconds 3

Write-Host "Starting Frontend Web Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd apps\web; npm run dev"

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Servers Starting..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
# Get IP for display
$ipAddress = $null
try {
    $ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.IPAddress -notlike "127.*" -and 
        $_.IPAddress -notlike "169.254.*" -and
        $_.PrefixOrigin -eq "Dhcp"
    } | Select-Object -First 1).IPAddress
} catch {
    try {
        $ipAddress = (Get-NetIPConfiguration | Where-Object {
            $_.IPv4Address.IPAddress -notlike "127.*" -and
            $_.IPv4Address.IPAddress -notlike "169.254.*"
        } | Select-Object -First 1).IPv4Address.IPAddress
    } catch {
        $ipAddress = "localhost"
    }
}

Write-Host "Backend API:  http://localhost:5000" -ForegroundColor Cyan
Write-Host "Frontend Web: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Opening application in browser..." -ForegroundColor Yellow

Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"

# MunLink Zambales - Start Servers
Write-Host "Starting MunLink Zambales Project..." -ForegroundColor Green

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Local-only startup (no network access configuration)

# Start Backend API
Write-Host "Starting Backend API..." -ForegroundColor Yellow
$backendPath = Join-Path $scriptDir "apps\api"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; python app.py"

# Wait a moment
Start-Sleep -Seconds 2

# Start Frontend Web
Write-Host "Starting Frontend Web..." -ForegroundColor Yellow
$frontendPath = Join-Path $scriptDir "apps\web"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev"

# Wait a moment
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Servers Started!" -ForegroundColor Green
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

# Open browser
Start-Process "http://localhost:3000"

Write-Host "Done! Check the opened terminal windows for server logs." -ForegroundColor Green

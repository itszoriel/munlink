# MunLink Zambales - Status Check Script
Write-Host "========================================" -ForegroundColor Green
Write-Host "   MunLink Zambales - Status Check" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check Backend API
Write-Host "Checking Backend API (http://localhost:5000)..." -ForegroundColor Yellow
try {
    $backendResponse = Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ Backend API is running (Status: $($backendResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend API is not responding" -ForegroundColor Red
}

Write-Host ""

# Check Frontend Web
Write-Host "Checking Frontend Web (http://localhost:3000)..." -ForegroundColor Yellow
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ Frontend Web is running (Status: $($frontendResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "✗ Frontend Web is not responding" -ForegroundColor Red
}

Write-Host ""

# Check running processes
Write-Host "Running Python/Node processes:" -ForegroundColor Yellow
$processes = Get-Process | Where-Object {$_.ProcessName -like "*python*" -or $_.ProcessName -like "*node*"} | Select-Object ProcessName, Id, CPU
if ($processes) {
    $processes | Format-Table -AutoSize
} else {
    Write-Host "No Python or Node processes found" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Status Check Complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

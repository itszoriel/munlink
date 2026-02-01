# MunLink - Configure Network Access Helper
Write-Host "========================================" -ForegroundColor Green
Write-Host "   MunLink Network Access Setup" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Get local IP address
Write-Host "Finding your local IP address..." -ForegroundColor Yellow
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -notlike "127.*" -and 
    $_.IPAddress -notlike "169.254.*" -and
    $_.PrefixOrigin -eq "Dhcp"
}).IPAddress | Select-Object -First 1

if ($ipAddress) {
    Write-Host ""
    Write-Host "Your local IP address: $ipAddress" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Access URLs:" -ForegroundColor Green
    Write-Host "  Frontend Web:  http://$ipAddress`:3000" -ForegroundColor Cyan
    Write-Host "  Admin Panel:   http://$ipAddress`:3001" -ForegroundColor Cyan
    Write-Host "  API:           http://$ipAddress`:5000" -ForegroundColor Cyan
    Write-Host ""
} else {
    Write-Host "Could not automatically detect IP address." -ForegroundColor Yellow
    Write-Host "Please run 'ipconfig' to find your IPv4 address manually." -ForegroundColor Yellow
    Write-Host ""
}

# Check if firewall rule exists
Write-Host "Checking Windows Firewall..." -ForegroundColor Yellow
$existingRule = Get-NetFirewallRule -DisplayName "MunLink Dev Ports" -ErrorAction SilentlyContinue

if ($existingRule) {
    Write-Host "Firewall rule already exists." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "To allow network access, you need to configure Windows Firewall." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Run this script as Administrator to auto-configure:" -ForegroundColor Cyan
    Write-Host "  New-NetFirewallRule -DisplayName 'MunLink Dev Ports' -Direction Inbound -LocalPort 3000,3001,5000 -Protocol TCP -Action Allow" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 2: Manual configuration:" -ForegroundColor Cyan
    Write-Host "  1. Open Windows Defender Firewall" -ForegroundColor Gray
    Write-Host "  2. Click 'Advanced settings'" -ForegroundColor Gray
    Write-Host "  3. Click 'Inbound Rules' -> 'New Rule'" -ForegroundColor Gray
    Write-Host "  4. Select 'Port' -> Next" -ForegroundColor Gray
    Write-Host "  5. Select 'TCP' and enter ports: 3000, 3001, 5000" -ForegroundColor Gray
    Write-Host "  6. Select 'Allow the connection' -> Next" -ForegroundColor Gray
    Write-Host "  7. Check all profiles -> Next" -ForegroundColor Gray
    Write-Host "  8. Name it 'MunLink Dev Ports' -> Finish" -ForegroundColor Gray
    Write-Host ""
    
    # Try to create the rule if running as admin
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    
    if ($isAdmin) {
        Write-Host "Running as Administrator. Creating firewall rule..." -ForegroundColor Yellow
        try {
            New-NetFirewallRule -DisplayName "MunLink Dev Ports" -Direction Inbound -LocalPort 3000,3001,5000 -Protocol TCP -Action Allow -ErrorAction Stop
            Write-Host "Firewall rule created successfully!" -ForegroundColor Green
        } catch {
            Write-Host "Failed to create firewall rule: $_" -ForegroundColor Red
        }
    } else {
        Write-Host "Not running as Administrator. Please run this script as Admin to auto-configure firewall." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Next Steps" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Make sure all devices are on the same Wi-Fi/network" -ForegroundColor Yellow
Write-Host "2. Restart your servers (if they're running)" -ForegroundColor Yellow
Write-Host "3. Access from other devices using the IP address shown above" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")





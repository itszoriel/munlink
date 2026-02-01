# MunLink Zambales - Database Manager PowerShell Script
# Quick database operations for Windows

param(
    [Parameter(Position=0)]
    [string]$Action = "menu",
    [Parameter(Position=1)]
    [string]$UserId = ""
)

function Show-Menu {
    Write-Host ""
    Write-Host "=" * 60
    Write-Host "MUNLINK ZAMBALES - DATABASE MANAGER"
    Write-Host "=" * 60
    Write-Host "1. Check user counts"
    Write-Host "2. List all users"
    Write-Host "3. List admin users only"
    Write-Host "4. Delete specific user"
    Write-Host "5. Delete all admin users"
    Write-Host "6. Delete all resident users"
    Write-Host "7. Clear all users"
    Write-Host "8. Clear uploads directory"
    Write-Host "9. Preserve municipalities data"
    Write-Host "10. Full cleanup (users + uploads + municipalities)"
    Write-Host "0. Exit"
    Write-Host "=" * 60
}

function Check-Users {
    Write-Host "Checking user counts..."
    python scripts/quick_db_ops.py check-users
}

function List-Users {
    Write-Host "Listing all users..."
    python scripts/quick_db_ops.py list-users
}

function List-AdminUsers {
    Write-Host "Listing admin users..."
    python scripts/database_manager.py
}

function Delete-User {
    param([string]$Id)
    if ($Id -eq "") {
        $Id = Read-Host "Enter user ID to delete"
    }
    Write-Host "Deleting user ID: $Id"
    python scripts/quick_db_ops.py delete-user $Id
}

function Clear-AllUsers {
    Write-Host "Clearing all users..."
    $confirm = Read-Host "Are you sure? (yes/no)"
    if ($confirm -eq "yes") {
        python scripts/quick_db_ops.py clear-users
    } else {
        Write-Host "Operation cancelled."
    }
}

function Clear-Uploads {
    Write-Host "Clearing uploads directory..."
    $confirm = Read-Host "Are you sure? (yes/no)"
    if ($confirm -eq "yes") {
        python scripts/quick_db_ops.py clear-uploads
    } else {
        Write-Host "Operation cancelled."
    }
}

function Preserve-Municipalities {
    Write-Host "Preserving municipalities data..."
    python scripts/quick_db_ops.py preserve-municipalities
}

function Full-Cleanup {
    Write-Host "Performing full cleanup..."
    $confirm = Read-Host "This will delete ALL users and uploads. Are you sure? (yes/no)"
    if ($confirm -eq "yes") {
        python scripts/quick_db_ops.py full-cleanup
    } else {
        Write-Host "Operation cancelled."
    }
}

# Main execution
switch ($Action.ToLower()) {
    "menu" {
        do {
            Show-Menu
            $choice = Read-Host "Enter your choice (0-10)"
            
            switch ($choice) {
                "1" { Check-Users }
                "2" { List-Users }
                "3" { List-AdminUsers }
                "4" { Delete-User }
                "5" { 
                    Write-Host "Deleting all admin users..."
                    python scripts/database_manager.py
                }
                "6" { 
                    Write-Host "Deleting all resident users..."
                    python scripts/database_manager.py
                }
                "7" { Clear-AllUsers }
                "8" { Clear-Uploads }
                "9" { Preserve-Municipalities }
                "10" { Full-Cleanup }
                "0" { 
                    Write-Host "Goodbye!"
                    break
                }
                default { Write-Host "Invalid choice. Please try again." }
            }
            
            if ($choice -ne "0") {
                Read-Host "Press Enter to continue..."
            }
        } while ($choice -ne "0")
    }
    "check-users" { Check-Users }
    "list-users" { List-Users }
    "list-admins" { List-AdminUsers }
    "delete-user" { Delete-User -Id $UserId }
    "clear-users" { Clear-AllUsers }
    "clear-uploads" { Clear-Uploads }
    "preserve-municipalities" { Preserve-Municipalities }
    "full-cleanup" { Full-Cleanup }
    default {
        Write-Host "Usage: .\db_manager.ps1 [action] [user_id]"
        Write-Host ""
        Write-Host "Actions:"
        Write-Host "  menu                    - Show interactive menu"
        Write-Host "  check-users            - Check user counts"
        Write-Host "  list-users             - List all users"
        Write-Host "  list-admins            - List admin users"
        Write-Host "  delete-user [id]       - Delete specific user"
        Write-Host "  clear-users            - Clear all users"
        Write-Host "  clear-uploads          - Clear uploads directory"
        Write-Host "  preserve-municipalities - Preserve municipalities data"
        Write-Host "  full-cleanup           - Full cleanup"
        Write-Host ""
        Write-Host "Examples:"
        Write-Host "  .\db_manager.ps1"
        Write-Host "  .\db_manager.ps1 check-users"
        Write-Host "  .\db_manager.ps1 delete-user 1"
    }
}

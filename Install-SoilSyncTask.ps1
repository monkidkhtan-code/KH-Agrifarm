<#
.SYNOPSIS
    Install-SoilSyncTask.ps1 - Registers a background Windows Scheduled Task for KH Agrifarm
.DESCRIPTION
    Sets up a silent scheduled task that automatically queries both RainPoint Cloud Soil Probes
    (Plot 1 & 2) and local Tapo T315 Nursery Greenhouse Sensors (Backup 1 & 2) every 15 minutes.
#>

$taskName = "KHAgrifarm_FarmSensors_Sync"
$scriptPath = Join-Path $PSScriptRoot "Sync-AllFarmSensors.ps1"
$psExe = (Get-Command powershell.exe).Source

$action = New-ScheduledTaskAction -Execute $psExe -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

Unregister-ScheduledTask -TaskName "KHAgrifarm_RainPoint_Sync" -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "KH Agrifarm 10-Minute RainPoint & Tapo T315 Telemetry Sync"

Write-Host "=========================================================================="
Write-Host "  SUCCESS: Background Task '$taskName' is now REGISTERED!"
Write-Host "=========================================================================="
Write-Host "  - Runs automatically every 10 minutes in the background."
Write-Host "  - Synchronizes RainPoint Soil Probes (Plot 1 & 2)"
Write-Host "  - Synchronizes Tapo T315 Nursery Greenhouse Sensors (Backup 1 & 2)"
Write-Host "=========================================================================="

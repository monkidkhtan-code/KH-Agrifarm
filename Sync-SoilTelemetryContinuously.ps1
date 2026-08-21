<#
.SYNOPSIS
    Sync-SoilTelemetryContinuously.ps1 - Automated 30-Minute Telemetry Sync for KH Agrifarm
.DESCRIPTION
    Runs in the background or as a scheduled task to continuously query RainPoint Cloud,
    decode real-time soil moisture and temperature, and append every drip surge / drying cycle
    to data/soil_moisture_history.json.
#>

param(
    [int]$IntervalMinutes = 10
)

$scriptPath = Join-Path $PSScriptRoot "Sync-AllFarmSensors.ps1"
if (!(Test-Path $scriptPath)) { $scriptPath = Join-Path $PSScriptRoot "Get-LiveSoilSensors.ps1" }

Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "   🌱 KH AGRIFARM - CONTINUOUS RAINPOINT SOIL & FARM TELEMETRY LOGGER     " -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "   Interval : Every $IntervalMinutes minutes" -ForegroundColor Yellow
Write-Host "   Target   : Live RainPoint Cloud -> Firebase & Local Storage" -ForegroundColor Yellow
Write-Host "==========================================================================" -ForegroundColor Green

while ($true) {
    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$now] Fetching live probe telemetry from RainPoint Cloud..." -ForegroundColor Cyan
    
    try {
        & powershell -ExecutionPolicy Bypass -File $scriptPath
        Write-Host "[$now] ✅ Successfully logged live moisture & temp telemetry." -ForegroundColor Green
    } catch {
        Write-Host "[$now] ⚠️ Sync error: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host "Next sync in $IntervalMinutes minutes... (Press Ctrl+C to stop)" -ForegroundColor DarkGray
    Start-Sleep -Seconds ($IntervalMinutes * 60)
}

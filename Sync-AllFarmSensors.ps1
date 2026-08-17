<#
.SYNOPSIS
    Sync-AllFarmSensors.ps1 - Automatic Telemetry Sync & Cloud Bridge for KH Agrifarm
.DESCRIPTION
    Queries both RainPoint Cloud Probes (Plot 1 & 2) and local Tapo T315 Nursery Greenhouse Sensors,
    then automatically pushes the live telemetry to the Cloud Bridge for Netlify & remote devices.
#>

$scriptRoot = $PSScriptRoot
if (!$scriptRoot) { $scriptRoot = "C:\Users\monki\.gemini\antigravity\scratch\kh-agrifarm" }

# Optional: Set your Cloud Telemetry Endpoint (Firebase Realtime DB REST URL)
# Example: "https://kh-agrifarm-default-rtdb.asia-southeast1.firebasedatabase.app/telemetry.json"
$cloudEndpointUrl = ""

# Auto-detect from config.js if not hardcoded above
$configFile = Join-Path $scriptRoot "js\config.js"
if ([string]::IsNullOrWhiteSpace($cloudEndpointUrl) -and (Test-Path $configFile)) {
    $configContent = Get-Content $configFile -Raw
    if ($configContent -match 'endpointUrl:\s*"([^"]+)"') {
        $foundUrl = $matches[1].Trim()
        if (![string]::IsNullOrWhiteSpace($foundUrl)) {
            $cloudEndpointUrl = $foundUrl
        }
    }
}

Write-Host "=========================================================================="
Write-Host "   🌱 KH AGRIFARM - ALL SENSORS TELEMETRY SYNC                           "
Write-Host "=========================================================================="

# 1. Sync RainPoint Probes
$rainpointScript = Join-Path $scriptRoot "Get-LiveSoilSensors.ps1"
if (Test-Path $rainpointScript) {
    Write-Host "`n[1/3] Syncing RainPoint Soil Moisture Probes (Plot 1 & 2)..."
    & powershell -ExecutionPolicy Bypass -File $rainpointScript
}

# 2. Sync Tapo T315 Nursery Greenhouse
$tapoScript = Join-Path $scriptRoot "Get-LiveTapoSensors.ps1"
if (Test-Path $tapoScript) {
    Write-Host "`n[2/3] Syncing Tapo T315 Nursery Greenhouse Sensor (Backup 1 & 2)..."
    & powershell -ExecutionPolicy Bypass -File $tapoScript
}

# 3. Upload to Cloud Bridge (For Netlify & Mobile)
if (![string]::IsNullOrWhiteSpace($cloudEndpointUrl)) {
    Write-Host "`n[3/3] Uploading Live Telemetry to Cloud Bridge for Netlify ($cloudEndpointUrl)..."
    try {
        $soilPath = Join-Path $scriptRoot "data\soil_sensors.json"
        $soilHistPath = Join-Path $scriptRoot "data\soil_moisture_history.json"
        $tapoPath = Join-Path $scriptRoot "data\tapo_sensors.json"
        $tapoHistPath = Join-Path $scriptRoot "data\tapo_history.json"

        $soilData = if (Test-Path $soilPath) { Get-Content $soilPath -Raw | ConvertFrom-Json } else { $null }
        $soilHistData = if (Test-Path $soilHistPath) { Get-Content $soilHistPath -Raw | ConvertFrom-Json } else { $null }
        $tapoData = if (Test-Path $tapoPath) { Get-Content $tapoPath -Raw | ConvertFrom-Json } else { $null }
        $tapoHistData = if (Test-Path $tapoHistPath) { Get-Content $tapoHistPath -Raw | ConvertFrom-Json } else { $null }

        $payloadObj = [PSCustomObject]@{
            lastUpdated = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
            soilSensors = $soilData
            soilHistory = $soilHistData
            tapoSensors = $tapoData
            tapoHistory = $tapoHistData
        }

        $payloadJson = $payloadObj | ConvertTo-Json -Depth 10 -Compress
        $resp = Invoke-RestMethod -Uri $cloudEndpointUrl -Method Put -Body $payloadJson -ContentType "application/json; charset=utf-8"
        Write-Host "   ✅ Telemetry successfully pushed to Cloud! Netlify app is now LIVE!" -ForegroundColor Green
    }
    catch {
        Write-Warning "   ⚠️ Could not push to cloud endpoint: $($_.Exception.Message)"
    }
} else {
    Write-Host "`n[3/3] Cloud Bridge: No endpointUrl configured in config.js (Local mode active)." -ForegroundColor Yellow
}

Write-Host "`n=========================================================================="
Write-Host "   ✅ ALL FARM SENSORS SYNC COMPLETED SUCCESSFULLY!                       "
Write-Host "=========================================================================="

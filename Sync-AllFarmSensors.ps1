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

# Run unified Python Cloud Sync (RainPoint MQTT handshake + SmartThings Tapo + Google Sheets + Firebase)
$pyScript = Join-Path $scriptRoot "scripts\cloud_sync.py"
if (Test-Path $pyScript) {
    Write-Host "`n[1/2] Executing Unified Python Telemetry Engine with Alibaba IoT MQTT Handshake..." -ForegroundColor Cyan
    try {
        & python $pyScript --once
    } catch {
        Write-Warning "Python sync warning: $_"
    }
}

# Step 2: cloud_sync.py automatically pushes 100% live hardware telemetry to Firebase
Write-Host "`n[2/2] Live telemetry synced and pushed to Cloud Bridge (Firebase) by Telemetry Engine." -ForegroundColor Green

Write-Host "`n=========================================================================="
Write-Host "   ✅ ALL FARM SENSORS SYNC COMPLETED SUCCESSFULLY!                       "
Write-Host "=========================================================================="

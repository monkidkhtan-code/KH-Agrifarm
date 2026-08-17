$Email = "monkid_khtan@yahoo.com"
$Password = "789789tan"
$AreaCode = "60"
$BaseUrl = "https://region3.homgarus.com"
$OutputDir = "C:\Users\monki\.gemini\antigravity\scratch\kh-agrifarm\data"

function Get-MD5Hash([string]$inputStr) {
    $md5 = [System.Security.Cryptography.MD5]::Create()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($inputStr)
    $hashBytes = $md5.ComputeHash($bytes)
    $sb = [System.Text.StringBuilder]::new()
    foreach ($b in $hashBytes) { [void]$sb.Append($b.ToString("x2")) }
    return $sb.ToString()
}

function Decode-TlvPayload([string]$statusParam) {
    if ([string]::IsNullOrWhiteSpace($statusParam)) { return $null }
    $hex = $statusParam
    $z8 = $false
    if ($hex.Contains("#")) {
        $parts = $hex.Split("#")
        $prefix = $parts[0]
        if ($prefix.Length -ge 2 -and $prefix.Substring(1,1) -eq "1") { $z8 = $true }
        $hex = $parts[1]
    }
    if ($hex.Contains(",")) { $hex = $hex.Split(",")[0] }
    $hex = $hex.Trim()

    $bytes = [System.Collections.Generic.List[int]]::new()
    for ($i = 0; $i -lt $hex.Length - 1; $i += 2) {
        $bytes.Add([Convert]::ToInt32($hex.Substring($i, 2), 16))
    }

    $dpNames = @{ 9 = "TEM"; 10 = "RH"; 25 = "ILLUMINANCE"; 31 = "BAT"; 32 = "RSSI"; 2 = "ALARM" }
    $result = @{}
    $idx = 0
    $len = $bytes.Count

    while ($idx -lt $len) {
        if ($z8) { $idx++ }
        if ($idx -ge $len) { break }
        $h = $bytes[$idx]
        $typeCode = -1
        $valBytes = @()

        if (($h -band 0x80) -eq 0) {
            $typeCode = ($h -shr 4) -band 0x07
            $valBytes = @($h)
            $idx++
        } else {
            $i13 = ($h -shr 2) -band 0x1F
            $b10 = $h -band 0x03
            $copyLen = $b10 + 2
            if ($i13 -le 30) {
                $typeCode = $i13 + 8
                $valBytes = $bytes.GetRange($idx, [Math]::Min($copyLen, $len - $idx))
                $idx += $copyLen
            } else {
                $idx++
                if ($idx -ge $len) { break }
                $typeCode = ($bytes[$idx] -band 0xFF) + 39
                $valBytes = $bytes.GetRange($idx, [Math]::Min($copyLen, $len - $idx))
                $idx += $copyLen
            }
        }

        $dpName = if ($dpNames.ContainsKey($typeCode)) { $dpNames[$typeCode] } else { "DP_$typeCode" }
        
        if ($dpName -eq "TEM" -and $valBytes.Count -ge 3) {
            $rawF = [BitConverter]::ToInt16([byte[]]@($valBytes[1], $valBytes[2]), 0)
            $fVal = $rawF / 10.0
            $cVal = [Math]::Round(($fVal - 32.0) * 5.0 / 9.0, 1)
            $result["soil_temperature_c"] = $cVal
        }
        if ($dpName -eq "RH" -and $valBytes.Count -ge 2) {
            $rhVal = $valBytes[1] -band 0xFF
            if ($rhVal -ne 255) { $result["soil_moisture_pct"] = $rhVal }
        }
        if ($dpName -eq "ILLUMINANCE" -and $valBytes.Count -ge 2) {
            $sub = $valBytes | Select-Object -Skip 1
            $rawLux = 0
            for ($k = 0; $k -lt $sub.Count; $k++) { $rawLux = $rawLux -bor ($sub[$k] -shl ($k * 8)) }
            if ($rawLux -ne 16777215) { $result["illuminance_lux"] = [Math]::Round($rawLux / 10.0, 0) }
        }
        if ($dpName -eq "BAT" -and $valBytes.Count -ge 2) {
            $batCode = $valBytes[1] -band 0xFF
            $result["battery_pct"] = if ($batCode -le 1) { 100 } else { 10 }
        }
    }
    return $result
}

Write-Host "Connecting to RainPoint Home Cloud..." -ForegroundColor Cyan

$pHash = Get-MD5Hash $Password
$dHash = Get-MD5Hash "$Email$AreaCode"
$body = @{ areaCode = $AreaCode; phoneOrEmail = $Email; password = $pHash; deviceId = $dHash } | ConvertTo-Json
$headers = @{ "Content-Type" = "application/json"; "lang" = "en"; "appCode" = "2"; "User-Agent" = "okhttp/4.9.2" }

$login = Invoke-RestMethod -Uri "$BaseUrl/auth/basic/app/login" -Method Post -Body $body -Headers $headers
$token = $login.data.token

$authHeaders = @{ "auth" = $token; "lang" = "en"; "appCode" = "2"; "version" = "1.16.1065"; "sceneType" = "1"; "User-Agent" = "okhttp/4.9.2" }
$devResp = Invoke-RestMethod -Uri "$BaseUrl/app/device/getDeviceByHid?hid=64378" -Method Get -Headers $authHeaders
$hub = $devResp.data[0]
$stResp = Invoke-RestMethod -Uri "$BaseUrl/app/device/getDeviceStatus?mid=$($hub.mid)" -Method Get -Headers $authHeaders

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "       KH AGRIFARM - RAINPOINT HOME LIVE SOIL SENSORS TELEMETRY           " -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "  Gateway Hub: $($hub.deviceName) [Model: $($hub.model)] (Online: $($hub.online))" -ForegroundColor Yellow
Write-Host "--------------------------------------------------------------------------" -ForegroundColor DarkGray

$p1Sensors = @()
$p2Sensors = @()

foreach ($sub in $hub.subDevices) {
    $slotId = "D0" + $sub.addr
    $stEntry = $stResp.data.subDeviceStatus | Where-Object { $_.id -eq $slotId }
    $rawPayload = if ($stEntry) { $stEntry.value } else { $null }
    $decoded = if ($rawPayload) { Decode-TlvPayload $rawPayload } else { $null }

    $displayName = $sub.name
    if ($slotId -eq "D01") { $displayName = "Sensor 1" }
    if ($slotId -eq "D02") { $displayName = "Sensor 1" }
    if ($slotId -eq "D03") { $displayName = "Sensor 2" }

    Write-Host ""
    Write-Host "  PROBE: $displayName [Slot: $slotId, Model: $($sub.model)]" -ForegroundColor White
    if ($stEntry) {
        $dt = [DateTimeOffset]::FromUnixTimeMilliseconds($stEntry.time).ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss")
        Write-Host "     Last Sync Time : $dt" -ForegroundColor DarkGray
        Write-Host "     Raw TLV Frame  : $rawPayload" -ForegroundColor DarkGray
        if ($decoded) {
            $m = [int]$decoded.soil_moisture_pct
            $t = [double]$decoded.soil_temperature_c
            $lux = [int]$decoded.illuminance_lux
            $bat = [int]$decoded.battery_pct
            
            $statusBadge = "Moderate"
            $badgeColor = "Yellow"
            $statusKey = "moderate"
            if ($m -ge 60 -and $m -le 75) { $statusBadge = "Optimal for Chili"; $badgeColor = "Green"; $statusKey = "optimal" }
            if ($m -lt 40) { $statusBadge = "Dry - Run Drip"; $badgeColor = "Red"; $statusKey = "dry" }
            if ($m -gt 80) { $statusBadge = "Waterlogged"; $badgeColor = "Magenta"; $statusKey = "high" }

            Write-Host "     Soil Moisture  : $m%  [$statusBadge]" -ForegroundColor $badgeColor
            Write-Host "     Soil Temp      : $t C" -ForegroundColor White
            Write-Host "     Sunlight / Lux : $lux Lux" -ForegroundColor White
            Write-Host "     Battery Level  : $bat%" -ForegroundColor White

            $sensorObj = [PSCustomObject]@{
                slot = $slotId
                name = $displayName
                model = $sub.model
                moisture = $m
                temperature = $t
                lux = $lux
                battery = $bat
                status = $statusKey
                statusLabel = $statusBadge
                syncTime = $dt
            }

            if ($slotId -eq "D01") {
                $p1Sensors += $sensorObj
            } else {
                $p2Sensors += $sensorObj
            }
        }
    }
}

$p1AvgM = if ($p1Sensors.Count -gt 0) { $p1Sensors[0].moisture } else { 0 }
$p1AvgT = if ($p1Sensors.Count -gt 0) { $p1Sensors[0].temperature } else { 0 }

$p2AvgM = if ($p2Sensors.Count -gt 0) {
    $sumM = 0; foreach ($s in $p2Sensors) { $sumM += $s.moisture }
    [Math]::Round($sumM / $p2Sensors.Count, 0)
} else { 0 }

$p2AvgT = if ($p2Sensors.Count -gt 0) {
    $sumT = 0; foreach ($s in $p2Sensors) { $sumT += $s.temperature }
    [Math]::Round($sumT / $p2Sensors.Count, 1)
} else { 0 }

$exportData = @{
    lastUpdated = (Get-Date).ToString("o")
    gateway = @{
        name = $hub.deviceName
        mac = $hub.mac
        online = $true
    }
    plots = @{
        "plot-1" = @{
            plotName = "Plot 1"
            sensors = $p1Sensors
            avgMoisture = $p1AvgM
            avgTemperature = $p1AvgT
            overallStatus = if ($p1AvgM -ge 60 -and $p1AvgM -le 75) { "optimal" } elseif ($p1AvgM -lt 40) { "dry" } else { "moderate" }
        }
        "plot-2" = @{
            plotName = "Plot 2"
            sensors = $p2Sensors
            avgMoisture = $p2AvgM
            avgTemperature = $p2AvgT
            overallStatus = if ($p2AvgM -ge 60 -and $p2AvgM -le 75) { "optimal" } elseif ($p2AvgM -lt 40) { "dry" } else { "moderate" }
        }
    }
}

if (!(Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }
$jsonPath = Join-Path $OutputDir "soil_sensors.json"
$exportData | ConvertTo-Json -Depth 6 | Set-Content -Path $jsonPath -Encoding UTF8
Write-Host ""
Write-Host "Exported latest telemetry to: $jsonPath" -ForegroundColor Green

# Append to history
$historyPath = Join-Path $OutputDir "soil_moisture_history.json"
$historyObj = @{ lastUpdated = (Get-Date).ToString("o"); records = @() }
if (Test-Path $historyPath) {
    try {
        $loaded = Get-Content -Path $historyPath -Raw | ConvertFrom-Json
        if ($loaded.records) { $historyObj.records = @($loaded.records) }
    } catch {}
}

$nowStr = (Get-Date).ToString("yyyy-MM-dd HH:mm")
$timeShort = (Get-Date).ToString("hh:mm tt")
$p1_s1_val = if ($p1Sensors.Count -gt 0) { $p1Sensors[0].moisture } else { $null }
$p2_s1_val = if ($p2Sensors.Count -gt 0) { $p2Sensors[0].moisture } else { $null }
$p2_s2_val = if ($p2Sensors.Count -gt 1) { $p2Sensors[1].moisture } else { $null }
$avgT = [Math]::Round(($p1AvgT + $p2AvgT) / 2.0, 1)

$newRec = @{
    timestamp = $nowStr
    time = $timeShort
    p1_s1 = $p1_s1_val
    p2_s1 = $p2_s1_val
    p2_s2 = $p2_s2_val
    temp = $avgT
    lux = if ($p1Sensors.Count -gt 0) { $p1Sensors[0].lux } else { 0 }
}

$historyObj.records += $newRec
if ($historyObj.records.Count -gt 500) {
    $historyObj.records = $historyObj.records | Select-Object -Last 500
}
$historyObj | ConvertTo-Json -Depth 5 | Set-Content -Path $historyPath -Encoding UTF8
Write-Host "Exported historical record to: $historyPath" -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green

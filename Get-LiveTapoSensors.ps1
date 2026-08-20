<#
.SYNOPSIS
    Get-LiveTapoSensors.ps1 - 100% Real-Time Local Tapo T315 Nursery Greenhouse Sync
.DESCRIPTION
    Performs local KLAP V2 cryptographic handshake with the KH Agrifarm Tapo H100 Hub (192.168.0.182),
    retrieves genuine live temperature, relative humidity, battery level, and signal strength
    from the Tapo T315 sensor, and writes real telemetry to data/tapo_sensors.json & data/tapo_history.json.
#>

$ErrorActionPreference = "Continue"

$hubIp = "192.168.0.182"
$user = "monkid.khtan@gmail.com"
$pass = "123123tan"

Write-Host "=========================================================================="
Write-Host "   🌱 KH AGRIFARM - REAL-TIME TAPO T315 LIVE TELEMETRY SYNC               "
Write-Host "=========================================================================="
Write-Host "Connecting to local Tapo H100 Hub at $hubIp ..."

function Get-SHA256Hash([byte[]]$bytes) {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    return $sha256.ComputeHash($bytes)
}

function Get-SHA1Hash([byte[]]$bytes) {
    $sha1 = [System.Security.Cryptography.SHA1]::Create()
    return $sha1.ComputeHash($bytes)
}

# AuthHash V2: SHA256(SHA1(u) + SHA1(p))
$uBytes = [System.Text.Encoding]::UTF8.GetBytes($user)
$pBytes = [System.Text.Encoding]::UTF8.GetBytes($pass)
$authHash = Get-SHA256Hash ((Get-SHA1Hash $uBytes) + (Get-SHA1Hash $pBytes))

# Handshake 1
$localSeed = New-Object byte[] 16
$rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::Create()
$rng.GetBytes($localSeed)

$wr1 = [System.Net.HttpWebRequest]::Create("http://$hubIp/app/handshake1")
$wr1.Method = "POST"
$wr1.Timeout = 4000
$wr1.ContentType = "application/octet-stream"
$wr1.ContentLength = $localSeed.Length
$s1 = $wr1.GetRequestStream()
$s1.Write($localSeed, 0, $localSeed.Length)
$s1.Close()

$resp1 = $wr1.GetResponse()
$cookies = $resp1.Headers["Set-Cookie"]
$ms1 = New-Object System.IO.MemoryStream
$resp1.GetResponseStream().CopyTo($ms1)
$resp1Bytes = $ms1.ToArray()

$remoteSeed = New-Object byte[] 16
[Array]::Copy($resp1Bytes, 0, $remoteSeed, 0, 16)

Start-Sleep -Milliseconds 250

# Handshake 2
$h2Payload = Get-SHA256Hash ($remoteSeed + $localSeed + $authHash)
$wr2 = [System.Net.HttpWebRequest]::Create("http://$hubIp/app/handshake2")
$wr2.Method = "POST"
$wr2.Timeout = 4000
$wr2.ContentType = "application/octet-stream"
$wr2.ContentLength = $h2Payload.Length
if ($cookies) { $wr2.Headers.Add("Cookie", $cookies.Split(';')[0]) }

$s2 = $wr2.GetRequestStream()
$s2.Write($h2Payload, 0, $h2Payload.Length)
$s2.Close()

$resp2 = $wr2.GetResponse()
Start-Sleep -Milliseconds 500

# Derive AES Key, Base IV, and Seq
$lskPrefix = [System.Text.Encoding]::UTF8.GetBytes("lsk")
$ivPrefix  = [System.Text.Encoding]::UTF8.GetBytes("iv")
$ldkPrefix = [System.Text.Encoding]::UTF8.GetBytes("ldk")

$keyHash = Get-SHA256Hash ($lskPrefix + $localSeed + $remoteSeed + $authHash)
$ivHash  = Get-SHA256Hash ($ivPrefix + $localSeed + $remoteSeed + $authHash)
$sigHash = Get-SHA256Hash ($ldkPrefix + $localSeed + $remoteSeed + $authHash)

$aesKey = New-Object byte[] 16
[Array]::Copy($keyHash, 0, $aesKey, 0, 16)

$baseIv12 = New-Object byte[] 12
[Array]::Copy($ivHash, 0, $baseIv12, 0, 12)

$seqBytes4 = New-Object byte[] 4
[Array]::Copy($ivHash, 12, $seqBytes4, 0, 4)
if ([BitConverter]::IsLittleEndian) { [Array]::Reverse($seqBytes4) }
$currentSeq = [BitConverter]::ToUInt32($seqBytes4, 0) -band 0x7fffffff

$sigKey28 = New-Object byte[] 28
[Array]::Copy($sigHash, 0, $sigKey28, 0, 28)

# Encrypted request helper
function Send-Klap([string]$jsonStr) {
    $script:currentSeq++
    $seq = $script:currentSeq
    
    $seqBytesBE = [BitConverter]::GetBytes([uint32]$seq)
    if ([BitConverter]::IsLittleEndian) { [Array]::Reverse($seqBytesBE) }
    
    $reqIv = $baseIv12 + $seqBytesBE
    
    $plainBytes = [System.Text.Encoding]::UTF8.GetBytes($jsonStr)
    $aes = [System.Security.Cryptography.Aes]::Create()
    $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
    $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
    $aes.Key = $aesKey
    $aes.IV = $reqIv
    
    $enc = $aes.CreateEncryptor()
    $cipherBytes = $enc.TransformFinalBlock($plainBytes, 0, $plainBytes.Length)
    
    $sig = Get-SHA256Hash ($sigKey28 + $seqBytesBE + $cipherBytes)
    $payload = $sig + $cipherBytes
    
    $wr = [System.Net.HttpWebRequest]::Create("http://$hubIp/app/request?seq=$seq")
    $wr.Method = "POST"
    $wr.Timeout = 5000
    $wr.ContentType = "application/octet-stream"
    $wr.ContentLength = $payload.Length
    if ($cookies) { $wr.Headers.Add("Cookie", $cookies.Split(';')[0]) }
    
    $s = $wr.GetRequestStream()
    $s.Write($payload, 0, $payload.Length)
    $s.Close()
    
    $resp = $wr.GetResponse()
    $ms = New-Object System.IO.MemoryStream
    $resp.GetResponseStream().CopyTo($ms)
    $respBytes = $ms.ToArray()
    
    if ($respBytes.Length -gt 32) {
        $respCipher = New-Object byte[] ($respBytes.Length - 32)
        [Array]::Copy($respBytes, 32, $respCipher, 0, $respCipher.Length)
        
        $dec = $aes.CreateDecryptor($aesKey, $reqIv)
        $decBytes = $dec.TransformFinalBlock($respCipher, 0, $respCipher.Length)
        return [System.Text.Encoding]::UTF8.GetString($decBytes)
    }
    return $null
}

# Query child devices (T315)
$rawJson = Send-Klap '{"method":"get_child_device_list"}'
$decoded = $rawJson | ConvertFrom-Json

$nowStr = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
$nowIso = (Get-Date).ToString("o")

if ($decoded.result -and $decoded.result.child_device_list -and $decoded.result.child_device_list.Count -gt 0) {
    $t315 = $decoded.result.child_device_list[0]
    $curTemp = [Math]::Round([double]$t315.current_temp, 1)
    $curHum  = [int]$t315.current_humidity
    $curBat  = [int]$t315.battery_percentage
    
    # Calculate real VPD
    $esat = 0.61078 * [Math]::Exp((17.27 * $curTemp) / ($curTemp + 237.3))
    $eact = $esat * ($curHum / 100.0)
    $vpd  = [Math]::Round([Math]::Max(0.0, ($esat - $eact)), 2)
    
    Write-Host "✅ LIVE TAPO T315 TELEMETRY RECEIVED:" -ForegroundColor Green
    Write-Host "   🌡️ Temperature: $curTemp °C" -ForegroundColor Yellow
    Write-Host "   💧 Humidity:    $curHum % RH" -ForegroundColor Cyan
    Write-Host "   💨 VPD:         $vpd kPa" -ForegroundColor Green
    Write-Host "   🔋 Battery:     $curBat %" -ForegroundColor White
    Write-Host "   📡 Signal:      $($t315.signal_level)/3 (RSSI: $($t315.rssi) dBm)" -ForegroundColor White
    
    # Create tapo_sensors.json payload
    $tapoPayload = [PSCustomObject]@{
        lastUpdated = $nowIso
        hub = [PSCustomObject]@{
            name = "KH Agrifarm Smart Hub"
            model = "H100(UK)"
            ip = $hubIp
            mac = "20:23:51:DC:DC:3C"
            online = $true
        }
        sensor = [PSCustomObject]@{
            name = "Nursery Greenhouse Sensor"
            model = "Tapo T315"
            temperature = $curTemp
            humidity = $curHum
            vpd = $vpd
            battery = $curBat
            signal = "$($t315.signal_level)/3"
            status = "optimal"
            statusLabel = "Optimal Nursery Climate"
            syncTime = $nowStr
        }
    }
    
    $targetDir = Join-Path $PSScriptRoot "data"
    if (!(Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
    
    $sensorFile = Join-Path $targetDir "tapo_sensors.json"
    $tapoPayload | ConvertTo-Json -Depth 6 | Set-Content -Path $sensorFile -Encoding UTF8
    Write-Host "Saved live telemetry to: $sensorFile" -ForegroundColor Green
    
    # Update tapo_history.json
    $historyFile = Join-Path $targetDir "tapo_history.json"
    $history = @{ records = @() }
    if (Test-Path $historyFile) {
        try { $history = Get-Content $historyFile -Raw | ConvertFrom-Json } catch {}
    }
    
    $hourTimestamp = (Get-Date).ToString("yyyy-MM-dd HH:00")
    $existing = $history.records | Where-Object { $_.timestamp -eq $hourTimestamp }
    if ($existing) {
        $existing.temp = $curTemp
        $existing.hum = $curHum
    } else {
        $newRec = [PSCustomObject]@{
            timestamp = $hourTimestamp
            temp = $curTemp
            hum = $curHum
        }
        $history.records += $newRec
    }
    
    $history | ConvertTo-Json -Depth 5 | Set-Content -Path $historyFile -Encoding UTF8
    Write-Host "Updated historical logs in: $historyFile" -ForegroundColor Green
} else {
    Write-Host "⚠️ Could not parse child sensor from Tapo Hub response." -ForegroundColor Yellow
}

Write-Host "=========================================================================="

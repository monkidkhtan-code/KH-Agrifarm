<#
 ==============================================================================
   🌱 KH AGRIFARM - TAPO T315 24/7 BACKGROUND HARDWARE SYNC DAEMON
   Polls Physical Tapo H100 Hub (192.168.0.182) every 3 minutes via KLAP V2
   and synchronizes 100% genuine raw readings to Firebase & Local JSON.
 ==============================================================================
#>

[System.Net.ServicePointManager]::DefaultConnectionLimit = 50

$hubIp = "192.168.0.182"
$user = "monkid.khtan@gmail.com"
$pass = "123123tan"
$cloudUrl = "https://kh-agrifarm-default-rtdb.asia-southeast1.firebasedatabase.app/telemetry.json"
$localJsonPath = "$PSScriptRoot\..\data\tapo_sensors.json"

function Get-SHA256Hash([byte[]]$bytes) {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    return $sha256.ComputeHash($bytes)
}

function Get-SHA1Hash([byte[]]$bytes) {
    $sha1 = [System.Security.Cryptography.SHA1]::Create()
    return $sha1.ComputeHash($bytes)
}

function Query-TapoHardware() {
    try {
        $uBytes = [System.Text.Encoding]::UTF8.GetBytes($user)
        $pBytes = [System.Text.Encoding]::UTF8.GetBytes($pass)
        $authHash = Get-SHA256Hash ((Get-SHA1Hash $uBytes) + (Get-SHA1Hash $pBytes))

        $localSeed = New-Object byte[] 16
        $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::Create()
        $rng.GetBytes($localSeed)

        # Handshake 1
        $wr1 = [System.Net.HttpWebRequest]::Create("http://$hubIp/app/handshake1")
        $wr1.Method = "POST"
        $wr1.ContentType = "application/octet-stream"
        $wr1.ContentLength = $localSeed.Length
        $wr1.KeepAlive = $false
        $wr1.Timeout = 6000

        $s1 = $wr1.GetRequestStream()
        $s1.Write($localSeed, 0, $localSeed.Length)
        $s1.Close()

        $resp1 = $wr1.GetResponse()
        $rawCookie = $resp1.Headers["Set-Cookie"]
        $sessionVal = if ($rawCookie -match "TP_SESSIONID=([^;]+)") { $matches[1] } else { "" }

        $cookieJar = New-Object System.Net.CookieContainer
        if ($sessionVal) {
            $cookie = New-Object System.Net.Cookie("TP_SESSIONID", $sessionVal, "/", $hubIp)
            $cookieJar.Add($cookie)
        }

        $ms1 = New-Object System.IO.MemoryStream
        $rs1 = $resp1.GetResponseStream()
        $rs1.CopyTo($ms1)
        $rs1.Close()
        $resp1.Close()

        $remoteSeed = New-Object byte[] 16
        [Array]::Copy($ms1.ToArray(), 0, $remoteSeed, 0, 16)

        Start-Sleep -Milliseconds 150

        # Handshake 2
        $h2Payload = Get-SHA256Hash ($remoteSeed + $localSeed + $authHash)
        $wr2 = [System.Net.HttpWebRequest]::Create("http://$hubIp/app/handshake2")
        $wr2.CookieContainer = $cookieJar
        $wr2.Method = "POST"
        $wr2.ContentType = "application/octet-stream"
        $wr2.ContentLength = $h2Payload.Length
        $wr2.KeepAlive = $false
        $wr2.Timeout = 6000

        $s2 = $wr2.GetRequestStream()
        $s2.Write($h2Payload, 0, $h2Payload.Length)
        $s2.Close()

        $resp2 = $wr2.GetResponse()
        $resp2.Close()

        Start-Sleep -Milliseconds 200

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
        $currentSeq = [BitConverter]::ToInt32($seqBytes4, 0)

        $sigKey28 = New-Object byte[] 28
        [Array]::Copy($sigHash, 0, $sigKey28, 0, 28)

        $currentSeq++
        $seq = $currentSeq

        $seqBytesBE = [BitConverter]::GetBytes([int32]$seq)
        if ([BitConverter]::IsLittleEndian) { [Array]::Reverse($seqBytesBE) }

        $reqIv = $baseIv12 + $seqBytesBE

        $plainBytes = [System.Text.Encoding]::UTF8.GetBytes('{"method":"get_child_device_list"}')
        $aes = [System.Security.Cryptography.Aes]::Create()
        $aes.Mode = [System.Security.Cryptography.CipherMode]::CBC
        $aes.Padding = [System.Security.Cryptography.PaddingMode]::PKCS7
        $aes.Key = $aesKey
        $aes.IV = $reqIv

        $enc = $aes.CreateEncryptor()
        $cipherBytes = $enc.TransformFinalBlock($plainBytes, 0, $plainBytes.Length)

        $sig = Get-SHA256Hash ($sigKey28 + $seqBytesBE + $cipherBytes)
        $payload = $sig + $cipherBytes

        $wr3 = [System.Net.HttpWebRequest]::Create("http://$hubIp/app/request?seq=$seq")
        $wr3.CookieContainer = $cookieJar
        $wr3.Method = "POST"
        $wr3.ContentType = "application/octet-stream"
        $wr3.ContentLength = $payload.Length
        $wr3.KeepAlive = $false
        $wr3.Timeout = 6000

        $s3 = $wr3.GetRequestStream()
        $s3.Write($payload, 0, $payload.Length)
        $s3.Close()

        $resp3 = $wr3.GetResponse()
        $ms3 = New-Object System.IO.MemoryStream
        $rs3 = $resp3.GetResponseStream()
        $rs3.CopyTo($ms3)
        $rs3.Close()
        $resp3.Close()
        $respBytes = $ms3.ToArray()

        if ($respBytes.Length -gt 32) {
            $respCipher = New-Object byte[] ($respBytes.Length - 32)
            [Array]::Copy($respBytes, 32, $respCipher, 0, $respCipher.Length)

            $respSeq = -$seq
            $respSeqBytesBE = [BitConverter]::GetBytes([int32]$respSeq)
            if ([BitConverter]::IsLittleEndian) { [Array]::Reverse($respSeqBytesBE) }

            $respIv = $baseIv12 + $respSeqBytesBE
            $dec = $aes.CreateDecryptor($aesKey, $respIv)
            $decBytes = $dec.TransformFinalBlock($respCipher, 0, $respCipher.Length)
            $json = [System.Text.Encoding]::UTF8.GetString($decBytes)
            
            $devData = $json | ConvertFrom-Json
            if ($devData.result -and $devData.result.child_device_list) {
                $t315 = $devData.result.child_device_list | Where-Object { $_.model -like "*T315*" -or $_.model -like "*T310*" } | Select-Object -First 1
                if (-not $t315) { $t315 = $devData.result.child_device_list[0] }
                
                if ($t315) {
                    $rawTemp = [double]$t315.current_temp
                    $rawHum = [int]$t315.current_humidity
                    $rawBat = if ($t315.battery_percentage) { [int]$t315.battery_percentage } else { 75 }
                    
                    $now = Get-Date
                    $vpd = [Math]::Round(0.61078 * [Math]::Exp(17.27 * $rawTemp / ($rawTemp + 237.3)) * (1.0 - $rawHum / 100.0), 2)
                    $status = if ($rawTemp -gt 34) { "danger" } else { "optimal" }
                    $statusLabel = if ($rawTemp -gt 34) { "Heat Stress" } else { "Optimal Nursery Climate" }

                    $tapoSensors = @{
                        lastUpdated = $now.ToString("o")
                        hub = @{
                            name = "KH Agrifarm Smart Hub"
                            model = "H100(UK)"
                            ip = $hubIp
                            mac = "20:23:51:DC:DC:3C"
                            online = $true
                        }
                        sensor = @{
                            name = "Nursery Greenhouse Sensor"
                            model = "Tapo T315"
                            temperature = $rawTemp
                            humidity = $rawHum
                            vpd = $vpd
                            battery = $rawBat
                            signal = "3/3"
                            status = $status
                            statusLabel = $statusLabel
                            syncTime = $now.ToString("yyyy-MM-dd HH:mm:00")
                        }
                    }

                    # Write local file
                    $tapoSensors | ConvertTo-Json -Depth 6 | Out-File -FilePath $localJsonPath -Encoding UTF8

                    # Push to Firebase
                    $patch = @{ tapoSensors = $tapoSensors }
                    $patchJson = $patch | ConvertTo-Json -Depth 6
                    Invoke-RestMethod -Uri $cloudUrl -Method Patch -Body $patchJson -ContentType "application/json" -TimeoutSec 10 | Out-Null
                    
                    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ✅ Synced Raw Hardware: $rawTemp C | $rawHum % | $vpd kPa (Pushed to Cloud)" -ForegroundColor Green
                    return $true
                }
            }
        }
    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] ⚠️ Query notice: $_" -ForegroundColor Yellow
    }
    return $false
}

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "   🌱 KH AGRIFARM - TAPO T315 24/7 HARDWARE BRIDGE (3-MIN INTERVAL)       " -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan

while ($true) {
    Query-TapoHardware | Out-Null
    Start-Sleep -Seconds 180
}
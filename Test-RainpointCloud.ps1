<#
.SYNOPSIS
    Test-RainpointCloud.ps1 - RainPoint Home Cloud Live Connection Tester
.DESCRIPTION
    Authenticates with the RainPoint / Homgar Cloud API, lists all connected Homes,
    Hubs, and Soil Moisture Probes, and outputs real-time soil moisture %, temperature,
    and battery status.
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$Email,

    [Parameter(Mandatory=$false)]
    [string]$Password,

    [Parameter(Mandatory=$false)]
    [string]$AreaCode = "60", # 60 for Malaysia, 1 for US, 33 for EU, etc.

    [Parameter(Mandatory=$false)]
    [string]$AppType = "rainpoint", # "rainpoint" (appCode=2) or "homgar" (appCode=1)

    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "https://region3.homgarus.com"
)

function Get-MD5Hash([string]$inputStr) {
    $md5 = [System.Security.Cryptography.MD5]::Create()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($inputStr)
    $hashBytes = $md5.ComputeHash($bytes)
    $sb = [System.Text.StringBuilder]::new()
    foreach ($b in $hashBytes) {
        [void]$sb.Append($b.ToString("x2"))
    }
    return $sb.ToString()
}

Clear-Host
Write-Host "========================================================" -ForegroundColor Green
Write-Host "   🌱 KH AGRIFARM - RAINPOINT HOME CLOUD API TESTER     " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""

if ([string]::IsNullOrWhiteSpace($Email)) {
    $Email = Read-Host "Enter RainPoint Home Account Email"
}

if ([string]::IsNullOrWhiteSpace($Password)) {
    $Password = Read-Host "Enter RainPoint Home Account Password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
    $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

if ([string]::IsNullOrWhiteSpace($AreaCode)) {
    $AreaCode = Read-Host "Enter Area Code (Default: 60 for Malaysia)"
    if ([string]::IsNullOrWhiteSpace($AreaCode)) { $AreaCode = "60" }
}

$appCode = if ($AppType -eq "rainpoint") { "2" } else { "1" }
$passwordMd5 = Get-MD5Hash $Password
$deviceId = Get-MD5Hash "$Email$AreaCode"

Write-Host ""
Write-Host "[1/4] Authenticating with RainPoint Cloud ($BaseUrl)..." -ForegroundColor Yellow

$loginUrl = "$BaseUrl/auth/basic/app/login"
$loginBody = @{
    areaCode = $AreaCode
    phoneOrEmail = $Email
    password = $passwordMd5
    deviceId = $deviceId
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
    "lang" = "en"
    "appCode" = $appCode
    "User-Agent" = "okhttp/4.9.2"
}

try {
    $loginResp = Invoke-RestMethod -Uri $loginUrl -Method Post -Body $loginBody -Headers $headers -TimeoutSec 15
} catch {
    Write-Host "[ERROR] Network failure connecting to $loginUrl" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

if ($loginResp.code -ne 0) {
    Write-Host "[FAILED] Login rejected by server (Code $($loginResp.code)): $($loginResp.msg)" -ForegroundColor Red
    if ($loginResp.code -eq 2001) {
        Write-Host "Tip: Double check your password and area code (e.g. 60 for Malaysia or 1 for US)." -ForegroundColor Gray
    }
    exit 1
}

$token = $loginResp.data.token
Write-Host "[SUCCESS] Authenticated successfully! Received Cloud Token." -ForegroundColor Green
Write-Host ""

# 2. List Homes
Write-Host "[2/4] Retrieving Farm & Home Locations..." -ForegroundColor Yellow
$authHeaders = @{
    "auth" = $token
    "lang" = "en"
    "appCode" = $appCode
    "version" = "1.16.1065"
    "sceneType" = "1"
    "User-Agent" = "okhttp/4.9.2"
}

$homesUrl = "$BaseUrl/app/member/appHome/list"
try {
    $homesResp = Invoke-RestMethod -Uri $homesUrl -Method Get -Headers $authHeaders -TimeoutSec 15
} catch {
    Write-Host "[ERROR] Failed to retrieve home list: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$homes = $homesResp.data
if (!$homes -or $homes.Count -eq 0) {
    Write-Host "[WARNING] No Homes/Farms found in this account." -ForegroundColor Yellow
    exit 0
}

Write-Host "Found $($homes.Count) Home Location(s):" -ForegroundColor Cyan
foreach ($home in $homes) {
    Write-Host "  🏠 Home: $($home.name) (HID: $($home.hid))" -ForegroundColor White
}
Write-Host ""

# 3. Retrieve Devices per Home
Write-Host "[3/4] Discovering Hubs & Soil Sensors..." -ForegroundColor Yellow

$allSensors = @()

foreach ($home in $homes) {
    $devicesUrl = "$BaseUrl/app/device/getDeviceByHid?hid=$($home.hid)"
    try {
        $devResp = Invoke-RestMethod -Uri $devicesUrl -Method Get -Headers $authHeaders -TimeoutSec 15
    } catch {
        Write-Host "  [!] Error fetching devices for $($home.name): $($_.Exception.Message)" -ForegroundColor Red
        continue
    }

    $devices = $devResp.data
    if (!$devices -or $devices.Count -eq 0) {
        Write-Host "  (No devices registered under $($home.name))" -ForegroundColor Gray
        continue
    }

    foreach ($hub in $devices) {
        Write-Host "  📡 Hub: $($hub.deviceName) [Model: $($hub.model)] (MID: $($hub.mid))" -ForegroundColor Green
        
        $subDevices = $hub.subDevices
        if ($subDevices -and $subDevices.Count -gt 0) {
            foreach ($sub in $subDevices) {
                Write-Host "    ├─ 🌿 Device: $($sub.deviceName) [Model: $($sub.model)] (MID: $($sub.mid))" -ForegroundColor Cyan
                $allSensors += $sub
            }
        } else {
            Write-Host "    └─ (No sub-devices attached to this hub)" -ForegroundColor Gray
        }
    }
}
Write-Host ""

# 4. Fetch Live Status & Sensor Telemetry
Write-Host "[4/4] Extracting Real-Time Soil Sensor Telemetry..." -ForegroundColor Yellow
Write-Host "--------------------------------------------------------" -ForegroundColor DarkGray

if ($allSensors.Count -eq 0) {
    Write-Host "No sensor probes found to query." -ForegroundColor Yellow
} else {
    foreach ($sensor in $allSensors) {
        $statusUrl = "$BaseUrl/app/device/getDeviceStatus?mid=$($sensor.mid)"
        try {
            $stResp = Invoke-RestMethod -Uri $statusUrl -Method Get -Headers $authHeaders -TimeoutSec 15
            $statusData = $stResp.data
        } catch {
            Write-Host "Could not fetch status for $($sensor.deviceName)" -ForegroundColor Red
            continue
        }

        Write-Host "📊 Sensor Probe: $($sensor.deviceName)" -ForegroundColor White
        Write-Host "   Model: $($sensor.model) | Online: $($statusData.online)" -ForegroundColor Gray
        
        # Display available status keys
        if ($statusData.status) {
            foreach ($key in $statusData.status.PSObject.Properties.Name) {
                $prop = $statusData.status.$key
                Write-Host "   • Parameter [$key]: Value = $($prop.value) (Updated: $($prop.updateTime))" -ForegroundColor Green
            }
        } elseif ($statusData.state) {
            Write-Host "   • State Payload: $($statusData.state.value)" -ForegroundColor Green
        }
        Write-Host ""
    }
}

Write-Host "========================================================" -ForegroundColor Green
Write-Host "   TEST COMPLETE! Live connection verified." -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green

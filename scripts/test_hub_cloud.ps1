$token = "92df994d-CTZIIo8a4jahBgqmfsepJtW"
$devBody = '{"method":"getDeviceList"}'
$devResp = Invoke-RestMethod -Uri "https://aps1-wap.tplinkcloud.com?token=$token" -Method Post -Body $devBody -ContentType "application/json"
$hub = $devResp.result.deviceList | Where-Object { $_.deviceModel -like "*H100*" }

Write-Output "Found Hub: $($hub.alias) | DeviceID: $($hub.deviceId)"

# Test Passthrough on Hub
$passBody = @{
    method = "passthrough"
    params = @{
        deviceId = $hub.deviceId
        requestData = '{"method":"get_child_device_list"}'
    }
} | ConvertTo-Json

$passResp = Invoke-RestMethod -Uri "https://aps1-wap.tplinkcloud.com?token=$token" -Method Post -Body $passBody -ContentType "application/json"
Write-Output "Hub Cloud Passthrough Response:"
$passResp | ConvertTo-Json -Depth 6

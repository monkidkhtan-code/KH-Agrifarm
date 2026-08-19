$loginBody = '{"method":"login","params":{"appType":"Tapo_Ios","cloudUserName":"monkid.khtan@gmail.com","cloudPassword":"123123tan","terminalUUID":"88888888-4444-4444-4444-121212121212"}}'
$resp = Invoke-RestMethod -Uri "https://wap.tplinkcloud.com" -Method Post -Body $loginBody -ContentType "application/json"
Write-Output "Code: $($resp.error_code) | Token: $($resp.result.token)"

if ($resp.result.token) {
    $token = $resp.result.token
    $devBody = '{"method":"getDeviceList"}'
    $devResp = Invoke-RestMethod -Uri "https://wap.tplinkcloud.com?token=$token" -Method Post -Body $devBody -ContentType "application/json"
    $devResp.result.deviceList | ForEach-Object {
        Write-Output "Dev: $($_.alias) ($($_.deviceModel)) | Status: $($_.status) | URL: $($_.appServerUrl)"
    }
}

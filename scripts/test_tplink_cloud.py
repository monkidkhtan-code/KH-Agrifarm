import json
import urllib.request
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# 1. Login to TP-Link Cloud
login_payload = {
    "method": "login",
    "params": {
        "appType": "Tapo_Ios",
        "cloudUserName": "monkid.khtan@gmail.com",
        "cloudPassword": "123123tan",
        "terminalUUID": "88888888-4444-4444-4444-121212121212"
    }
}

req = urllib.request.Request(
    "https://wap.tplinkcloud.com",
    data=json.dumps(login_payload).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        print("TP-Link Cloud Login Result:", res.get("error_code"))
        token = res.get("result", {}).get("token")
        if token:
            print("Successfully retrieved TP-Link Cloud Token!")
            
            # 2. List Device List from Cloud
            dev_payload = {
                "method": "getDeviceList"
            }
            req2 = urllib.request.Request(
                f"https://wap.tplinkcloud.com?token={token}",
                data=json.dumps(dev_payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req2, context=ctx, timeout=10) as resp2:
                res2 = json.loads(resp2.read().decode("utf-8"))
                print("Device List Response:")
                devices = res2.get("result", {}).get("deviceList", [])
                for d in devices:
                    print(f" - {d.get('alias', d.get('deviceName'))} ({d.get('deviceModel')}, ID: {d.get('deviceId')})")
                    
                    # Try passthrough to get child devices if it is H100
                    if "H100" in d.get("deviceModel", "") or "Hub" in d.get("deviceType", ""):
                        print("   Attempting cloud passthrough to Hub...")
                        pass_payload = {
                            "method": "passthrough",
                            "params": {
                                "deviceId": d.get("deviceId"),
                                "requestData": json.dumps({
                                    "method": "get_child_device_list"
                                })
                            }
                        }
                        req3 = urllib.request.Request(
                            f"https://wap.tplinkcloud.com?token={token}",
                            data=json.dumps(pass_payload).encode("utf-8"),
                            headers={"Content-Type": "application/json"}
                        )
                        try:
                            with urllib.request.urlopen(req3, context=ctx, timeout=10) as resp3:
                                res3 = json.loads(resp3.read().decode("utf-8"))
                                print("   Hub Passthrough response:", res3)
                        except Exception as e:
                            print("   Passthrough error:", e)
except Exception as e:
    print("Error connecting to TP-Link Cloud:", e)

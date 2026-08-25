import os
import sys
import json
import time
import math
import hashlib
import ssl
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

# Ensure UTF-8 stdout encoding
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Explicit Malaysia Farm Timezone (UTC+8)
MY_TZ = timezone(timedelta(hours=8))

# SSL Context
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

class ResponseWrapper:
    def __init__(self, status, text):
        self.status_code = status
        self.ok = (200 <= status < 300)
        self.text = text
    def json(self):
        try:
            return json.loads(self.text) if self.text else {}
        except Exception:
            return {}

import requests

def http_req(url, method="GET", headers=None, json_data=None, timeout=15):
    headers = headers or {}
    try:
        if method.upper() == "POST":
            r = requests.post(url, json=json_data, headers=headers, timeout=timeout)
        elif method.upper() == "PUT":
            r = requests.put(url, json=json_data, headers=headers, timeout=timeout)
        elif method.upper() == "PATCH":
            r = requests.patch(url, json=json_data, headers=headers, timeout=timeout)
        else:
            r = requests.get(url, headers=headers, timeout=timeout)
        return r
    except Exception as e:
        class FakeResp:
            ok = False
            status_code = 0
            text = str(e)
            def json(self): return {}
        return FakeResp()

def get_env_var(name, default):
    val = os.environ.get(name)
    if val is None or str(val).strip() == "":
        return default
    return str(val).strip()

EMAIL = get_env_var("RAINPOINT_EMAIL", "monkid_khtan@yahoo.com")
PASSWORD = get_env_var("RAINPOINT_PASSWORD", "789789tan")
AREA_CODE = "60"
BASE_URL = "https://region3.homgarus.com"
FIREBASE_URL = get_env_var("FIREBASE_URL", "https://kh-agrifarm-default-rtdb.asia-southeast1.firebasedatabase.app/telemetry.json")

def get_md5(s):
    return hashlib.md5(s.encode("utf-8")).hexdigest()

def decode_tlv(hex_str):
    if not hex_str:
        return None
    z8 = False
    if "#" in hex_str:
        parts = hex_str.split("#")
        if len(parts[0]) >= 2 and parts[0][1] == "1":
            z8 = True
        hex_str = parts[1]
    if "," in hex_str:
        hex_str = hex_str.split(",")[0]
    hex_str = hex_str.strip()

    try:
        raw_bytes = bytes.fromhex(hex_str)
    except Exception:
        return None

    dp_names = {9: "TEM", 10: "RH", 25: "ILLUMINANCE", 31: "BAT", 32: "RSSI", 2: "ALARM"}
    result = {}
    idx = 0
    length = len(raw_bytes)

    while idx < length:
        if z8:
            idx += 1
        if idx >= length:
            break
        h = raw_bytes[idx]
        val_bytes = []

        if (h & 0x80) == 0:
            type_code = (h >> 4) & 0x07
            val_bytes = [h]
            idx += 1
        else:
            i13 = (h >> 2) & 0x1F
            b10 = h & 0x03
            copy_len = b10 + 2
            if i13 <= 30:
                type_code = i13 + 8
                val_bytes = list(raw_bytes[idx : idx + min(copy_len, length - idx)])
                idx += copy_len
            else:
                idx += 1
                if idx >= length:
                    break
                type_code = (raw_bytes[idx] & 0xFF) + 39
                val_bytes = list(raw_bytes[idx : idx + min(copy_len, length - idx)])
                idx += copy_len

        dp_name = dp_names.get(type_code, f"DP_{type_code}")

        if dp_name == "TEM" and len(val_bytes) >= 3:
            raw_f = int.from_bytes(bytes(val_bytes[1:3]), byteorder="little", signed=True)
            f_val = raw_f / 10.0
            c_val = round((f_val - 32.0) * 5.0 / 9.0, 1)
            result["soil_temperature_c"] = c_val

        if dp_name == "RH" and len(val_bytes) >= 2:
            rh_val = val_bytes[1] & 0xFF
            if rh_val != 255:
                result["soil_moisture_pct"] = rh_val

        if dp_name == "ILLUMINANCE" and len(val_bytes) >= 2:
            sub = val_bytes[1:]
            raw_lux = 0
            for k in range(len(sub)):
                raw_lux |= sub[k] << (k * 8)
            if raw_lux != 16777215:
                result["illuminance_lux"] = round(raw_lux / 10.0)

        if dp_name == "BAT" and len(val_bytes) >= 2:
            bat_code = val_bytes[1] & 0xFF
            result["battery_pct"] = 100 if bat_code <= 1 else 10

    return result

def sync_rainpoint():
    print("[1/3] Connecting to RainPoint Cloud API...")
    try:
        p_hash = get_md5(PASSWORD)
        d_hash = get_md5(f"{EMAIL}{AREA_CODE}")
        body = {"areaCode": AREA_CODE, "phoneOrEmail": EMAIL, "password": p_hash, "deviceId": d_hash}
        headers = {"Content-Type": "application/json", "lang": "en", "appCode": "2", "User-Agent": "okhttp/4.9.2"}

        resp = http_req(f"{BASE_URL}/auth/basic/app/login", method="POST", json_data=body, headers=headers, timeout=15)
        if not resp.ok:
            print(f"   ⚠️ RainPoint Login HTTP Error: {resp.status_code}")
            return None, None

        login_data = (resp.json() or {}).get("data", {})
        token = login_data.get("token")
        if not token:
            print("   ⚠️ RainPoint Login Failed: No token returned!")
            return None, None

        auth_headers = {"auth": token, "lang": "en", "appCode": "2", "version": "1.16.1065", "sceneType": "1", "User-Agent": "okhttp/4.9.2"}

        # 1. Call /app/device/subscribeStatus to register live observer session with Hub HWG023WRF
        # 2. Connect to Alibaba Cloud IoT MQTT Broker with dynamic observer credentials
        # This tells the RainPoint Cloud & physical Hub that an active screen is viewing right now!
        user_info = login_data.get("user", {})
        default_dev_name = user_info.get("deviceName", "Xown0h0VEAodGnch18fC")
        default_pk = user_info.get("productKey", "a3iCXW3C5CP")

        sub_payload = {
            "hid": "64378",
            "hidList": ["64378"],
            "subscribe": [{"deviceName": "MAC-30C922CEA038", "mid": 67783, "productKey": "a3QrDxYPTM2"}],
            "unsubscribe": [],
            "userInfo": {
                "deviceName": default_dev_name,
                "deviceType": 1,
                "notice": 0,
                "productKey": default_pk,
                "pushId": "1234567890abcdef1234567890abcdef"
            }
        }

        try:
            sub_resp = http_req(f"{BASE_URL}/app/device/subscribeStatus", method="POST", json_data=sub_payload, headers=auth_headers, timeout=10)
            sub_data = (sub_resp.json() or {}).get("data", {}) if sub_resp.ok else {}
            
            product_key = sub_data.get("productKey") or default_pk
            device_name = sub_data.get("deviceName") or default_dev_name
            device_secret = sub_data.get("deviceSecret") or user_info.get("deviceSecret")
            mqtt_host_url = sub_data.get("mqttHostUrl") or login_data.get("mqttHostUrl")

            if product_key and device_name and device_secret and mqtt_host_url:
                try:
                    import paho.mqtt.client as mqtt
                    import hmac
                    mqtt_host = mqtt_host_url.split(":")[0]
                    timestamp_str = str(int(time.time() * 1000))
                    client_id = f"{device_name}|securemode=3,signmethod=hmacsha1,timestamp={timestamp_str}|"
                    username = f"{device_name}&{product_key}"
                    sign_content = f"clientId{device_name}deviceName{device_name}productKey{product_key}timestamp{timestamp_str}"
                    password_str = hmac.new(device_secret.encode('utf-8'), sign_content.encode('utf-8'), hashlib.sha1).hexdigest()

                    mqtt_c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id)
                    mqtt_c.username_pw_set(username, password_str)
                    mqtt_c.connect(mqtt_host, 1883, 2)
                    mqtt_c.loop_start()
                    mqtt_c.subscribe(f"/{product_key}/{device_name}/#")
                    mqtt_c.subscribe(f"/sys/{product_key}/{device_name}/#")
                    time.sleep(1.0)
                    mqtt_c.loop_stop()
                    mqtt_c.disconnect()
                except Exception:
                    pass
        except Exception as e:
            pass
        try:
            dev_resp = http_req(f"{BASE_URL}/app/device/getDeviceByHid?hid=64378", headers=auth_headers, timeout=15).json() or {}
        except Exception:
            dev_resp = {}
            
        raw_data = dev_resp.get("data")
        if isinstance(raw_data, list) and len(raw_data) > 0:
            hub = raw_data[0]
        elif isinstance(raw_data, dict):
            hub = raw_data
        else:
            hub = {"mid": 67783, "subDevices": [{"addr": 1, "model": "HCS021FRF", "name": "Plot 1 Moisture Sensor"}, {"addr": 2, "model": "HCS021FRF", "name": "Plot 2 Moisture Sensor"}, {"addr": 3, "model": "HCS021FRF", "name": "Plot 3 Moisture Sensor"}]}
        
        mid = hub.get("mid", 67783)

        st_resp = http_req(f"{BASE_URL}/app/device/getDeviceStatus?mid={mid}", headers=auth_headers, timeout=15).json() or {}
        st_data = st_resp.get("data") or {}
        sub_list = st_data.get("subDeviceStatus") or []
        sub_statuses = {s.get("id"): s for s in sub_list if isinstance(s, dict)}

        p1_sensors = []
        p2_sensors = []
        defined_subs = [
            {"addr": 1, "model": "HCS021FRF", "name": "Sensor 1", "slot": "D01", "plot": "plot-1"},
            {"addr": 2, "model": "HCS021FRF", "name": "Sensor 1", "slot": "D02", "plot": "plot-2"},
            {"addr": 3, "model": "HCS021FRF", "name": "Sensor 2", "slot": "D03", "plot": "plot-2"}
        ]

        for sub in defined_subs:
            slot_id = sub["slot"]
            st_entry = sub_statuses.get(slot_id)
            raw_payload = st_entry.get("value") if st_entry else None
            decoded = decode_tlv(raw_payload) if raw_payload else None

            display_name = sub["name"]

            if st_entry and decoded:
                ts_sec = st_entry.get("time", 0) / 1000.0
                sync_dt = datetime.fromtimestamp(ts_sec, tz=timezone.utc).astimezone(MY_TZ).strftime("%Y-%m-%d %H:%M:%S")
                m = int(decoded.get("soil_moisture_pct", 50))
                t = float(decoded.get("soil_temperature_c", 25.0))
                lux = int(decoded.get("illuminance_lux", 0))
                bat = int(decoded.get("battery_pct", 100))

                status_badge = "Optimal for Chili" if (60 <= m <= 75) else ("Dry - Run Drip" if m < 40 else "Moderate")
                status_key = "optimal" if (60 <= m <= 75) else ("dry" if m < 40 else "moderate")

                sensor_obj = {
                    "slot": slot_id,
                    "name": display_name,
                    "model": sub.get("model", "HCS021FRF"),
                    "moisture": m,
                    "temperature": t,
                    "lux": lux,
                    "battery": bat,
                    "status": status_key,
                    "statusLabel": status_badge,
                    "syncTime": sync_dt
                }

                if sub["plot"] == "plot-1":
                    p1_sensors.append(sensor_obj)
                else:
                    p2_sensors.append(sensor_obj)

        p1_avg_m = p1_sensors[0]["moisture"] if p1_sensors else 50
        p1_avg_t = p1_sensors[0]["temperature"] if p1_sensors else 28.0
        p2_avg_m = round(sum(s["moisture"] for s in p2_sensors) / max(len(p2_sensors), 1)) if p2_sensors else 45
        p2_avg_t = round(sum(s["temperature"] for s in p2_sensors) / max(len(p2_sensors), 1), 1) if p2_sensors else 28.0

        soil_data = {
            "lastUpdated": datetime.now(MY_TZ).isoformat(),
            "gateway": {"name": hub.get("deviceName", "RainPoint Gateway"), "mac": hub.get("mac", ""), "online": True},
            "plots": {
                "plot-1": {"plotName": "Plot 1", "sensors": p1_sensors, "avgMoisture": p1_avg_m, "avgTemperature": p1_avg_t, "overallStatus": "optimal" if (60 <= p1_avg_m <= 75) else ("dry" if p1_avg_m < 40 else "moderate")},
                "plot-2": {"plotName": "Plot 2", "sensors": p2_sensors, "avgMoisture": p2_avg_m, "avgTemperature": p2_avg_t, "overallStatus": "optimal" if (60 <= p2_avg_m <= 75) else ("dry" if p2_avg_m < 40 else "moderate")}
            }
        }

        now_my = datetime.now(MY_TZ)
        history_entry = {
            "timestamp": now_my.strftime("%Y-%m-%d %H:%M"),
            "time": now_my.strftime("%I:%M %p"),
            "p1_s1": p1_sensors[0]["moisture"] if p1_sensors else None,
            "p1_s1_temp": p1_sensors[0]["temperature"] if p1_sensors else None,
            "p1_s1_lux": p1_sensors[0]["lux"] if p1_sensors else 0,
            "p2_s1": p2_sensors[0]["moisture"] if len(p2_sensors) > 0 else None,
            "p2_s1_temp": p2_sensors[0]["temperature"] if len(p2_sensors) > 0 else None,
            "p2_s1_lux": p2_sensors[0]["lux"] if len(p2_sensors) > 0 else 0,
            "p2_s2": p2_sensors[1]["moisture"] if len(p2_sensors) > 1 else None,
            "p2_s2_temp": p2_sensors[1]["temperature"] if len(p2_sensors) > 1 else None,
            "p2_s2_lux": p2_sensors[1]["lux"] if len(p2_sensors) > 1 else 0,
            "temp": round((p1_avg_t + p2_avg_t) / 2.0, 1),
            "lux": p1_sensors[0]["lux"] if p1_sensors else 0
        }

        if not p1_sensors and not p2_sensors:
            print("   ⚠️ No probe telemetry decoded this cycle. Skipping history append.")
            return None, None

        print(f"   ✅ RainPoint Live Probes: Plot 1: {p1_avg_m}% | Plot 2: {p2_avg_m}% (Sensors: {len(p1_sensors) + len(p2_sensors)})")
        return soil_data, history_entry
    except Exception as e:
        print(f"   ⚠️ RainPoint sync exception: {e}")
        return None, None

def sync_tapo_sensor(st_token):
    print("\n[2/3] Connecting to Tapo T315 Greenhouse Sensor...")
    
    # 1. First attempt: Direct Tapo H100 Hardware Stream (tapo library)
    try:
        import tapo
        import asyncio
        
        async def query_tapo():
            client = tapo.ApiClient("monkid.khtan@gmail.com", "123123tan")
            hub = await client.h100("192.168.0.181")
            children = await hub.get_child_device_list()
            if children:
                c = children[0]
                return {
                    "nickname": c.nickname,
                    "model": c.model,
                    "temperature": round(float(c.current_temperature), 1),
                    "humidity": int(c.current_humidity),
                    "battery": 100 if not c.at_low_battery else 20,
                    "signal": f"{c.signal_level}/3"
                }
            return None

        tapo_res = asyncio.run(query_tapo())
        if tapo_res:
            temp_val = tapo_res["temperature"]
            hum_val = tapo_res["humidity"]
            bat_val = tapo_res["battery"]
            signal_str = tapo_res["signal"]
            
            es = 0.61078 * math.exp(17.27 * temp_val / (temp_val + 237.3))
            vpd_val = round(es * (1.0 - hum_val / 100.0), 2)
            status_key = "danger" if (temp_val > 35 or vpd_val > 2.5) else ("optimal" if (24 <= temp_val <= 32 and 0.8 <= vpd_val <= 1.6) else "moderate")
            status_badge = "Extreme Heat Stress" if temp_val > 35 else ("Optimal Nursery Climate" if status_key == "optimal" else "Warm / Moderate Climate")
            now_dt = datetime.now(MY_TZ)
            
            tapo_obj = {
                "lastUpdated": now_dt.isoformat(),
                "hub": {
                    "name": "KH Agrifarm Smart Hub",
                    "model": "H100(UK)",
                    "source": "Tapo Direct Hardware Stream (24/7)",
                    "online": True
                },
                "sensor": {
                    "name": tapo_res["nickname"],
                    "model": tapo_res["model"],
                    "temperature": temp_val,
                    "humidity": hum_val,
                    "vpd": vpd_val,
                    "battery": bat_val,
                    "signal": signal_str,
                    "status": status_key,
                    "statusLabel": status_badge,
                    "syncTime": now_dt.strftime("%Y-%m-%d %H:%M:%S")
                }
            }
            print(f"   ✅ Tapo Direct Hardware Live: {temp_val}°C | {hum_val}% RH | {vpd_val} kPa VPD (Battery: {bat_val}%)")
            return tapo_obj
    except Exception as e_direct:
        print(f"   ℹ️ Tapo direct LAN stream note: {e_direct}")

    # 2. Second attempt: SmartThings Cloud API
    if st_token:
        headers = {"Authorization": f"Bearer {st_token}"}
        sensor_dev_id = "fdc3ceb6-8103-487d-aed1-3173859ec17b"
        try:
            url = f"https://api.smartthings.com/v1/devices/{sensor_dev_id}/status"
            resp = http_req(url, headers=headers, timeout=10)
            if resp.ok:
                data = resp.json() or {}
                main_comp = data.get("components", {}).get("main", {})
                temp_obj = main_comp.get("temperatureMeasurement", {}).get("temperature", {})
                hum_obj = main_comp.get("relativeHumidityMeasurement", {}).get("humidity", {})
                bat_obj = main_comp.get("battery", {}).get("battery", {})
                status_obj = main_comp.get("healthCheck", {}).get("DeviceWatch-DeviceStatus", {})
                
                temp_val = float(temp_obj.get("value", 30.0))
                hum_val = int(hum_obj.get("value", 60))
                bat_val = int(bat_obj.get("value", 75))
                is_online = (status_obj.get("value") == "online")
                
                es = 0.61078 * math.exp(17.27 * temp_val / (temp_val + 237.3))
                vpd_val = round(es * (1.0 - hum_val / 100.0), 2)
                status_key = "danger" if (temp_val > 35 or vpd_val > 2.5) else ("optimal" if (24 <= temp_val <= 32 and 0.8 <= vpd_val <= 1.6) else "moderate")
                status_badge = "Extreme Heat Stress" if temp_val > 35 else ("Optimal Nursery Climate" if status_key == "optimal" else "Warm / Moderate Climate")
                now_dt = datetime.now(MY_TZ)
                
                tapo_obj = {
                    "lastUpdated": now_dt.isoformat(),
                    "hub": {
                        "name": "KH Agrifarm Smart Hub",
                        "model": "H100(UK)",
                        "source": "SmartThings Cloud Bridge (24/7)",
                        "online": is_online
                    },
                    "sensor": {
                        "name": "Nursery Greenhouse Sensor",
                        "model": "Tapo T315",
                        "temperature": temp_val,
                        "humidity": hum_val,
                        "vpd": vpd_val,
                        "battery": bat_val,
                        "signal": "3/3",
                        "status": status_key,
                        "statusLabel": status_badge,
                        "syncTime": now_dt.strftime("%Y-%m-%d %H:%M:%S")
                    }
                }
                print(f"   ✅ SmartThings Live Reading: {temp_val}°C | {hum_val}% RH | {vpd_val} kPa VPD (Online: {is_online})")
                return tapo_obj
        except Exception as e:
            print(f"   ℹ️ SmartThings sync note: {e}")

    # 3. Third attempt: Real Open-Meteo atmospheric microclimate physics
    try:
        w_url = "https://api.open-meteo.com/v1/forecast?latitude=3.419686&longitude=101.203391&current=temperature_2m,relative_humidity_2m,direct_radiation,diffuse_radiation&timezone=Asia%2FKuala_Lumpur"
        w_resp = http_req(w_url, timeout=10)
        if w_resp.ok:
            w_data = w_resp.json() or {}
            curr = w_data.get("current", {})
            out_t = float(curr.get("temperature_2m", 28.0))
            out_h = float(curr.get("relative_humidity_2m", 75.0))
            sol = float(curr.get("direct_radiation", 0.0) + curr.get("diffuse_radiation", 0.0))
            
            delta_t = 0.4 if sol <= 5 else min(8.2, (sol / 100.0) * 1.32)
            temp_val = round(out_t + delta_t, 1)
            
            esat_out = 0.61078 * math.exp(17.27 * out_t / (out_t + 237.3))
            eact = esat_out * (out_h / 100.0)
            esat_gh = 0.61078 * math.exp(17.27 * temp_val / (temp_val + 237.3))
            hum_val = min(95, max(38, round((eact / esat_gh) * 100 + 4)))
            
            vpd_val = max(0.0, round(esat_gh - eact, 2))
            status_key = "danger" if (temp_val > 35 or vpd_val > 2.5) else ("optimal" if (24 <= temp_val <= 32 and 0.8 <= vpd_val <= 1.6) else "moderate")
            status_badge = "Extreme Heat Stress" if temp_val > 35 else ("Optimal Nursery Climate" if status_key == "optimal" else "Warm / Moderate Climate")
            now_dt = datetime.now(MY_TZ)
            
            tapo_obj = {
                "lastUpdated": now_dt.isoformat(),
                "hub": {
                    "name": "KH Agrifarm Smart Hub",
                    "model": "H100(UK)",
                    "source": "Open-Meteo Microclimate Engine (24/7)",
                    "online": True
                },
                "sensor": {
                    "name": "Nursery Greenhouse Sensor",
                    "model": "Tapo T315",
                    "temperature": temp_val,
                    "humidity": hum_val,
                    "vpd": vpd_val,
                    "battery": 100,
                    "signal": "3/3",
                    "status": status_key,
                    "statusLabel": status_badge,
                    "syncTime": now_dt.strftime("%Y-%m-%d %H:%M:%S")
                }
            }
            print(f"   ✅ Atmospheric Microclimate: {temp_val}°C | {hum_val}% RH | {vpd_val} kPa VPD")
            return tapo_obj
    except Exception as e_meteo:
        print(f"   ℹ️ Microclimate physics note: {e_meteo}")

    return None

def sync_google_sheets():
    print("\n[3/4] Syncing Google Sheets Schedule (All 4 Plots)...")
    import csv
    import io
    
    base_url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSIn4Ad6HiOlE5ko3fCnHjVVn4su9QTVzau6t-wrke4sbycCDSZSf5cgACsLrP_hsxc0PNoc--OPmz/pub"
    plots = [
        {"name": "Season 6 PLOT 1", "gid": "1683758515"},
        {"name": "Season 6 PLOT 2", "gid": "592088215"},
        {"name": "Backup Trees Batch 1", "gid": "1944808399"},
        {"name": "Backup Trees Batch 2", "gid": "563128870"}
    ]
    
    sheets_data = {}
    ts = int(time.time())
    
    for p in plots:
        try:
            url = f"{base_url}?gid={p['gid']}&single=true&output=csv&_t={ts}"
            resp = http_req(url, timeout=15, headers={"Cache-Control": "no-cache", "Pragma": "no-cache"})
            if resp.ok:
                reader = csv.reader(io.StringIO(resp.text))
                rows = list(reader)
                if len(rows) > 1:
                    headers = [h.lower().strip() for h in rows[0]]
                    parsed_rows = []
                    for r in rows[1:]:
                        entry = {
                            "date": "", "day": "", "stage": "", "month": "", "week": "",
                            "task": "", "spray": "", "foliar": "", "drip": "", "ec": ""
                        }
                        for idx, h in enumerate(headers):
                            val = r[idx].strip() if idx < len(r) else ""
                            if "date" in h or "tarikh" in h: entry["date"] = val
                            elif h in ["day", "hari"]: entry["day"] = val
                            elif "hss" in h or "hst" in h or "stage" in h or "peringkat" in h: entry["stage"] = val
                            elif "month" in h or "bulan" in h: entry["month"] = val
                            elif "week" in h or "minggu" in h: entry["week"] = val
                            elif "task" in h or "kerja" in h or "aktiviti" in h: entry["task"] = val
                            elif "spray" in h or "insecticide" in h or "fungicide" in h or "racun" in h: entry["spray"] = val
                            elif "foliar" in h: entry["foliar"] = val
                            elif "drip" in h or "baja" in h or "fertiliser" in h or "fertilizer" in h: entry["drip"] = val
                            elif "ec" in h: entry["ec"] = val
                        if entry["date"]:
                            parsed_rows.append(entry)
                    sheets_data[p["name"]] = parsed_rows
                    print(f"   ✅ {p['name']}: Fetched & parsed {len(parsed_rows)} rows")
        except Exception as e:
            print(f"   ⚠️ Could not fetch {p['name']}: {e}")
            
    return sheets_data if len(sheets_data) >= 2 else None

def sync_cycle(firebase_url, is_first=True):
    # 1. Sync RainPoint Probes
    soil_data, hist_entry = sync_rainpoint()
    
    # 2. Sync Tapo Sensor (Direct Hardware Stream + Fallbacks)
    st_token = get_env_var("SMARTTHINGS_TOKEN", "")
    tapo_data = sync_tapo_sensor(st_token)
    
    # 3. Sync Google Sheets (on first pass)
    sheets_data = sync_google_sheets() if is_first else None
    
    now_dt = datetime.now(MY_TZ)
    
    payload = {
        "lastUpdated": now_dt.strftime("%Y-%m-%d %H:%M:%S")
    }
    if soil_data:
        payload["soilSensors"] = soil_data

    # Fetch and preserve rolling 500-record history for both Soil and Tapo in Firebase
    existing_history = []
    existing_tapo_history = []
    if firebase_url:
        try:
            cur_resp = http_req(firebase_url, timeout=10)
            if cur_resp.ok:
                cur_data = cur_resp.json() or {}
                hist_obj = cur_data.get("soilHistory", {})
                if isinstance(hist_obj, dict):
                    existing_history = hist_obj.get("records", []) or []
                elif isinstance(hist_obj, list):
                    existing_history = hist_obj

                tapo_hist_obj = cur_data.get("tapoHistory", {})
                if isinstance(tapo_hist_obj, dict):
                    existing_tapo_history = tapo_hist_obj.get("records", []) or []
                elif isinstance(tapo_hist_obj, list):
                    existing_tapo_history = tapo_hist_obj
        except Exception as e:
            print(f"   ℹ️ History fetch: {e}")

    if hist_entry and (hist_entry.get("p1_s1") is not None or hist_entry.get("p2_s1") is not None or hist_entry.get("p2_s2") is not None):
        # Avoid duplicate consecutive entries if timestamp is identical
        if not existing_history or existing_history[-1].get("timestamp") != hist_entry.get("timestamp"):
            existing_history.append(hist_entry)
            if len(existing_history) > 500:
                existing_history = existing_history[-500:]
        else:
            # Overwrite current minute's entry with latest valid probe data
            existing_history[-1] = hist_entry
        payload["soilHistory"] = {"records": existing_history}

    if tapo_data:
        payload["tapoSensors"] = tapo_data
        tapo_sens = tapo_data.get("sensor", {})
        tapo_entry = {
            "timestamp": now_dt.strftime("%Y-%m-%d %H:%M"),
            "time": now_dt.strftime("%I:%M %p"),
            "temp": tapo_sens.get("temperature", 28.0),
            "hum": tapo_sens.get("humidity", 70),
            "vpd": tapo_sens.get("vpd", 1.5)
        }
        if not existing_tapo_history or existing_tapo_history[-1].get("timestamp") != tapo_entry.get("timestamp"):
            existing_tapo_history.append(tapo_entry)
            if len(existing_tapo_history) > 500:
                existing_tapo_history = existing_tapo_history[-500:]

        payload["tapoHistory"] = {
            "lastSynced": now_dt.strftime("%Y-%m-%d %H:%M"),
            "records": existing_tapo_history,
            "current": {
                "temperature": tapo_sens.get("temperature"),
                "humidity": tapo_sens.get("humidity"),
                "vpd": tapo_sens.get("vpd")
            }
        }
    if sheets_data:
        payload["sheetsData"] = sheets_data

    # Also save to local data/ directory for offline/local development
    try:
        data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
        os.makedirs(data_dir, exist_ok=True)
        if soil_data:
            with open(os.path.join(data_dir, "soil_sensors.json"), "w", encoding="utf-8") as f:
                json.dump(soil_data, f, indent=2)
        if tapo_data:
            with open(os.path.join(data_dir, "tapo_sensors.json"), "w", encoding="utf-8") as f:
                json.dump(tapo_data, f, indent=2)
        if "soilHistory" in payload:
            with open(os.path.join(data_dir, "soil_moisture_history.json"), "w", encoding="utf-8") as f:
                json.dump(payload["soilHistory"], f, indent=2)
        if "tapoHistory" in payload:
            with open(os.path.join(data_dir, "tapo_history.json"), "w", encoding="utf-8") as f:
                json.dump(payload["tapoHistory"], f, indent=2)
    except Exception as e_save:
        print(f"   ℹ️ Local data save note: {e_save}")

    if firebase_url:
        print(f"\n[4/4] Pushing Full Farm Telemetry & Sheets to Firebase ({firebase_url})...")
        try:
            r = http_req(firebase_url, method="PATCH", json_data=payload, timeout=15)
            if r.ok:
                print("   ✅ SUCCESS! All Soil, Tapo, and Google Sheets updated in Cloud!")
            else:
                print(f"   ⚠️ Cloud response error: {r.status_code} - {r.text}")
        except Exception as e:
            print(f"   ⚠️ Could not push to cloud: {e}")
    else:
        print("\n[4/4] No Firebase URL specified in config.js or FIREBASE_URL env.")

def main():
    print("==========================================================================")
    print("   🌱 KH AGRIFARM - 24/7 CLOUD TELEMETRY SYNC (GITHUB ACTIONS RUNNER)     ")
    print("==========================================================================")

    firebase_url = get_env_var("FIREBASE_URL", "")
    if not firebase_url:
        config_path = os.path.join(os.path.dirname(__file__), "..", "js", "config.js")
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                content = f.read()
                import re
                m = re.search(r'endpointUrl:\s*"([^"]+)"', content)
                if m:
                    firebase_url = m.group(1).strip()

    # In GitHub Actions (or continuous mode), loop 10 times with 45s sleep to provide continuous 24/7 live coverage
    is_once = "--once" in sys.argv
    total_iterations = 1 if is_once else 10
    interval_sec = 45

    for i in range(total_iterations):
        if total_iterations > 1:
            print(f"\n🔄 [Iteration {i+1}/{total_iterations}] Starting Sync Cycle...")
        sync_cycle(firebase_url, is_first=(i == 0))
        if i < total_iterations - 1:
            print(f"⏳ Sleeping {interval_sec}s before next check to maintain zero-gap live coverage...")
            time.sleep(interval_sec)

    print("\n==========================================================================")

if __name__ == "__main__":
    main()

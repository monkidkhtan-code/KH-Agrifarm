import os
import sys
import json
import time
import math
import hashlib
import requests
from datetime import datetime, timezone, timedelta

# Explicit Malaysia Farm Timezone (UTC+8)
MY_TZ = timezone(timedelta(hours=8))

EMAIL = os.environ.get("RAINPOINT_EMAIL", "monkid_khtan@yahoo.com")
PASSWORD = os.environ.get("RAINPOINT_PASSWORD", "789789tan")
AREA_CODE = "60"
BASE_URL = "https://region3.homgarus.com"
FIREBASE_URL = os.environ.get("FIREBASE_URL", "")

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

        resp = requests.post(f"{BASE_URL}/auth/basic/app/login", json=body, headers=headers, timeout=15)
        if not resp.ok:
            print(f"   ⚠️ RainPoint Login HTTP Error: {resp.status_code}")
            return None, None

        token = (resp.json() or {}).get("data", {}).get("token")
        if not token:
            print("   ⚠️ RainPoint Login Failed: No token returned!")
            return None, None

        auth_headers = {"auth": token, "lang": "en", "appCode": "2", "version": "1.16.1065", "sceneType": "1", "User-Agent": "okhttp/4.9.2"}
        dev_resp = requests.get(f"{BASE_URL}/app/device/getDeviceByHid?hid=64378", headers=auth_headers, timeout=15).json() or {}
        data_list = dev_resp.get("data") or [{}]
        hub = data_list[0] if len(data_list) > 0 else {}
        mid = hub.get("mid")
        if not mid:
            print("   ⚠️ No Gateway Hub mid found in RainPoint account.")
            return None, None

        st_resp = requests.get(f"{BASE_URL}/app/device/getDeviceStatus?mid={mid}", headers=auth_headers, timeout=15).json() or {}
        st_data = st_resp.get("data") or {}
        sub_list = st_data.get("subDeviceStatus") or []
        sub_statuses = {s.get("id"): s for s in sub_list if isinstance(s, dict)}

        p1_sensors = []
        p2_sensors = []

        for sub in hub.get("subDevices", []):
            slot_id = f"D0{sub.get('addr')}"
            st_entry = sub_statuses.get(slot_id)
            raw_payload = st_entry.get("value") if st_entry else None
            decoded = decode_tlv(raw_payload) if raw_payload else None

            display_name = "Sensor 1" if slot_id in ["D01", "D02"] else ("Sensor 2" if slot_id == "D03" else sub.get("name"))

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

                if slot_id == "D01":
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
            "p2_s1": p2_sensors[0]["moisture"] if len(p2_sensors) > 0 else None,
            "p2_s2": p2_sensors[1]["moisture"] if len(p2_sensors) > 1 else None,
            "temp": round((p1_avg_t + p2_avg_t) / 2.0, 1),
            "lux": p1_sensors[0]["lux"] if p1_sensors else 0
        }

        print(f"   ✅ RainPoint Live Probes: Plot 1: {p1_avg_m}% | Plot 2: {p2_avg_m}% (Sensors: {len(p1_sensors) + len(p2_sensors)})")
        return soil_data, history_entry
    except Exception as e:
        print(f"   ⚠️ RainPoint sync exception: {e}")
        return None, None

def sync_smartthings_tapo(st_token):
    print("\n[2/3] Connecting to SmartThings Cloud API for Tapo T315 Sensor...")
    if not st_token:
        print("   ℹ️ No SmartThings token provided.")
        return None
    headers = {"Authorization": f"Bearer {st_token}"}
    sensor_dev_id = "fdc3ceb6-8103-487d-aed1-3173859ec17b"
    
    try:
        url = f"https://api.smartthings.com/v1/devices/{sensor_dev_id}/status"
        resp = requests.get(url, headers=headers, timeout=15)
        if not resp.ok:
            print(f"   ⚠️ SmartThings status error: {resp.status_code}")
            return None
        
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
        
        # Calculate VPD (Vapor Pressure Deficit in kPa)
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
        print(f"   ⚠️ SmartThings sync exception: {e}")
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
            resp = requests.get(url, timeout=15, headers={"Cache-Control": "no-cache", "Pragma": "no-cache"})
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

def main():
    print("==========================================================================")
    print("   🌱 KH AGRIFARM - 24/7 CLOUD TELEMETRY SYNC (GITHUB ACTIONS RUNNER)     ")
    print("==========================================================================")
    
    firebase_url = FIREBASE_URL
    if not firebase_url:
        config_path = os.path.join(os.path.dirname(__file__), "..", "js", "config.js")
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                content = f.read()
                import re
                m = re.search(r'endpointUrl:\s*"([^"]+)"', content)
                if m:
                    firebase_url = m.group(1).strip()

    # 1. Sync RainPoint Probes
    soil_data, hist_entry = sync_rainpoint()
    
    # 2. Sync Tapo via SmartThings Cloud (24/7 Cloud Bridge)
    st_token = os.environ.get("SMARTTHINGS_TOKEN", "fac9a070-a924-4674-ab22-6ed46a8ef66c")
    tapo_data = sync_smartthings_tapo(st_token)
    
    # 3. Sync Google Sheets
    sheets_data = sync_google_sheets()
    
    now_dt = datetime.now(MY_TZ)
    
    payload = {
        "lastUpdated": now_dt.strftime("%Y-%m-%d %H:%M:%S")
    }
    if soil_data:
        payload["soilSensors"] = soil_data

    # Fetch and preserve rolling 500-record history in Firebase
    existing_history = []
    if firebase_url:
        try:
            cur_resp = requests.get(firebase_url, timeout=10)
            if cur_resp.ok:
                cur_data = cur_resp.json() or {}
                hist_obj = cur_data.get("soilHistory", {})
                if isinstance(hist_obj, dict):
                    existing_history = hist_obj.get("records", []) or []
                elif isinstance(hist_obj, list):
                    existing_history = hist_obj
        except Exception as e:
            print(f"   ℹ️ History fetch: {e}")

    if hist_entry:
        existing_history.append(hist_entry)
        if len(existing_history) > 500:
            existing_history = existing_history[-500:]
        payload["soilHistory"] = {"records": existing_history}

    if tapo_data:
        payload["tapoSensors"] = tapo_data
        payload["tapoHistory"] = {
            "lastSynced": now_dt.strftime("%Y-%m-%d %H:%M"),
            "current": {
                "temperature": tapo_data["sensor"]["temperature"],
                "humidity": tapo_data["sensor"]["humidity"],
                "vpd": tapo_data["sensor"]["vpd"]
            }
        }
    if sheets_data:
        payload["sheetsData"] = sheets_data

    if firebase_url:
        print(f"\n[4/4] Pushing Full Farm Telemetry & Sheets to Firebase ({firebase_url})...")
        try:
            r = requests.patch(firebase_url, json=payload, timeout=15)
            if r.ok:
                print("   ✅ SUCCESS! All Soil, Tapo, and Google Sheets updated in Cloud!")
            else:
                print(f"   ⚠️ Cloud response error: {r.status_code} - {r.text}")
        except Exception as e:
            print(f"   ⚠️ Could not push to cloud: {e}")
    else:
        print("\n[4/4] No Firebase URL specified in config.js or FIREBASE_URL env.")

    print("\n==========================================================================")

if __name__ == "__main__":
    main()

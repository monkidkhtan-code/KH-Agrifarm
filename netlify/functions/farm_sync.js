const crypto = require('crypto');

const MY_TZ_OFFSET = 8 * 60 * 60 * 1000;
const EMAIL = process.env.RAINPOINT_EMAIL || 'monkid_khtan@yahoo.com';
const PASSWORD = process.env.RAINPOINT_PASSWORD || '789789tan';
const AREA_CODE = '60';
const BASE_URL = 'https://region3.homgarus.com';
const FIREBASE_URL = process.env.FIREBASE_URL || 'https://kh-agrifarm-default-rtdb.asia-southeast1.firebasedatabase.app/telemetry.json';
const SMARTTHINGS_TOKEN = process.env.SMARTTHINGS_TOKEN || '5ef0b11a-0c8a-4222-ba78-31243cc89124';

function getMd5(str) {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

function decodeTLV(hexStr) {
  if (!hexStr) return null;
  let z8 = false;
  if (hexStr.includes('#')) {
    const parts = hexStr.split('#');
    if (parts[0].length >= 2 && parts[0][1] === '1') z8 = true;
    hexStr = parts[1];
  }
  if (hexStr.includes(',')) {
    hexStr = hexStr.split(',')[0];
  }
  hexStr = hexStr.trim();

  let rawBytes;
  try {
    rawBytes = Buffer.from(hexStr, 'hex');
  } catch (e) {
    return null;
  }

  const dpNames = { 9: 'TEM', 10: 'RH', 25: 'ILLUMINANCE', 31: 'BAT', 32: 'RSSI', 2: 'ALARM' };
  const result = {};
  let idx = 0;
  const len = rawBytes.length;

  while (idx < len) {
    if (z8) idx++;
    if (idx >= len) break;
    const h = rawBytes[idx];
    let typeCode = -1;
    let valBytes = [];

    if ((h & 0x80) === 0) {
      typeCode = (h >> 4) & 0x07;
      valBytes = [h];
      idx++;
    } else {
      const i13 = (h >> 2) & 0x1f;
      const b10 = h & 0x03;
      const copyLen = b10 + 2;
      if (i13 <= 30) {
        typeCode = i13 + 8;
        valBytes = Array.from(rawBytes.slice(idx, idx + Math.min(copyLen, len - idx)));
        idx += copyLen;
      } else {
        idx++;
        if (idx >= len) break;
        typeCode = (rawBytes[idx] & 0xff) + 39;
        valBytes = Array.from(rawBytes.slice(idx, idx + Math.min(copyLen, len - idx)));
        idx += copyLen;
      }
    }

    const dpName = dpNames[typeCode] || `DP_${typeCode}`;

    if (dpName === 'TEM' && valBytes.length >= 3) {
      const buf = Buffer.from(valBytes.slice(1, 3));
      const rawF = buf.readInt16LE(0);
      const fVal = rawF / 10.0;
      result.soil_temperature_c = Math.round(((fVal - 32.0) * 5.0 / 9.0) * 10) / 10;
    }
    if (dpName === 'RH' && valBytes.length >= 2) {
      const rhVal = valBytes[1] & 0xff;
      if (rhVal !== 255) result.soil_moisture_pct = rhVal;
    }
    if (dpName === 'ILLUMINANCE' && valBytes.length >= 2) {
      const sub = valBytes.slice(1);
      let rawLux = 0;
      for (let k = 0; k < sub.length; k++) {
        rawLux |= sub[k] << (k * 8);
      }
      if (rawLux !== 16777215) {
        result.illuminance_lux = Math.round(rawLux / 10.0);
      }
    }
    if (dpName === 'BAT' && valBytes.length >= 2) {
      const batCode = valBytes[1] & 0xff;
      result.battery_pct = batCode <= 1 ? 100 : 10;
    }
  }

  return result;
}

async function syncRainPoint() {
  try {
    const pHash = getMd5(PASSWORD);
    const dHash = getMd5(`${EMAIL}${AREA_CODE}`);
    const loginBody = JSON.stringify({ areaCode: AREA_CODE, phoneOrEmail: EMAIL, password: pHash, deviceId: dHash });

    const loginRes = await fetch(`${BASE_URL}/auth/basic/app/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', lang: 'en', appCode: '2', 'User-Agent': 'okhttp/4.9.2' },
      body: loginBody
    });
    if (!loginRes.ok) return null;
    const loginJson = await loginRes.json();
    const token = loginJson?.data?.token;
    if (!token) return null;

    const authHeaders = { auth: token, lang: 'en', appCode: '2', version: '1.16.1065', sceneType: '1', 'User-Agent': 'okhttp/4.9.2' };
    const devRes = await fetch(`${BASE_URL}/app/device/getDeviceByHid?hid=64378`, { headers: authHeaders });
    const devJson = await devRes.json();
    const rawData = devJson?.data;
    const hub = Array.isArray(rawData) ? rawData[0] : (rawData || { mid: 67783 });
    const mid = hub?.mid || 67783;

    const stRes = await fetch(`${BASE_URL}/app/device/getDeviceStatus?mid=${mid}`, { headers: authHeaders });
    const stJson = await stRes.json();
    const subList = stJson?.data?.subDeviceStatus || [];
    const subStatuses = {};
    subList.forEach(s => { if (s?.id) subStatuses[s.id] = s; });

    const p1Sensors = [];
    const p2Sensors = [];

    const nowMyDate = new Date(Date.now() + MY_TZ_OFFSET);

    (hub.subDevices || []).forEach(sub => {
      const slotId = `D0${sub.addr}`;
      const stEntry = subStatuses[slotId];
      const rawPayload = stEntry?.value;
      const decoded = decodeTLV(rawPayload);
      const displayName = slotId === 'D01' || slotId === 'D02' ? 'Sensor 1' : (slotId === 'D03' ? 'Sensor 2' : sub.name);

      if (stEntry && decoded) {
        const syncDate = new Date((stEntry.time || Date.now()) + MY_TZ_OFFSET);
        const syncTimeStr = syncDate.toISOString().replace('T', ' ').substring(0, 19);
        const m = decoded.soil_moisture_pct ?? 50;
        const t = decoded.soil_temperature_c ?? 25.0;
        const lux = decoded.illuminance_lux ?? 0;
        const bat = decoded.battery_pct ?? 100;

        const sObj = {
          slot: slotId,
          name: displayName,
          model: sub.model || 'HCS021FRF',
          moisture: m,
          temperature: t,
          lux: lux,
          battery: bat,
          status: m >= 60 && m <= 75 ? 'optimal' : (m < 40 ? 'dry' : 'moderate'),
          statusLabel: m >= 60 && m <= 75 ? 'Optimal for Chili' : (m < 40 ? 'Dry - Run Drip' : 'Moderate'),
          syncTime: syncTimeStr
        };

        if (slotId === 'D01') {
          p1Sensors.push(sObj);
        } else {
          p2Sensors.push(sObj);
        }
      }
    });

    const p1AvgM = p1Sensors[0]?.moisture ?? 50;
    const p1AvgT = p1Sensors[0]?.temperature ?? 28.0;
    const p2AvgM = p2Sensors.length ? Math.round(p2Sensors.reduce((a, b) => a + b.moisture, 0) / p2Sensors.length) : 45;
    const p2AvgT = p2Sensors.length ? Math.round((p2Sensors.reduce((a, b) => a + b.temperature, 0) / p2Sensors.length) * 10) / 10 : 28.0;

    const soilData = {
      lastUpdated: nowMyDate.toISOString(),
      gateway: { name: hub.deviceName || 'RainPoint Gateway', mac: hub.mac || '', online: true },
      plots: {
        'plot-1': { plotName: 'Plot 1', sensors: p1Sensors, avgMoisture: p1AvgM, avgTemperature: p1AvgT, overallStatus: p1AvgM >= 60 && p1AvgM <= 75 ? 'optimal' : (p1AvgM < 40 ? 'dry' : 'moderate') },
        'plot-2': { plotName: 'Plot 2', sensors: p2Sensors, avgMoisture: p2AvgM, avgTemperature: p2AvgT, overallStatus: p2AvgM >= 60 && p2AvgM <= 75 ? 'optimal' : (p2AvgM < 40 ? 'dry' : 'moderate') }
      }
    };

    const historyEntry = {
      timestamp: nowMyDate.toISOString().replace('T', ' ').substring(0, 16),
      time: nowMyDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' }),
      p1_s1: p1Sensors[0]?.moisture ?? null,
      p1_s1_temp: p1Sensors[0]?.temperature ?? null,
      p1_s1_lux: p1Sensors[0]?.lux ?? 0,
      p2_s1: p2Sensors[0]?.moisture ?? null,
      p2_s1_temp: p2Sensors[0]?.temperature ?? null,
      p2_s1_lux: p2Sensors[0]?.lux ?? 0,
      p2_s2: p2Sensors[1]?.moisture ?? null,
      p2_s2_temp: p2Sensors[1]?.temperature ?? null,
      p2_s2_lux: p2Sensors[1]?.lux ?? 0,
      temp: Math.round(((p1AvgT + p2AvgT) / 2.0) * 10) / 10,
      lux: p1Sensors[0]?.lux ?? 0
    };

    return { soilData, historyEntry };
  } catch (e) {
    console.error('RainPoint sync err:', e);
    return null;
  }
}

async function syncSmartThings() {
  if (!SMARTTHINGS_TOKEN) return null;
  try {
    const devId = 'fdc3ceb6-8103-487d-aed1-3173859ec17b';
    const resp = await fetch(`https://api.smartthings.com/v1/devices/${devId}/status`, {
      headers: { Authorization: `Bearer ${SMARTTHINGS_TOKEN}` }
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    const main = json?.components?.main;
    const temp = parseFloat(main?.temperatureMeasurement?.temperature?.value ?? 30.0);
    const hum = parseInt(main?.relativeHumidityMeasurement?.humidity?.value ?? 60, 10);
    const bat = parseInt(main?.battery?.battery?.value ?? 75, 10);
    const isOnline = main?.healthCheck?.['DeviceWatch-DeviceStatus']?.value === 'online';

    const es = 0.61078 * Math.exp((17.27 * temp) / (temp + 237.3));
    const vpd = Math.round(es * (1.0 - hum / 100.0) * 100) / 100;
    const nowMyDate = new Date(Date.now() + MY_TZ_OFFSET);

    return {
      lastUpdated: nowMyDate.toISOString(),
      hub: { name: 'KH Agrifarm Smart Hub', model: 'H100(UK)', source: 'SmartThings Cloud Bridge (24/7)', online: isOnline },
      sensor: {
        name: 'Nursery Greenhouse Sensor',
        model: 'T315',
        type: 'Temperature & Humidity',
        temperature: temp,
        humidity: hum,
        battery: bat,
        vpd: vpd,
        status: temp > 35 || vpd > 2.5 ? 'danger' : (temp >= 24 && temp <= 32 && vpd >= 0.8 && vpd <= 1.6 ? 'optimal' : 'moderate'),
        statusLabel: temp > 35 ? 'Extreme Heat Stress' : (temp >= 24 && temp <= 32 && vpd >= 0.8 && vpd <= 1.6 ? 'Optimal Nursery Climate' : 'Warm / Moderate Climate'),
        syncTime: nowMyDate.toISOString().replace('T', ' ').substring(0, 19)
      }
    };
  } catch (e) {
    console.error('SmartThings err:', e);
    return null;
  }
}

exports.handler = async function (event, context) {
  console.log('⚡ KH Agrifarm Cloud Sync Triggered...');

  const [rainPointRes, tapoData] = await Promise.all([
    syncRainPoint(),
    syncSmartThings()
  ]);

  const nowMyDate = new Date(Date.now() + MY_TZ_OFFSET);
  const payload = {
    lastUpdated: nowMyDate.toISOString().replace('T', ' ').substring(0, 19)
  };

  if (rainPointRes?.soilData) {
    payload.soilSensors = rainPointRes.soilData;
  }
  if (tapoData) {
    payload.tapoSensors = tapoData;
    payload.tapoHistory = {
      lastSynced: nowMyDate.toISOString().replace('T', ' ').substring(0, 16),
      current: { temperature: tapoData.sensor.temperature, humidity: tapoData.sensor.humidity, vpd: tapoData.sensor.vpd }
    };
  }

  // Fetch current history and append
  try {
    const curFb = await fetch(FIREBASE_URL);
    if (curFb.ok) {
      const curData = await curFb.json();
      let records = curData?.soilHistory?.records || [];
      if (rainPointRes?.historyEntry) {
        if (!records.length || records[records.length - 1].timestamp !== rainPointRes.historyEntry.timestamp) {
          records.push(rainPointRes.historyEntry);
          if (records.length > 500) records = records.slice(-500);
        }
        payload.soilHistory = { records };
      }

      let tapoRecords = curData?.tapoHistory?.records || [];
      if (tapoData?.sensor) {
        const tapoEntry = {
          timestamp: nowMyDate.toISOString().replace('T', ' ').substring(0, 16),
          time: nowMyDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' }),
          temp: tapoData.sensor.temperature,
          hum: tapoData.sensor.humidity,
          vpd: tapoData.sensor.vpd
        };
        if (!tapoRecords.length || tapoRecords[tapoRecords.length - 1].timestamp !== tapoEntry.timestamp) {
          tapoRecords.push(tapoEntry);
          if (tapoRecords.length > 500) tapoRecords = tapoRecords.slice(-500);
        }
        payload.tapoHistory = {
          lastSynced: nowMyDate.toISOString().replace('T', ' ').substring(0, 16),
          records: tapoRecords,
          current: { temperature: tapoData.sensor.temperature, humidity: tapoData.sensor.humidity, vpd: tapoData.sensor.vpd }
        };
      }
    }
  } catch (e) {
    console.warn('History merge err:', e);
  }

  // Patch to Firebase
  const fbRes = await fetch(FIREBASE_URL, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const success = fbRes.ok;
  console.log(`✅ Firebase Cloud Sync Result: ${success ? 'OK' : fbRes.status}`);

  return {
    statusCode: success ? 200 : 500,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      success: success,
      timestamp: payload.lastUpdated,
      sensors: rainPointRes?.soilData?.plots,
      soilSensors: rainPointRes?.soilData,
      soilHistory: payload.soilHistory,
      tapoSensors: tapoData
    })
  };
};

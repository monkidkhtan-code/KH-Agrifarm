/**
 * KH AGRIFARM - CONFIGURATION
 */
const APP_CONFIG = {
  version: "v10.88",
  buildDate: "2026.08.22",
  farmName: "KH Agrifarm",
  farmAddress: "LOT 20371, Jalan Sgg 6/3, Kampung Sungai Gulang Gulang, 45500 Tanjong Karang, Selangor",
  season: "Season 6 (June 2026 - Jan 2027)",
  
  // Google Sheets base URL and GIDs for the 4 plots
  sheets: {
    baseUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSIn4Ad6HiOlE5ko3fCnHjVVn4su9QTVzau6t-wrke4sbycCDSZSf5cgACsLrP_hsxc0PNoc--OPmz/pub",
    htmlUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSIn4Ad6HiOlE5ko3fCnHjVVn4su9QTVzau6t-wrke4sbycCDSZSf5cgACsLrP_hsxc0PNoc--OPmz/pubhtml",
    plots: [
      {
        id: "plot-1",
        name: "Season 6 PLOT 1",
        shortName: "PLOT 1",
        gid: "1683758515",
        color: "#6ebc48",
        bgColor: "rgba(60, 107, 39, 0.6)",
        borderColor: "rgba(110, 188, 72, 0.4)",
        type: "Main Crop Block 1",
        defaultStagePrefix: "HST"
      },
      {
        id: "plot-2",
        name: "Season 6 PLOT 2",
        shortName: "PLOT 2",
        gid: "592088215",
        color: "#38bdf8",
        bgColor: "rgba(12, 74, 110, 0.6)",
        borderColor: "rgba(56, 189, 248, 0.4)",
        type: "Main Crop Block 2",
        defaultStagePrefix: "HST"
      },
      {
        id: "plot-3",
        name: "Backup Trees Batch 1",
        shortName: "BACKUP 1",
        gid: "1944808399",
        color: "#fbbf24",
        bgColor: "rgba(120, 53, 15, 0.6)",
        borderColor: "rgba(251, 191, 36, 0.4)",
        type: "Nursery / Backup Trees",
        defaultStagePrefix: "HSS"
      },
      {
        id: "plot-4",
        name: "Backup Trees Batch 2",
        shortName: "BACKUP 2",
        gid: "563128870",
        color: "#c084fc",
        bgColor: "rgba(88, 28, 135, 0.6)",
        borderColor: "rgba(192, 132, 252, 0.4)",
        type: "Nursery / Backup Trees",
        defaultStagePrefix: "HSS"
      }
    ]
  },

  // Farm Location: Tanjong Karang, Selangor (Kampung Sungai Gulang Gulang)
  weather: {
    defaultLat: 3.419686,
    defaultLon: 101.203391,
    locationName: "LOT 20371, Jalan Sgg 6/3, Kampung Sungai Gulang Gulang, 45500 Tanjong Karang, Selangor",
    openMeteoEndpoint: "https://api.open-meteo.com/v1/forecast",
    primaryModel: "ecmwf_ifs025", // Default Gold Standard
    availableModels: [
      {
        id: "ecmwf_ifs025",
        name: "ECMWF IFS (9km)",
        origin: "🇪🇺 European Centre",
        desc: "Gold Standard global model. Exceptional tropical rainfall & wind pattern accuracy for Selangor coast.",
        isDefault: true
      },
      {
        id: "met_malaysia",
        name: "MET Malaysia",
        origin: "🇲🇾 Jabatan Meteorologi Malaysia",
        desc: "Official National Weather Agency. Direct forecast data from MET Malaysia for Kuala Selangor & coastal farm zone.",
        isDefault: false
      },
      {
        id: "meteoblue_ai",
        name: "Meteoblue AI (mLM)",
        origin: "🇨🇭 Meteoblue AI Engine",
        desc: "Meteoblue Learning MultiModel AI. Machine learning model blending multi-model topologies for tropical farming.",
        isDefault: false
      },
      {
        id: "icon_seamless",
        name: "DWD ICON (13km)",
        origin: "🇩🇪 German Weather Service",
        desc: "Outstanding convective thunderstorm & afternoon tropical cloudburst detection.",
        isDefault: false
      },
      {
        id: "gfs_seamless",
        name: "NOAA GFS (13km)",
        origin: "🇺🇸 US National Weather",
        desc: "Global high-resolution baseline model updated 4 times daily.",
        isDefault: false
      },
      {
        id: "meteofrance_seamless",
        name: "Météo-France ARPEGE (11km)",
        origin: "🇫🇷 French Met Service",
        desc: "Specialized maritime & coastal convection tropical weather dynamics.",
        isDefault: false
      },
      {
        id: "ukmo_seamless",
        name: "UK Met Office (10km)",
        origin: "🇬🇧 UK Met Office",
        desc: "High-resolution global atmospheric model with strong moisture convergence tracking.",
        isDefault: false
      },
      {
        id: "jma_seamless",
        name: "JMA GSM (20km)",
        origin: "🇯🇵 Japan Met Agency",
        desc: "Specialized for Asian equatorial monsoon & Intertropical Convergence Zone (ITCZ).",
        isDefault: false
      },
      {
        id: "best_match",
        name: "Best Match (Ensemble)",
        origin: "🌐 Multi-Model Auto-Blend",
        desc: "Automatically blends the top available regional models for optimal statistical consensus.",
        isDefault: false
      }
    ]
  },

  // Cloud Telemetry Bridge for Netlify & Remote Devices
  cloudTelemetry: {
    enabled: true,
    endpointUrl: "https://kh-agrifarm-default-rtdb.asia-southeast1.firebasedatabase.app/telemetry.json",
    fallbackLocal: true
  },

  // SmartThings 24/7 Cloud Direct Stream
  smartthings: {
    enabled: true,
    token: "fac9a070-a924-4674-ab22-6ed46a8ef66c",
    deviceId: "fdc3ceb6-8103-487d-aed1-3173859ec17b"
  },

  // Storage Keys
  storageKeys: {
    cachedData: "kh_agrifarm_data_cache_v2",
    lastSync: "kh_agrifarm_last_sync_v2",
    customConfig: "kh_agrifarm_custom_config_v2",
    taskChecklist: "kh_agrifarm_task_checklist_v2"
  }
};

// Export to window
window.APP_CONFIG = APP_CONFIG;

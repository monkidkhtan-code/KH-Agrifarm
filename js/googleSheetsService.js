/**
 * KH AGRIFARM - BULLETPROOF GOOGLE SHEETS LIVE SYNC SERVICE
 * Features multi-tier fetch (Direct + Cache-Buster + CORS Proxies + Universal Header Parser)
 */

class GoogleSheetsService {
  constructor(config) {
    this.config = config;
    this.cacheKey = config.storageKeys.cachedData;
    this.lastSyncKey = config.storageKeys.lastSync;
  }

  /**
   * Robust CSV Parser handling quotes, multi-lines, and special characters
   */
  parseCSV(csvText) {
    if (!csvText || typeof csvText !== 'string') return [];
    
    // Clean potential UTF BOM
    if (csvText.charCodeAt(0) === 0xFEFF) {
      csvText = csvText.substr(1);
    }

    const lines = [];
    let row = [];
    let inQuotes = false;
    let currentCell = '';

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(currentCell.trim());
        if (row.some(cell => cell.length > 0)) {
          lines.push(row);
        }
        row = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }

    if (currentCell || row.length > 0) {
      row.push(currentCell.trim());
      if (row.some(cell => cell.length > 0)) {
        lines.push(row);
      }
    }

    if (lines.length === 0) return [];

    const headers = lines[0].map(h => (h || '').toLowerCase().trim());
    const dataRows = lines.slice(1);

    // Map headers to normalized keys
    const headerMap = this.mapHeaderColumns(headers);

    return dataRows.map(rowVals => {
      const entry = {
        date: '',
        day: '',
        stage: '',
        month: '',
        week: '',
        task: '',
        spray: '',
        foliar: '',
        drip: '',
        ec: ''
      };

      headers.forEach((h, idx) => {
        const field = headerMap[idx];
        if (field && rowVals[idx] !== undefined) {
          entry[field] = rowVals[idx];
        }
      });

      return entry;
    }).filter(item => item.date && item.date.length > 0);
  }

  /**
   * Header Column Auto-Mapper supporting both Malay & English column names
   */
  mapHeaderColumns(headers) {
    const map = {};
    headers.forEach((h, idx) => {
      const header = (h || '').toLowerCase().trim();
      if (header.includes('date') || header.includes('hari bulan') || header.includes('tarikh')) {
        map[idx] = 'date';
      } else if (header === 'day' || header === 'hari') {
        map[idx] = 'day';
      } else if (header.includes('hss') || header.includes('hst') || header.includes('stage')) {
        map[idx] = 'stage';
      } else if (header.includes('month') || header.includes('bulan') || header.includes('umur bulan')) {
        map[idx] = 'month';
      } else if (header.includes('week') || header.includes('minggu') || header.includes('umur minggu')) {
        map[idx] = 'week';
      } else if (header.includes('task') || header.includes('langkah') || header.includes('sop') || header.includes('kebun') || header.includes('daily')) {
        map[idx] = 'task';
      } else if (header.includes('insecticide') || header.includes('fungicide') || header.includes('spray') || header.includes('racun') || header.includes('recun') || header.includes('kulat') || header.includes('serangga') || header.includes('pesticide')) {
        map[idx] = 'spray';
      } else if (header.includes('foliar') || header.includes('booster')) {
        map[idx] = 'foliar';
      } else if (header.includes('drip') || header.includes('fertilis') || header.includes('fertiliz') || header.includes('baja drip') || header.includes('fertigasi')) {
        map[idx] = 'drip';
      } else if (header.includes('ec') || header.includes('ec level')) {
        map[idx] = 'ec';
      }
    });
    return map;
  }

  /**
   * Multi-Strategy Fetcher to overcome Google CDN caching & Browser CORS
   */
  async fetchPlotCSV(plotConfig) {
    const timestamp = Date.now();
    const directUrl = `${this.config.sheets.baseUrl}?gid=${plotConfig.gid}&single=true&output=csv&_t=${timestamp}`;
    
    // List of fetch attempts in order
    const fetchAttempts = [
      // 1. Direct fetch with cache-busting timestamp
      async () => {
        const resp = await fetch(directUrl, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.text();
      },
      // 2. High-speed AllOrigins CORS proxy with cache disable
      async () => {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}&disableCache=true&_t=${timestamp}`;
        const resp = await fetch(proxyUrl, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`Proxy 1 HTTP ${resp.status}`);
        return await resp.text();
      },
      // 3. Fallback CORS Proxy (corsproxy.io)
      async () => {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(directUrl)}`;
        const resp = await fetch(proxyUrl, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`Proxy 2 HTTP ${resp.status}`);
        return await resp.text();
      },
      // 4. Fallback CodeTabs CORS Proxy
      async () => {
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(directUrl)}`;
        const resp = await fetch(proxyUrl, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`Proxy 3 HTTP ${resp.status}`);
        return await resp.text();
      }
    ];

    for (let i = 0; i < fetchAttempts.length; i++) {
      try {
        const csvText = await fetchAttempts[i]();
        if (csvText && (csvText.toLowerCase().includes('date') || csvText.toLowerCase().includes('hari') || csvText.toLowerCase().includes('hss') || csvText.includes('/2026') || csvText.includes('/2027'))) {
          const parsed = this.parseCSV(csvText);
          if (parsed.length > 0) {
            console.log(`[Sync Success] ${plotConfig.name}: Fetched ${parsed.length} rows (Strategy ${i + 1})`);
            return parsed;
          }
        }
      } catch (err) {
        // Try next strategy
      }
    }

    console.warn(`[Sync] Could not fetch live CSV for ${plotConfig.name}, falling back to cache.`);
    return null;
  }

  /**
   * Get direct clickable links for all Google Sheets data sources
   */
  getSourceLinks() {
    const baseHtml = this.config.sheets.htmlUrl || "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSIn4Ad6HiOlE5ko3fCnHjVVn4su9QTVzau6t-wrke4sbycCDSZSf5cgACsLrP_hsxc0PNoc--OPmz/pubhtml";
    const baseUrl = this.config.sheets.baseUrl || "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSIn4Ad6HiOlE5ko3fCnHjVVn4su9QTVzau6t-wrke4sbycCDSZSf5cgACsLrP_hsxc0PNoc--OPmz/pub";
    
    return {
      spreadsheetHtml: baseHtml,
      plots: this.config.sheets.plots.map(p => ({
        id: p.id,
        name: p.name,
        shortName: p.shortName,
        gid: p.gid,
        csvUrl: `${baseUrl}?gid=${p.gid}&single=true&output=csv`,
        htmlUrl: `${baseHtml}?gid=${p.gid}&single=true`
      }))
    };
  }

  /**
   * Fetch all 4 plots simultaneously with live status report
   * Prioritizes live Google Sheets CSV over Firebase
   */
  async fetchAllPlots() {
    const results = {};
    let liveSuccessCount = 0;

    // Strategy 1: Fetch Live CSV directly from Google Sheets for all 4 plots
    const plotPromises = this.config.sheets.plots.map(async (plot) => {
      const liveData = await this.fetchPlotCSV(plot);
      if (liveData && liveData.length > 0) {
        results[plot.name] = liveData;
        liveSuccessCount++;
      }
    });

    await Promise.all(plotPromises);

    // If live Google Sheets CSV fetch succeeded for all/most plots, save and return!
    if (liveSuccessCount >= 2) {
      this.saveToCache(results);
      localStorage.setItem(this.lastSyncKey, new Date().toISOString());

      // Silently sync fresh Google Sheets data to Firebase RTDB in background
      const cloudUrl = window.APP_CONFIG?.cloudTelemetry?.endpointUrl;
      if (cloudUrl) {
        try {
          fetch(cloudUrl.replace('.json', '/sheetsData.json'), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(results)
          }).catch(() => {});
        } catch(e) {}
      }

      return {
        data: results,
        liveSuccessCount: liveSuccessCount,
        totalPlots: this.config.sheets.plots.length,
        source: 'Google Sheets (Live CSV)'
      };
    }

    // Strategy 2: Fallback to Cloud Firebase RTDB if direct Google Sheets CSV was blocked
    const cloudUrl = window.APP_CONFIG?.cloudTelemetry?.endpointUrl;
    if (cloudUrl && cloudUrl.trim() !== "") {
      try {
        const fbUrl = cloudUrl.replace('.json', '/sheetsData.json') + `?v=${Date.now()}`;
        const fbResp = await fetch(fbUrl, { cache: 'no-store' });
        if (fbResp.ok) {
          const fbJson = await fbResp.json();
          if (fbJson && typeof fbJson === 'object') {
            let validPlots = 0;
            this.config.sheets.plots.forEach(plot => {
              if (fbJson[plot.name] && Array.isArray(fbJson[plot.name]) && fbJson[plot.name].length > 0) {
                results[plot.name] = fbJson[plot.name];
                validPlots++;
              }
            });
            if (validPlots >= 2) {
              this.saveToCache(results);
              localStorage.setItem(this.lastSyncKey, new Date().toISOString());
              return {
                data: results,
                liveSuccessCount: validPlots,
                totalPlots: this.config.sheets.plots.length,
                source: 'Firebase Cloud Bridge'
              };
            }
          }
        }
      } catch (e) {
        console.warn("Firebase sheetsData fallback failed", e);
      }
    }

    // Strategy 3: Final Fallback to localStorage Cache or Preloaded Sample Data
    this.config.sheets.plots.forEach(plot => {
      if (!results[plot.name] || results[plot.name].length === 0) {
        const cached = this.getCachedPlotData(plot.name);
        results[plot.name] = cached || (window.SAMPLE_FARM_DATA ? window.SAMPLE_FARM_DATA[plot.name] : []);
      }
    });

    return {
      data: results,
      liveSuccessCount: liveSuccessCount,
      totalPlots: this.config.sheets.plots.length,
      source: 'Local Farm Cache'
    };
  }

  /**
   * Cache Management
   */
  getCachedData() {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error reading cached farm data', e);
    }
    return window.SAMPLE_FARM_DATA || {};
  }

  getCachedPlotData(plotName) {
    const cached = this.getCachedData();
    return cached[plotName] || null;
  }

  saveToCache(data) {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(data));
    } catch (e) {
      console.error('Error saving farm data to cache', e);
    }
  }

  clearCache() {
    try {
      localStorage.removeItem(this.cacheKey);
      localStorage.removeItem(this.lastSyncKey);
    } catch (e) {}
  }

  getLastSyncTime() {
    const iso = localStorage.getItem(this.lastSyncKey);
    if (!iso) return 'Cached Baseline';
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

window.GoogleSheetsService = GoogleSheetsService;

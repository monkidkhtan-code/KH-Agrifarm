/**
 * KH AGRIFARM - DRAINAGE EC & PH MONITORING SERVICE
 * Features 2 Dedicated Separated Graphs (EC Trend & pH Trend),
 * Mobile-Optimized Full Records Sheet Modal, and Agronomic Chemistry Engine.
 */

class DrainageService {
  constructor(config) {
    this.config = config || window.APP_CONFIG;
    this.sheetConfig = this.config?.sheets?.drainageSheet || {
      name: "Drainage EC & PH monitoring",
      gid: "1176156551"
    };
    this.cacheKey = 'kh_agrifarm_drainage_cache_v9';
    this.lastSyncKey = 'kh_agrifarm_drainage_last_sync_v9';
    this.records = this.getCachedRecords();
    if (!this.records || this.records.length === 0) {
      this.records = this.getDefaultBaselineRecords();
    }
    this.chartInstances = {};
    this.isInitialized = true;
  }

  async init() {
    try {
      await this.fetchDrainageData();
    } catch(e) {
      console.warn('Drainage background fetch error:', e);
    }
  }

  /**
   * Default baseline data if offline
   */
  getDefaultBaselineRecords() {
    return [
      {
        date: "06/09/2026",
        dateRaw: "06/09/2026",
        time: "13:06",
        timestamp: "06/09/2026 13:06",
        fertilizer: "Super Nila",
        p1_fertilizer: "Super Nila",
        p2a_fertilizer: "Super Nila",
        p2b_fertilizer: "Super Nila",
        p1_ecIn: 1.2,
        p1_phIn: 5.5,
        p2a_ecIn: 1.2,
        p2a_phIn: 5.5,
        p2b_ecIn: 1.2,
        p2b_phIn: 5.5,
        ecIn: 1.2,
        phIn: 5.5,
        stations: {
          p1_s1: { ec: 1.0, ph: 6.8, name: "Station 1", plot: "plot-1" },
          p1_s2: { ec: 1.4, ph: 7.2, name: "Station 2", plot: "plot-1" },
          p1_s3: { ec: 1.5, ph: 6.5, name: "Station 3", plot: "plot-1" },
          p2_s4: { ec: 1.3, ph: 6.6, name: "Station 4", plot: "plot-2a" },
          p2_s5: { ec: 1.3, ph: 6.3, name: "Station 5", plot: "plot-2a" },
          p2_s6: { ec: 1.0, ph: 6.4, name: "Station 6", plot: "plot-2b" },
          p2_s7: { ec: 1.4, ph: 6.9, name: "Station 7", plot: "plot-2b" }
        }
      },
      {
        date: "05/09/2026",
        dateRaw: "05/09/2026",
        time: "20:44",
        timestamp: "05/09/2026 20:44",
        fertilizer: "Bacillus + Rootboom",
        p1_fertilizer: "Bacillus + Rootboom",
        p2a_fertilizer: "Bacillus + Rootboom",
        p2b_fertilizer: "Bacillus + Rootboom",
        p1_ecIn: 0.4,
        p1_phIn: 3.4,
        p2a_ecIn: 0.4,
        p2a_phIn: 3.4,
        p2b_ecIn: 0.4,
        p2b_phIn: 3.4,
        ecIn: 0.4,
        phIn: 3.4,
        stations: {
          p1_s1: { ec: 1.1, ph: 6.8, name: "Station 1", plot: "plot-1" },
          p1_s2: { ec: 1.4, ph: 7.4, name: "Station 2", plot: "plot-1" },
          p1_s3: { ec: 1.3, ph: 6.6, name: "Station 3", plot: "plot-1" },
          p2_s4: { ec: 1.2, ph: 6.2, name: "Station 4", plot: "plot-2a" },
          p2_s5: { ec: 1.2, ph: 6.0, name: "Station 5", plot: "plot-2a" },
          p2_s6: { ec: 1.0, ph: 6.2, name: "Station 6", plot: "plot-2b" },
          p2_s7: { ec: 1.2, ph: 6.6, name: "Station 7", plot: "plot-2b" }
        }
      },
      {
        date: "05/09/2026",
        dateRaw: "05/09/2026",
        time: "11:49",
        timestamp: "05/09/2026 11:49",
        fertilizer: "Water",
        p1_fertilizer: "Water",
        p2a_fertilizer: "Water",
        p2b_fertilizer: "Water",
        p1_ecIn: 0.2,
        p1_phIn: 5.8,
        p2a_ecIn: 0.2,
        p2a_phIn: 5.8,
        p2b_ecIn: 0.2,
        p2b_phIn: 5.8,
        ecIn: 0.2,
        phIn: 5.8,
        stations: {
          p1_s1: { ec: 1.4, ph: 6.9, name: "Station 1", plot: "plot-1" },
          p1_s2: { ec: 1.5, ph: 7.4, name: "Station 2", plot: "plot-1" },
          p1_s3: { ec: 1.8, ph: 6.7, name: "Station 3", plot: "plot-1" },
          p2_s4: { ec: 1.0, ph: 6.2, name: "Station 4", plot: "plot-2a" },
          p2_s5: { ec: 0.9, ph: 6.2, name: "Station 5", plot: "plot-2a" },
          p2_s6: { ec: 0.9, ph: 6.2, name: "Station 6", plot: "plot-2b" },
          p2_s7: { ec: 1.3, ph: 6.7, name: "Station 7", plot: "plot-2b" }
        }
      },
      {
        date: "04/09/2026",
        dateRaw: "04/09/2026",
        time: "18:08",
        timestamp: "04/09/2026 18:08",
        fertilizer: "AB Solution",
        p1_fertilizer: "AB Solution",
        p2a_fertilizer: "AB Solution",
        p2b_fertilizer: "AB Solution",
        p1_ecIn: 2.6,
        p1_phIn: 5.4,
        p2a_ecIn: 2.6,
        p2a_phIn: 5.4,
        p2b_ecIn: 2.6,
        p2b_phIn: 5.4,
        ecIn: 2.6,
        phIn: 5.4,
        stations: {
          p1_s1: { ec: 1.3, ph: 7.0, name: "Station 1", plot: "plot-1" },
          p1_s2: { ec: 1.6, ph: 7.5, name: "Station 2", plot: "plot-1" },
          p1_s3: { ec: 1.7, ph: 6.3, name: "Station 3", plot: "plot-1" },
          p2_s4: { ec: 0.9, ph: 6.7, name: "Station 4", plot: "plot-2a" },
          p2_s5: { ec: 1.0, ph: 5.7, name: "Station 5", plot: "plot-2a" },
          p2_s6: { ec: 1.0, ph: 6.2, name: "Station 6", plot: "plot-2b" },
          p2_s7: { ec: 1.5, ph: 6.4, name: "Station 7", plot: "plot-2b" }
        }
      },
      {
        date: "04/09/2026",
        dateRaw: "04/09/2026",
        time: "14:55",
        timestamp: "04/09/2026 14:55",
        fertilizer: "Water",
        p1_fertilizer: "Water",
        p2a_fertilizer: "Water",
        p2b_fertilizer: "Water",
        p1_ecIn: 0.2,
        p1_phIn: 5.9,
        p2a_ecIn: 0.2,
        p2a_phIn: 5.9,
        p2b_ecIn: 0.2,
        p2b_phIn: 5.9,
        ecIn: 0.2,
        phIn: 5.9,
        stations: {
          p1_s1: { ec: 1.1, ph: 7.2, name: "Station 1", plot: "plot-1" },
          p1_s2: { ec: 1.7, ph: 7.4, name: "Station 2", plot: "plot-1" },
          p1_s3: { ec: 1.6, ph: 6.6, name: "Station 3", plot: "plot-1" },
          p2_s4: { ec: 1.0, ph: 6.6, name: "Station 4", plot: "plot-2a" },
          p2_s5: { ec: 1.1, ph: 5.9, name: "Station 5", plot: "plot-2a" },
          p2_s6: { ec: 1.1, ph: 6.5, name: "Station 6", plot: "plot-2b" },
          p2_s7: { ec: 1.6, ph: 6.7, name: "Station 7", plot: "plot-2b" }
        }
      },
      {
        date: "04/09/2026",
        dateRaw: "04/09/2026",
        time: "12:00",
        timestamp: "04/09/2026 12:00",
        fertilizer: "AB Solution",
        p1_fertilizer: "AB Solution",
        p2a_fertilizer: "AB Solution",
        p2b_fertilizer: "AB Solution",
        p1_ecIn: 2.5,
        p1_phIn: 5.8,
        p2a_ecIn: 2.5,
        p2a_phIn: 5.8,
        p2b_ecIn: 2.5,
        p2b_phIn: 5.8,
        ecIn: 2.5,
        phIn: 5.8,
        stations: {
          p1_s1: { ec: 1.3, ph: 7.3, name: "Station 1", plot: "plot-1" },
          p1_s2: { ec: 1.7, ph: 7.4, name: "Station 2", plot: "plot-1" },
          p1_s3: { ec: 1.5, ph: 6.8, name: "Station 3", plot: "plot-1" },
          p2_s4: { ec: 0.9, ph: 6.2, name: "Station 4", plot: "plot-2a" },
          p2_s5: { ec: 1.0, ph: 5.9, name: "Station 5", plot: "plot-2a" },
          p2_s6: { ec: 1.1, ph: 6.4, name: "Station 6", plot: "plot-2b" },
          p2_s7: { ec: 1.4, ph: 6.8, name: "Station 7", plot: "plot-2b" }
        }
      },
      {
        date: "03/09/2026",
        dateRaw: "03/09/2026",
        time: "17:23",
        timestamp: "03/09/2026 17:23",
        fertilizer: "AB Solution",
        p1_fertilizer: "AB Solution",
        p2a_fertilizer: "AB Solution",
        p2b_fertilizer: "AB Solution",
        p1_ecIn: 2.5,
        p1_phIn: 6.2,
        p2a_ecIn: 2.5,
        p2a_phIn: 6.2,
        p2b_ecIn: 2.5,
        p2b_phIn: 6.2,
        ecIn: 2.5,
        phIn: 6.2,
        stations: {
          p1_s1: { ec: 1.7, ph: 7.2, name: "Station 1", plot: "plot-1" },
          p1_s2: { ec: 1.7, ph: 7.5, name: "Station 2", plot: "plot-1" },
          p1_s3: { ec: 1.2, ph: 7.4, name: "Station 3", plot: "plot-1" },
          p2_s4: { ec: 1.0, ph: 6.8, name: "Station 4", plot: "plot-2a" },
          p2_s5: { ec: 1.7, ph: 6.7, name: "Station 5", plot: "plot-2a" },
          p2_s6: { ec: 1.1, ph: 7.0, name: "Station 6", plot: "plot-2b" },
          p2_s7: { ec: 1.3, ph: 7.2, name: "Station 7", plot: "plot-2b" }
        }
      },
      {
        date: "03/09/2026",
        dateRaw: "03/09/2026",
        time: "15:24",
        timestamp: "03/09/2026 15:24",
        fertilizer: "Water",
        p1_fertilizer: "Water",
        p2a_fertilizer: "Water",
        p2b_fertilizer: "Water",
        p1_ecIn: 0.2,
        p1_phIn: 6.2,
        p2a_ecIn: 0.2,
        p2a_phIn: 6.2,
        p2b_ecIn: 0.2,
        p2b_phIn: 6.2,
        ecIn: 0.2,
        phIn: 6.2,
        stations: {
          p1_s1: { ec: 1.6, ph: 7.1, name: "Station 1", plot: "plot-1" },
          p1_s2: { ec: 1.9, ph: 7.4, name: "Station 2", plot: "plot-1" },
          p1_s3: { ec: 1.8, ph: 7.1, name: "Station 3", plot: "plot-1" },
          p2_s4: { ec: 1.1, ph: 6.5, name: "Station 4", plot: "plot-2a" },
          p2_s5: { ec: 1.2, ph: 6.5, name: "Station 5", plot: "plot-2a" },
          p2_s6: { ec: 1.2, ph: 6.8, name: "Station 6", plot: "plot-2b" },
          p2_s7: { ec: 1.4, ph: 6.9, name: "Station 7", plot: "plot-2b" }
        }
      },
      {
        date: "02/09/2026",
        dateRaw: "02/09/2026",
        time: "19:43",
        timestamp: "02/09/2026 19:43",
        fertilizer: "Fulvic Acid",
        p1_fertilizer: "Fulvic Acid",
        p2a_fertilizer: "Fulvic Acid",
        p2b_fertilizer: "Fulvic Acid",
        p1_ecIn: 0.2,
        p1_phIn: 7.3,
        p2a_ecIn: 0.2,
        p2a_phIn: 7.3,
        p2b_ecIn: 0.2,
        p2b_phIn: 7.3,
        ecIn: 0.2,
        phIn: 7.3,
        stations: {
          p1_s1: { ec: 1.2, ph: 6.6, name: "Station 1", plot: "plot-1" },
          p1_s2: { ec: 1.7, ph: 7.2, name: "Station 2", plot: "plot-1" },
          p1_s3: { ec: 1.8, ph: 6.9, name: "Station 3", plot: "plot-1" },
          p2_s4: { ec: 1.1, ph: 6.1, name: "Station 4", plot: "plot-2a" },
          p2_s5: { ec: 1.2, ph: 6.0, name: "Station 5", plot: "plot-2a" },
          p2_s6: { ec: 1.1, ph: 6.6, name: "Station 6", plot: "plot-2b" },
          p2_s7: { ec: 1.4, ph: 6.7, name: "Station 7", plot: "plot-2b" }
        }
      },
      {
        date: "02/09/2026",
        dateRaw: "02/09/2026",
        time: "11:47",
        timestamp: "02/09/2026 11:47",
        fertilizer: "Water",
        p1_fertilizer: "Water",
        p2a_fertilizer: "Water",
        p2b_fertilizer: "Water",
        p1_ecIn: 0.3,
        p1_phIn: 7.1,
        p2a_ecIn: 0.3,
        p2a_phIn: 7.1,
        p2b_ecIn: 0.3,
        p2b_phIn: 7.1,
        ecIn: 0.3,
        phIn: 7.1,
        stations: {
          p1_s1: { ec: 3.2, ph: 6.5, name: "Station 1", plot: "plot-1" },
          p1_s2: { ec: 2.1, ph: 7.2, name: "Station 2", plot: "plot-1" },
          p1_s3: { ec: 1.8, ph: 7.0, name: "Station 3", plot: "plot-1" },
          p2_s4: { ec: 1.3, ph: 6.4, name: "Station 4", plot: "plot-2a" },
          p2_s5: { ec: 1.5, ph: 6.4, name: "Station 5", plot: "plot-2a" },
          p2_s6: { ec: 1.2, ph: 6.7, name: "Station 6", plot: "plot-2b" },
          p2_s7: { ec: 1.6, ph: 6.7, name: "Station 7", plot: "plot-2b" }
        }
      },
      {
        date: "01/09/2026",
        dateRaw: "01/09/2026",
        time: "09:41",
        timestamp: "01/09/2026 09:41",
        fertilizer: "AB Solution",
        p1_fertilizer: "AB Solution",
        p2a_fertilizer: "AB Solution",
        p2b_fertilizer: "AB Solution",
        p1_ecIn: 2.5,
        p1_phIn: 7.0,
        p2a_ecIn: 2.5,
        p2a_phIn: 7.0,
        p2b_ecIn: 2.5,
        p2b_phIn: 7.0,
        ecIn: 2.5,
        phIn: 7.0,
        stations: {
          p1_s1: { ec: 1.5, ph: 7.0, name: "Station 1", plot: "plot-1" },
          p1_s2: { ec: 2.1, ph: 7.4, name: "Station 2", plot: "plot-1" },
          p1_s3: { ec: 1.6, ph: 7.2, name: "Station 3", plot: "plot-1" },
          p2_s4: { ec: 1.2, ph: 6.6, name: "Station 4", plot: "plot-2a" },
          p2_s5: { ec: 1.1, ph: 6.6, name: "Station 5", plot: "plot-2a" },
          p2_s6: { ec: 1.2, ph: 6.9, name: "Station 6", plot: "plot-2b" },
          p2_s7: { ec: 1.7, ph: 6.9, name: "Station 7", plot: "plot-2b" }
        }
      },
      {
        date: "31/08/2026",
        dateRaw: "31/08/2026",
        time: "12:00 pm",
        timestamp: "31/08/2026 12:00 pm",
        fertilizer: "Water",
        p1_fertilizer: "Water",
        p2a_fertilizer: "Water",
        p2b_fertilizer: "Water",
        p1_ecIn: 0.2,
        p1_phIn: 7.0,
        p2a_ecIn: 0.2,
        p2a_phIn: 7.0,
        p2b_ecIn: 0.2,
        p2b_phIn: 7.0,
        ecIn: 0.2,
        phIn: 7.0,
        stations: {
          p1_s1: { ec: 1.6, ph: 6.8, name: "Station 1", plot: "plot-1" },
          p1_s2: { ec: 1.9, ph: 6.7, name: "Station 2", plot: "plot-1" },
          p1_s3: { ec: 1.7, ph: 6.6, name: "Station 3", plot: "plot-1" },
          p2_s4: { ec: 1.1, ph: 6.3, name: "Station 4", plot: "plot-2a" },
          p2_s5: { ec: 1.2, ph: 6.3, name: "Station 5", plot: "plot-2a" },
          p2_s6: { ec: 1.3, ph: 6.5, name: "Station 6", plot: "plot-2b" },
          p2_s7: { ec: 1.7, ph: 6.5, name: "Station 7", plot: "plot-2b" }
        }
      }
    ];
  }

  /**
   * Normalize date string to DD/MM/YYYY
   */
  normalizeDate(rawDate) {
    if (!rawDate) return '';
    const clean = rawDate.trim().replace(/\./g, '-').replace(/\//g, '-');
    const parts = clean.split('-');
    if (parts.length === 3) {
      let d = parts[0].padStart(2, '0');
      let m = parts[1].padStart(2, '0');
      let y = parts[2];
      if (y.length === 2) {
        y = '20' + y;
      }
      return `${d}/${m}/${y}`;
    }
    return rawDate;
  }

  /**
   * Precise Agronomic pH Evaluation (Cocopeat & Fertigation Chemistry)
   * Optimal sweet spot: 5.5 - 6.3
   */
  evaluatePh(ph) {
    if (ph === null || ph === undefined || isNaN(ph)) {
      return {
        status: 'unknown',
        tag: 'No pH Data',
        shortTag: '--',
        badgeClass: 'pill-neutral',
        dotClass: 'dot-neutral',
        isOptimal: false,
        warning: ''
      };
    }

    const val = parseFloat(ph);

    if (val < 5.0) {
      return {
        status: 'danger',
        tag: `Critical Low (${val.toFixed(1)})`,
        shortTag: `pH ${val.toFixed(1)}: Toxicity Risk`,
        badgeClass: 'pill-danger',
        dotClass: 'dot-danger',
        isOptimal: false,
        warning: 'Fe/Mn/Al toxicity risk; P, Ca, Mg, Mo uptake drops severely'
      };
    } else if (val < 5.5) {
      return {
        status: 'caution',
        tag: `Slightly Acidic (${val.toFixed(1)})`,
        shortTag: `pH ${val.toFixed(1)}: P/Ca Low`,
        badgeClass: 'pill-caution',
        dotClass: 'dot-caution',
        isOptimal: false,
        warning: 'Fe/Mn high uptake; P, Ca, Mg starting to be less available'
      };
    } else if (val <= 6.3) {
      return {
        status: 'safe',
        tag: `Optimal (${val.toFixed(1)})`,
        shortTag: `pH ${val.toFixed(1)}: Sweet Spot`,
        badgeClass: 'pill-safe',
        dotClass: 'dot-safe',
        isOptimal: true,
        warning: 'Sweet spot — Fe, Mn, Zn, B & P, Ca, Mg, K all uptake optimally'
      };
    } else if (val <= 6.8) {
      return {
        status: 'caution',
        tag: `Elevated (${val.toFixed(1)})`,
        shortTag: `pH ${val.toFixed(1)}: Fe Declining`,
        badgeClass: 'pill-caution',
        dotClass: 'dot-caution',
        isOptimal: false,
        warning: 'Fe availability declining; workable but Fe efficiency dropping'
      };
    } else if (val <= 7.0) {
      return {
        status: 'warning',
        tag: `High pH (${val.toFixed(1)})`,
        shortTag: `pH ${val.toFixed(1)}: Fe Lockout`,
        badgeClass: 'pill-warning',
        dotClass: 'dot-warning',
        isOptimal: false,
        warning: 'Fe lockout becomes noticeable; Mn, Zn, B also start declining'
      };
    } else {
      return {
        status: 'danger',
        tag: `Critical High (${val.toFixed(1)})`,
        shortTag: `pH ${val.toFixed(1)}: Severe Lockout`,
        badgeClass: 'pill-danger',
        dotClass: 'dot-danger',
        isOptimal: false,
        warning: 'Significant Fe deficiency risk; P locks up with Ca'
      };
    }
  }

  /**
   * Agronomic EC Delta Evaluation
   */
  evaluateEcDelta(ecDelta) {
    if (ecDelta === null || ecDelta === undefined || isNaN(ecDelta)) {
      return {
        status: 'unknown',
        tag: 'No EC Data',
        shortTag: '--',
        badgeClass: 'pill-neutral'
      };
    }

    const delta = parseFloat(ecDelta);
    if (delta > 0.8) {
      return {
        status: 'danger',
        tag: `Salt Accumulation (+${delta.toFixed(1)})`,
        shortTag: `+${delta.toFixed(1)} Salt Build-up`,
        badgeClass: 'pill-danger',
        warning: 'Root zone salt build-up. Flush root zone or increase run-off volume.'
      };
    } else if (delta >= 0.2 && delta <= 0.6) {
      return {
        status: 'safe',
        tag: `Optimal Run-off (+${delta.toFixed(1)})`,
        shortTag: `+${delta.toFixed(1)} Optimal`,
        badgeClass: 'pill-safe',
        warning: 'Balanced nutrient uptake and healthy crop transpiration.'
      };
    } else if (delta < 0.1) {
      return {
        status: 'caution',
        tag: `High Crop Uptake (+${delta.toFixed(1)})`,
        shortTag: `+${delta.toFixed(1)} Low Run-off`,
        badgeClass: 'pill-caution',
        warning: 'Drainage EC close to inflow. Monitor formula strength.'
      };
    } else {
      return {
        status: 'safe',
        tag: `Moderate (+${delta.toFixed(1)})`,
        shortTag: `+${delta.toFixed(1)} Moderate`,
        badgeClass: 'pill-safe',
        warning: 'Standard agricultural tolerance.'
      };
    }
  }

  /**
   * Parse CSV from Published Google Sheet
   */
  parseDrainageCSV(csvText) {
    if (!csvText || typeof csvText !== 'string') return [];
    if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.substr(1);

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
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentCell.trim());
        currentCell = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        row.push(currentCell.trim());
        if (row.some(c => c.length > 0)) lines.push(row);
        row = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    if (currentCell || row.length > 0) {
      row.push(currentCell.trim());
      if (row.some(c => c.length > 0)) lines.push(row);
    }

    if (lines.length < 2) return [];

    const headers = lines[0].map(h => (h || '').toLowerCase().trim());
    const dataRows = lines.slice(1);

    const findIndex = (keywords) => {
      return headers.findIndex(h => keywords.some(k => h.includes(k)));
    };

    const idxDate = findIndex(['date', 'tarikh', 'hari bulan']);
    const idxTime = findIndex(['time', 'stamp', 'masa', 'jam']);
    const idxFertilizer = findIndex(['fertilizer', 'water', 'baja', 'air', 'liquid', 'solution']);
    const idxP1Fert = findIndex(['p1 fertilizer', 'p1 liquid', 'p1 baja', 'p1 air', 'plot 1 fertilizer', 'p1 solution']);
    const idxP2aFert = findIndex(['p2a fertilizer', 'p2a liquid', 'p2a baja', 'p2a air', 'plot 2a fertilizer', 'p2a solution']);
    const idxP2bFert = findIndex(['p2b fertilizer', 'p2b liquid', 'p2b baja', 'p2b air', 'plot 2b fertilizer', 'p2b solution']);
    
    // Inflow Benchmarks (Plot 1, Plot 2A, Plot 2B + General fallback)
    const idxP1EcIn = findIndex(['p1 ec in', 'plot 1 ec in', 'plot1 ec in', 'p1 ec masuk', 'ec in p1']);
    const idxP1PhIn = findIndex(['p1 ph in', 'plot 1 ph in', 'plot1 ph in', 'p1 ph masuk', 'ph in p1']);
    const idxP2aEcIn = findIndex(['p2a ec in', 'plot 2a ec in', 'plot2a ec in', 'tank a ec in', 'p2a ec masuk']);
    const idxP2aPhIn = findIndex(['p2a ph in', 'plot 2a ph in', 'plot2a ph in', 'tank a ph in', 'p2a ph masuk']);
    const idxP2bEcIn = findIndex(['p2b ec in', 'plot 2b ec in', 'plot2b ec in', 'tank b ec in', 'p2b ec masuk']);
    const idxP2bPhIn = findIndex(['p2b ph in', 'plot 2b ph in', 'plot2b ph in', 'tank b ph in', 'p2b ph masuk']);
    const idxEcIn = findIndex(['ec in', 'ec_in', 'ec masuk', 'in ec']);
    const idxPhIn = findIndex(['ph in', 'ph_in', 'ph masuk', 'in ph']);

    // Stations
    const idxP1S1Ec = findIndex(['station1 ec', 'station 1 ec', 'st 1 ec', 's1 ec']);
    const idxP1S1Ph = findIndex(['station 1 ph', 'station1 ph', 'st 1 ph', 's1 ph']);
    const idxP1S2Ec = findIndex(['station2 ec', 'station 2 ec', 'st 2 ec', 's2 ec']);
    const idxP1S2Ph = findIndex(['station 2 ph', 'station2 ph', 'st 2 ph', 's2 ph']);
    const idxP1S3Ec = findIndex(['station3 ec', 'station 3 ec', 'st 3 ec', 's3 ec']);
    const idxP1S3Ph = findIndex(['station 3 ph', 'station3 ph', 'st 3 ph', 's3 ph']);

    const idxP2S4Ec = findIndex(['station4 ec', 'station 4 ec', 'st 4 ec', 's4 ec']);
    const idxP2S4Ph = findIndex(['station 4 ph', 'station4 ph', 'st 4 ph', 's4 ph']);
    const idxP2S5Ec = findIndex(['station5 ec', 'station 5 ec', 'st 5 ec', 's5 ec']);
    const idxP2S5Ph = findIndex(['station 5 ph', 'station5 ph', 'st 5 ph', 's5 ph']);
    const idxP2S6Ec = findIndex(['station6 ec', 'station 6 ec', 'st 6 ec', 's6 ec']);
    const idxP2S6Ph = findIndex(['station 6 ph', 'station6 ph', 'st 6 ph', 's6 ph']);
    const idxP2S7Ec = findIndex(['station7 ec', 'station 7 ec', 'st 7 ec', 's7 ec']);
    const idxP2S7Ph = findIndex(['station 7 ph', 'station7 ph', 'st 7 ph', 's7 ph']);

    const numVal = (v) => {
      if (v === undefined || v === null || v === '') return null;
      const parsed = parseFloat(String(v).replace(/[^\d.-]/g, ''));
      return isNaN(parsed) ? null : parsed;
    };

    const parsedRecords = [];

    dataRows.forEach(r => {
      const rawDate = idxDate >= 0 ? r[idxDate] : r[0];
      if (!rawDate || rawDate.trim() === '') return;

      const normDate = this.normalizeDate(rawDate);
      const timeVal = (idxTime >= 0 && r[idxTime]) ? r[idxTime] : '12:00 pm';
      
      let fertVal = (idxFertilizer >= 0 && r[idxFertilizer]) ? r[idxFertilizer].trim() : (r[2] && isNaN(parseFloat(r[2])) ? r[2].trim() : 'Water');
      if (fertVal.toLowerCase() === 'ab' || fertVal.toLowerCase() === 'ab solution') {
        fertVal = 'AB Solution';
      }

      const p1Fert = (idxP1Fert >= 0 && r[idxP1Fert]) ? r[idxP1Fert].trim() : fertVal;
      const p2aFert = (idxP2aFert >= 0 && r[idxP2aFert]) ? r[idxP2aFert].trim() : fertVal;
      const p2bFert = (idxP2bFert >= 0 && r[idxP2bFert]) ? r[idxP2bFert].trim() : fertVal;

      const rawEcIn = numVal(idxEcIn >= 0 ? r[idxEcIn] : (idxFertilizer >= 0 ? r[3] : r[2]));
      const rawPhIn = numVal(idxPhIn >= 0 ? r[idxPhIn] : (idxFertilizer >= 0 ? r[4] : r[3]));

      const p1EcIn = (idxP1EcIn >= 0 && numVal(r[idxP1EcIn]) !== null) ? numVal(r[idxP1EcIn]) : rawEcIn;
      const p1PhIn = (idxP1PhIn >= 0 && numVal(r[idxP1PhIn]) !== null) ? numVal(r[idxP1PhIn]) : rawPhIn;
      const p2aEcIn = (idxP2aEcIn >= 0 && numVal(r[idxP2aEcIn]) !== null) ? numVal(r[idxP2aEcIn]) : rawEcIn;
      const p2aPhIn = (idxP2aPhIn >= 0 && numVal(r[idxP2aPhIn]) !== null) ? numVal(r[idxP2aPhIn]) : rawPhIn;
      const p2bEcIn = (idxP2bEcIn >= 0 && numVal(r[idxP2bEcIn]) !== null) ? numVal(r[idxP2bEcIn]) : rawEcIn;
      const p2bPhIn = (idxP2bPhIn >= 0 && numVal(r[idxP2bPhIn]) !== null) ? numVal(r[idxP2bPhIn]) : rawPhIn;

      parsedRecords.push({
        date: normDate,
        dateRaw: rawDate,
        time: timeVal,
        timestamp: `${normDate} ${timeVal}`,
        fertilizer: fertVal || 'Water',
        p1_fertilizer: p1Fert,
        p2a_fertilizer: p2aFert,
        p2b_fertilizer: p2bFert,
        p1_ecIn: p1EcIn,
        p1_phIn: p1PhIn,
        p2a_ecIn: p2aEcIn,
        p2a_phIn: p2aPhIn,
        p2b_ecIn: p2bEcIn,
        p2b_phIn: p2bPhIn,
        ecIn: rawEcIn,
        phIn: rawPhIn,
        stations: {
          p1_s1: { ec: numVal(idxP1S1Ec >= 0 ? r[idxP1S1Ec] : (idxFertilizer >= 0 ? r[5] : r[4])), ph: numVal(idxP1S1Ph >= 0 ? r[idxP1S1Ph] : (idxFertilizer >= 0 ? r[6] : r[5])), name: "Station 1", plot: "plot-1" },
          p1_s2: { ec: numVal(idxP1S2Ec >= 0 ? r[idxP1S2Ec] : (idxFertilizer >= 0 ? r[7] : r[6])), ph: numVal(idxP1S2Ph >= 0 ? r[idxP1S2Ph] : (idxFertilizer >= 0 ? r[8] : r[7])), name: "Station 2", plot: "plot-1" },
          p1_s3: { ec: numVal(idxP1S3Ec >= 0 ? r[idxP1S3Ec] : (idxFertilizer >= 0 ? r[9] : r[8])), ph: numVal(idxP1S3Ph >= 0 ? r[idxP1S3Ph] : (idxFertilizer >= 0 ? r[10] : r[9])), name: "Station 3", plot: "plot-1" },
          p2_s4: { ec: numVal(idxP2S4Ec >= 0 ? r[idxP2S4Ec] : (idxFertilizer >= 0 ? r[11] : r[10])), ph: numVal(idxP2S4Ph >= 0 ? r[idxP2S4Ph] : (idxFertilizer >= 0 ? r[12] : r[11])), name: "Station 4", plot: "plot-2a" },
          p2_s5: { ec: numVal(idxP2S5Ec >= 0 ? r[idxP2S5Ec] : (idxFertilizer >= 0 ? r[13] : r[12])), ph: numVal(idxP2S5Ph >= 0 ? r[idxP2S5Ph] : (idxFertilizer >= 0 ? r[14] : r[13])), name: "Station 5", plot: "plot-2a" },
          p2_s6: { ec: numVal(idxP2S6Ec >= 0 ? r[idxP2S6Ec] : (idxFertilizer >= 0 ? r[15] : r[14])), ph: numVal(idxP2S6Ph >= 0 ? r[idxP2S6Ph] : (idxFertilizer >= 0 ? r[16] : r[15])), name: "Station 6", plot: "plot-2b" },
          p2_s7: { ec: numVal(idxP2S7Ec >= 0 ? r[idxP2S7Ec] : (idxFertilizer >= 0 ? r[17] : r[16])), ph: numVal(idxP2S7Ph >= 0 ? r[idxP2S7Ph] : (idxFertilizer >= 0 ? r[18] : r[17])), name: "Station 7", plot: "plot-2b" }
        }
      });
    });

    return parsedRecords;
  }

  /**
   * Fetch Live Drainage CSV from Google Sheets or Cloud Bridge
   */
  async fetchDrainageData() {
    const timestamp = Date.now();
    const baseUrl = this.config?.sheets?.baseUrl || "https://docs.google.com/spreadsheets/d/e/2PACX-1vQSIn4Ad6HiOlE5ko3fCnHjVVn4su9QTVzau6t-wrke4sbycCDSZSf5cgACsLrP_hsxc0PNoc--OPmz/pub";
    const gid = this.sheetConfig.gid || "1176156551";
    const directUrl = `${baseUrl}?gid=${gid}&single=true&output=csv&_t=${timestamp}`;

    const attempts = [
      async () => {
        const resp = await fetch(directUrl, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.text();
      },
      async () => {
        const proxyUrl = `https://proxy.cors.sh/${directUrl}`;
        const resp = await fetch(proxyUrl, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`Proxy cors.sh HTTP ${resp.status}`);
        return await resp.text();
      },
      async () => {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(directUrl)}`;
        const resp = await fetch(proxyUrl, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`Proxy allorigins JSON HTTP ${resp.status}`);
        const data = await resp.json();
        return data.contents;
      },
      async () => {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}&disableCache=true&_t=${timestamp}`;
        const resp = await fetch(proxyUrl, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`Proxy 1 HTTP ${resp.status}`);
        return await resp.text();
      },
      async () => {
        const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(directUrl)}`;
        const resp = await fetch(proxyUrl, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`Proxy 3 HTTP ${resp.status}`);
        return await resp.text();
      }
    ];

    let fetchedRows = null;
    for (let i = 0; i < attempts.length; i++) {
      try {
        const text = await attempts[i]();
        if (text && (text.toLowerCase().includes('date') || text.toLowerCase().includes('station'))) {
          const parsed = this.parseDrainageCSV(text);
          if (parsed && parsed.length > 0) {
            fetchedRows = parsed;
            console.log(`[DrainageSync] Successfully fetched ${parsed.length} drainage rows from Google Sheets (Method ${i + 1})`);
            break;
          }
        }
      } catch (e) {}
    }

    if (fetchedRows && fetchedRows.length > 0) {
      // Google Sheet is 100% the Single Source of Truth
      this.records = fetchedRows.sort((a, b) => this.compareRecordDate(b, a));
      this.saveToCache(this.records);
      localStorage.setItem(this.lastSyncKey, new Date().toISOString());

      if (window.khApp && typeof window.khApp.renderAll === 'function') {
        window.khApp.renderAll();
      }
      return this.records;
    }

    return this.records;
  }

  mergeRecords(localList, remoteList) {
    const map = new Map();
    (remoteList || []).forEach(r => {
      const normD = this.normalizeDate(r.date || r.dateRaw);
      const cleanT = (r.time || '').trim().toLowerCase().replace(/\s+/g, '');
      const key = `${normD}_${cleanT}`;
      map.set(key, r);
    });
    (localList || []).forEach(r => {
      const normD = this.normalizeDate(r.date || r.dateRaw);
      const cleanT = (r.time || '').trim().toLowerCase().replace(/\s+/g, '');
      const key = `${normD}_${cleanT}`;
      if (!map.has(key)) {
        map.set(key, r);
      } else {
        const existing = map.get(key);
        map.set(key, { ...existing, ...r });
      }
    });
    return Array.from(map.values()).sort((a, b) => this.compareRecordDate(b, a));
  }

  parseTimestampMs(dateStr, timeStr) {
    if (!dateStr) return 0;
    try {
      const cleanDate = dateStr.trim().replace(/\./g, '-').replace(/\//g, '-');
      const parts = cleanDate.split('-');
      let d = 1, m = 1, y = 2026;
      if (parts.length === 3) {
        d = parseInt(parts[0], 10) || 1;
        m = parseInt(parts[1], 10) || 1;
        y = parseInt(parts[2], 10) || 2026;
        if (y < 100) y += 2000;
      }

      let hour = 12, min = 0;
      if (timeStr) {
        const isPm = timeStr.toLowerCase().includes('pm');
        const isAm = timeStr.toLowerCase().includes('am');
        const cleanT = timeStr.toLowerCase().replace(/[^\d:]/g, '');
        const tParts = cleanT.split(':');
        if (tParts.length >= 1) {
          hour = parseInt(tParts[0], 10) || 12;
          if (isPm && hour < 12) hour += 12;
          if (isAm && hour === 12) hour = 0;
        }
        if (tParts.length >= 2) {
          min = parseInt(tParts[1], 10) || 0;
        }
      }

      return new Date(y, m - 1, d, hour, min, 0).getTime();
    } catch(e) {
      return 0;
    }
  }

  compareRecordDate(a, b) {
    const timeA = this.parseTimestampMs(a.date || a.dateRaw, a.time);
    const timeB = this.parseTimestampMs(b.date || b.dateRaw, b.time);
    return timeA - timeB;
  }

  /**
   * Calculate Plot Specific Aggregate Metrics with Agronomic Diagnostics
   * Supports: 'plot-1', 'plot-2a', 'plot-2b', and 'plot-2'
   */
  calcPlotSummary(entry, plotId) {
    if (!entry) return null;
    let stationKeys = [];
    let ecIn = entry.ecIn;
    let phIn = entry.phIn;
    let plotLabel = "Plot 1";

    let fert = entry.fertilizer || 'Water';
    if (plotId === 'plot-1') {
      stationKeys = ['p1_s1', 'p1_s2', 'p1_s3'];
      ecIn = (entry.p1_ecIn !== undefined && entry.p1_ecIn !== null) ? entry.p1_ecIn : entry.ecIn;
      phIn = (entry.p1_phIn !== undefined && entry.p1_phIn !== null) ? entry.p1_phIn : entry.phIn;
      fert = entry.p1_fertilizer || entry.fertilizer || 'Water';
      plotLabel = "Plot 1";
    } else if (plotId === 'plot-2a') {
      stationKeys = ['p2_s4', 'p2_s5'];
      ecIn = (entry.p2a_ecIn !== undefined && entry.p2a_ecIn !== null) ? entry.p2a_ecIn : entry.ecIn;
      phIn = (entry.p2a_phIn !== undefined && entry.p2a_phIn !== null) ? entry.p2a_phIn : entry.phIn;
      fert = entry.p2a_fertilizer || entry.fertilizer || 'Water';
      plotLabel = "Plot 2A";
    } else if (plotId === 'plot-2b') {
      stationKeys = ['p2_s6', 'p2_s7'];
      ecIn = (entry.p2b_ecIn !== undefined && entry.p2b_ecIn !== null) ? entry.p2b_ecIn : entry.ecIn;
      phIn = (entry.p2b_phIn !== undefined && entry.p2b_phIn !== null) ? entry.p2b_phIn : entry.phIn;
      fert = entry.p2b_fertilizer || entry.fertilizer || 'Water';
      plotLabel = "Plot 2B";
    } else {
      // General plot-2 fallback
      stationKeys = ['p2_s4', 'p2_s5', 'p2_s6', 'p2_s7'];
      plotLabel = "Plot 2";
    }

    const validEcs = [];
    const validPhs = [];
    const stationDetails = [];
    const stationWarnings = [];

    stationKeys.forEach(k => {
      const s = entry.stations ? entry.stations[k] : null;
      if (s) {
        if (s.ec !== null && s.ec !== undefined) validEcs.push(s.ec);
        if (s.ph !== null && s.ph !== undefined) validPhs.push(s.ph);

        const phEval = this.evaluatePh(s.ph);
        const detailedStation = {
          ...s,
          phEval: phEval
        };
        stationDetails.push(detailedStation);

        if (s.ph !== null && !phEval.isOptimal) {
          stationWarnings.push({
            name: s.name,
            ph: s.ph,
            eval: phEval
          });
        }
      }
    });

    const avgEc = validEcs.length > 0 ? (validEcs.reduce((a, b) => a + b, 0) / validEcs.length) : null;
    const avgPh = validPhs.length > 0 ? (validPhs.reduce((a, b) => a + b, 0) / validPhs.length) : null;
    
    let ecDelta = null;
    if (avgEc !== null && ecIn !== null && ecIn !== undefined) {
      ecDelta = Math.round((avgEc - ecIn) * 100) / 100;
    }

    const ecEval = this.evaluateEcDelta(ecDelta);
    const avgPhEval = this.evaluatePh(avgPh);
    const inflowPhEval = this.evaluatePh(phIn);

    return {
      plotId: plotId,
      plotLabel: plotLabel,
      date: entry.date,
      time: entry.time,
      fertilizer: fert,
      ecIn: ecIn,
      phIn: phIn,
      inflowPhEval: inflowPhEval,
      avgDrainageEc: avgEc !== null ? Math.round(avgEc * 100) / 100 : null,
      avgDrainagePh: avgPh !== null ? Math.round(avgPh * 100) / 100 : null,
      ecDelta: ecDelta,
      ecEval: ecEval,
      avgPhEval: avgPhEval,
      stations: stationDetails,
      stationWarnings: stationWarnings,
      hasStationWarning: stationWarnings.length > 0
    };
  }

  getPast5Records(plotId) {
    return this.getPastRecords(plotId, 10);
  }

  getPastRecords(plotId, limit = 10) {
    if (!this.records || this.records.length === 0) return [];
    const sorted = [...this.records].sort((a, b) => this.compareRecordDate(b, a));
    const list = sorted.slice(0, limit);

    return list.map(r => ({
      record: r,
      summary: this.calcPlotSummary(r, plotId)
    }));
  }

  getLatestRecord(plotId) {
    const list = this.getPastRecords(plotId, 1);
    return list.length > 0 ? list[0] : null;
  }

  /**
   * Save a unified entry (All Stations in 1 single submit)
   */
  async saveDrainageEntry(payload) {
    if (!payload || !payload.date) return false;

    const normDate = this.normalizeDate(payload.date);
    const p1EcIn = (payload.p1_ecIn !== undefined && payload.p1_ecIn !== '') ? parseFloat(payload.p1_ecIn) : ((payload.ecIn !== undefined && payload.ecIn !== '') ? parseFloat(payload.ecIn) : null);
    const p1PhIn = (payload.p1_phIn !== undefined && payload.p1_phIn !== '') ? parseFloat(payload.p1_phIn) : ((payload.phIn !== undefined && payload.phIn !== '') ? parseFloat(payload.phIn) : null);
    const p2aEcIn = (payload.p2a_ecIn !== undefined && payload.p2a_ecIn !== '') ? parseFloat(payload.p2a_ecIn) : ((payload.ecIn !== undefined && payload.ecIn !== '') ? parseFloat(payload.ecIn) : null);
    const p2aPhIn = (payload.p2a_phIn !== undefined && payload.p2a_phIn !== '') ? parseFloat(payload.p2a_phIn) : ((payload.phIn !== undefined && payload.phIn !== '') ? parseFloat(payload.phIn) : null);
    const p2bEcIn = (payload.p2b_ecIn !== undefined && payload.p2b_ecIn !== '') ? parseFloat(payload.p2b_ecIn) : ((payload.ecIn !== undefined && payload.ecIn !== '') ? parseFloat(payload.ecIn) : null);
    const p2bPhIn = (payload.p2b_phIn !== undefined && payload.p2b_phIn !== '') ? parseFloat(payload.p2b_phIn) : ((payload.phIn !== undefined && payload.phIn !== '') ? parseFloat(payload.phIn) : null);

    const p1Fert = payload.p1_fertilizer || payload.fertilizer || 'Water';
    const p2aFert = payload.p2a_fertilizer || payload.fertilizer || 'Water';
    const p2bFert = payload.p2b_fertilizer || payload.fertilizer || 'Water';

    const newEntry = {
      date: normDate,
      dateRaw: payload.date,
      time: payload.time || '12:00 pm',
      timestamp: `${normDate} ${payload.time || '12:00 pm'}`,
      fertilizer: p1Fert,
      p1_fertilizer: p1Fert,
      p2a_fertilizer: p2aFert,
      p2b_fertilizer: p2bFert,
      p1_ecIn: p1EcIn,
      p1_phIn: p1PhIn,
      p2a_ecIn: p2aEcIn,
      p2a_phIn: p2aPhIn,
      p2b_ecIn: p2bEcIn,
      p2b_phIn: p2bPhIn,
      ecIn: p1EcIn ?? p2aEcIn,
      phIn: p1PhIn ?? p2aPhIn,
      stations: {
        p1_s1: { ec: (payload.p1_s1_ec !== '' && payload.p1_s1_ec !== undefined) ? parseFloat(payload.p1_s1_ec) : null, ph: (payload.p1_s1_ph !== '' && payload.p1_s1_ph !== undefined) ? parseFloat(payload.p1_s1_ph) : null, name: "Station 1", plot: "plot-1" },
        p1_s2: { ec: (payload.p1_s2_ec !== '' && payload.p1_s2_ec !== undefined) ? parseFloat(payload.p1_s2_ec) : null, ph: (payload.p1_s2_ph !== '' && payload.p1_s2_ph !== undefined) ? parseFloat(payload.p1_s2_ph) : null, name: "Station 2", plot: "plot-1" },
        p1_s3: { ec: (payload.p1_s3_ec !== '' && payload.p1_s3_ec !== undefined) ? parseFloat(payload.p1_s3_ec) : null, ph: (payload.p1_s3_ph !== '' && payload.p1_s3_ph !== undefined) ? parseFloat(payload.p1_s3_ph) : null, name: "Station 3", plot: "plot-1" },
        p2_s4: { ec: (payload.p2_s4_ec !== '' && payload.p2_s4_ec !== undefined) ? parseFloat(payload.p2_s4_ec) : null, ph: (payload.p2_s4_ph !== '' && payload.p2_s4_ph !== undefined) ? parseFloat(payload.p2_s4_ph) : null, name: "Station 4", plot: "plot-2a" },
        p2_s5: { ec: (payload.p2_s5_ec !== '' && payload.p2_s5_ec !== undefined) ? parseFloat(payload.p2_s5_ec) : null, ph: (payload.p2_s5_ph !== '' && payload.p2_s5_ph !== undefined) ? parseFloat(payload.p2_s5_ph) : null, name: "Station 5", plot: "plot-2a" },
        p2_s6: { ec: (payload.p2_s6_ec !== '' && payload.p2_s6_ec !== undefined) ? parseFloat(payload.p2_s6_ec) : null, ph: (payload.p2_s6_ph !== '' && payload.p2_s6_ph !== undefined) ? parseFloat(payload.p2_s6_ph) : null, name: "Station 6", plot: "plot-2b" },
        p2_s7: { ec: (payload.p2_s7_ec !== '' && payload.p2_s7_ec !== undefined) ? parseFloat(payload.p2_s7_ec) : null, ph: (payload.p2_s7_ph !== '' && payload.p2_s7_ph !== undefined) ? parseFloat(payload.p2_s7_ph) : null, name: "Station 7", plot: "plot-2b" }
      }
    };

    this.records = this.records.filter(r => !(r.date === newEntry.date && r.time === newEntry.time));
    this.records.unshift(newEntry);
    this.records.sort((a, b) => this.compareRecordDate(b, a));

    this.saveToCache(this.records);
    localStorage.setItem(this.lastSyncKey, new Date().toISOString());

    // 2. Direct Google Apps Script Web App Push (Appends row to Google Sheet)
    const appsScriptUrl = this.sheetConfig?.appsScriptUrl || this.config?.sheets?.drainageSheet?.appsScriptUrl;
    if (appsScriptUrl && appsScriptUrl.startsWith('http')) {
      try {
        const gasPayload = {
          action: "appendDrainageRow",
          sheetName: this.sheetConfig?.name || "Drainage EC & PH monitoring",
          date: newEntry.dateRaw || newEntry.date,
          time: newEntry.time,
          fertilizer: newEntry.fertilizer,
          fertilizerWater: newEntry.fertilizer,
          p1_fertilizer: newEntry.p1_fertilizer,
          p2a_fertilizer: newEntry.p2a_fertilizer,
          p2b_fertilizer: newEntry.p2b_fertilizer,
          p1_ecIn: newEntry.p1_ecIn,
          p1_phIn: newEntry.p1_phIn,
          p2a_ecIn: newEntry.p2a_ecIn,
          p2a_phIn: newEntry.p2a_phIn,
          p2b_ecIn: newEntry.p2b_ecIn,
          p2b_phIn: newEntry.p2b_phIn,
          ecIn: newEntry.ecIn,
          phIn: newEntry.phIn,
          p1_s1_ec: newEntry.stations.p1_s1.ec,
          p1_s1_ph: newEntry.stations.p1_s1.ph,
          p1_s2_ec: newEntry.stations.p1_s2.ec,
          p1_s2_ph: newEntry.stations.p1_s2.ph,
          p1_s3_ec: newEntry.stations.p1_s3.ec,
          p1_s3_ph: newEntry.stations.p1_s3.ph,
          p2_s4_ec: newEntry.stations.p2_s4.ec,
          p2_s4_ph: newEntry.stations.p2_s4.ph,
          p2_s5_ec: newEntry.stations.p2_s5.ec,
          p2_s5_ph: newEntry.stations.p2_s5.ph,
          p2_s6_ec: newEntry.stations.p2_s6.ec,
          p2_s6_ph: newEntry.stations.p2_s6.ph,
          p2_s7_ec: newEntry.stations.p2_s7.ec,
          p2_s7_ph: newEntry.stations.p2_s7.ph
        };

        fetch(appsScriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gasPayload)
        }).then(() => {
          console.log('[DrainageSync] Pushed drainage entry to Google Apps Script');
          setTimeout(() => this.fetchDrainageData(), 3000);
        }).catch(err => {
          console.warn('[DrainageSync] Apps Script POST error:', err);
        });
      } catch (e) {
        console.warn('[DrainageSync] Apps Script write error:', e);
      }
    }

    return true;
  }

  async clearDrainageCacheAndSync() {
    localStorage.removeItem(this.cacheKey);
    localStorage.removeItem(this.lastSyncKey);
    this.records = [];
    await this.fetchDrainageData();
    return this.records;
  }

  getCachedRecords() {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  }

  saveToCache(records) {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(records));
    } catch (e) {}
  }

  /**
   * Render Ultra-Clean Dashboard Widget inside Daily Plot Cards with 2 Dedicated Separate Graphs
   */
  /**
   * Helper to build a single sub-plot telemetry block with hero metrics, status, station tiles, warnings & charts
   */
  buildSubPlotTelemetryBlock(subPlotId, subPlotTitle, subPlotBadgeHtml, summary, gridClass = 'grid-3-tiles') {
    const ecInVal = (summary && summary.ecIn !== null && summary.ecIn !== undefined) ? Number(summary.ecIn).toFixed(1) : '--';
    const phInVal = (summary && summary.phIn !== null && summary.phIn !== undefined) ? Number(summary.phIn).toFixed(1) : '--';
    const drainEcVal = (summary && summary.avgDrainageEc !== null && summary.avgDrainageEc !== undefined) ? Number(summary.avgDrainageEc).toFixed(1) : '--';
    const drainPhVal = (summary && summary.avgDrainagePh !== null && summary.avgDrainagePh !== undefined) ? Number(summary.avgDrainagePh).toFixed(1) : '--';
    const deltaVal = (summary && summary.ecDelta !== null && summary.ecDelta !== undefined) 
      ? (summary.ecDelta > 0 ? `+${Number(summary.ecDelta).toFixed(1)}` : `${Number(summary.ecDelta).toFixed(1)}`) 
      : '--';

    // Clean Lightweight Status Text
    let ecStatusText = '';
    if (summary && summary.ecDelta !== null && summary.ecDelta !== undefined && summary.ecEval) {
      const ecColorClass = summary.ecEval.status === 'safe' ? 'text-emerald' : (summary.ecEval.status === 'danger' ? 'text-rose' : 'text-amber');
      const ecLabel = summary.ecEval.status === 'danger' ? 'Salt Build-up' : (summary.ecEval.status === 'caution' ? 'Low Run-off' : 'Optimal Run-off');
      ecStatusText = `<span class="stat-text-item ${ecColorClass}"><i data-lucide="zap"></i> &Delta;EC ${deltaVal} (${ecLabel})</span>`;
    } else {
      ecStatusText = `<span class="stat-text-item text-muted"><i data-lucide="zap"></i> No EC Delta</span>`;
    }

    let phStatusText = '';
    if (summary && summary.avgDrainagePh !== null && summary.avgDrainagePh !== undefined) {
      const phColorClass = (summary.avgPhEval && summary.avgPhEval.status === 'safe') ? 'text-emerald' : ((summary.avgPhEval && summary.avgPhEval.status === 'danger') ? 'text-rose' : 'text-amber');
      let phLabel = 'Sweet Spot';
      const p = summary.avgDrainagePh;
      if (p < 5.0) phLabel = 'Toxicity Risk';
      else if (p < 5.5) phLabel = 'Slightly Acidic';
      else if (p <= 6.3) phLabel = 'Sweet Spot';
      else if (p <= 6.8) phLabel = 'Fe Declining';
      else if (p <= 7.0) phLabel = 'Fe Lockout';
      else phLabel = 'Severe Lockout';

      phStatusText = `<span class="stat-text-item ${phColorClass}"><i data-lucide="droplet"></i> Run-off pH ${drainPhVal} (${phLabel})</span>`;
    }

    // Station Tiles Grid
    let stationTilesHtml = '';
    if (summary && summary.stations && summary.stations.length > 0) {
      stationTilesHtml = summary.stations.map(st => {
        const ecStr = (st.ec !== null && st.ec !== undefined) ? Number(st.ec).toFixed(1) : '--';
        const phStr = (st.ph !== null && st.ph !== undefined) ? Number(st.ph).toFixed(1) : '--';
        const ev = st.phEval || { status: 'safe', dotClass: 'dot-emerald', tag: 'Optimal' };
        const tileClass = ev.status === 'safe' ? 'tile-safe' : (ev.status === 'danger' ? 'tile-danger' : (ev.status === 'warning' ? 'tile-warning' : 'tile-caution'));
        const stName = (st.name || 'Station').replace('Station ', 'St ');

        return `
          <div class="st-col-tile ${tileClass}" title="${stName}: ${ecStr} EC, pH ${phStr} (${ev.tag || ''})">
            <div class="st-tile-head">
              <span class="st-dot ${ev.dotClass || 'dot-emerald'}"></span>
              <span class="st-tile-name">${stName}</span>
            </div>
            <div class="st-tile-ec font-mono">${ecStr} <small>EC</small></div>
            <div class="st-tile-ph font-mono ${ev.status === 'safe' ? 'text-emerald' : 'text-amber'}">pH ${phStr}</div>
          </div>
        `;
      }).join('');
    }

    // Out of sweet spot Alert Banner
    let warningBannerHtml = '';
    if (summary && summary.hasStationWarning && summary.stationWarnings) {
      const names = summary.stationWarnings.map(w => `${(w.name || 'Station').replace('Station ', 'St ')} (pH ${w.ph})`).join(', ');
      warningBannerHtml = `
        <div class="drainage-ph-micro-alert" title="Target Range: 5.5–6.3 pH">
          <i data-lucide="alert-triangle" class="ph-micro-icon"></i>
          <span><strong>pH Alert</strong>: ${names} outside 5.5–6.3 sweet spot</span>
        </div>
      `;
    }

    return `
      <div class="drainage-sub-block" style="margin-bottom: 0.85rem;">
        <!-- Sub-block Header / Sub-title -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.45rem; padding-bottom:0.35rem; border-bottom:1px solid rgba(255,255,255,0.06); font-size:0.75rem;">
          <div style="display:inline-flex; align-items:center; gap:0.4rem; font-weight:700; color:#f8fafc;">
            ${subPlotBadgeHtml}
            <span>${subPlotTitle}</span>
          </div>
          <span class="font-mono text-cyan" style="font-size:0.72rem; font-weight:600;">
            ${summary ? `${summary.date} &bull; ${summary.time}` : 'No records'}
          </span>
        </div>

        <!-- 1 Unified Telemetry Hero Box -->
        <div class="drainage-hero-box">
          <!-- Top Row: Inflow Benchmark vs Drainage Outflow Average -->
          <div class="hero-metric-row">
            <div class="hero-metric-item">
              <span class="hero-lbl">Inflow <strong style="color:#38bdf8;">(${summary && summary.fertilizer ? summary.fertilizer : 'Water'})</strong></span>
              <span class="hero-val font-mono"><strong>${ecInVal}</strong> <small>EC</small> &bull; pH <strong>${phInVal}</strong></span>
            </div>
            <div class="hero-metric-item text-right">
              <span class="hero-lbl">Run-off Avg</span>
              <span class="hero-val font-mono text-emerald"><strong>${drainEcVal}</strong> <small>EC</small> &bull; <span class="text-cyan">pH <strong>${drainPhVal}</strong></span></span>
            </div>
          </div>

          <!-- Middle Row: Clean Colored Status Text -->
          <div class="drainage-status-text-row">
            ${ecStatusText}
            <span class="stat-sep">&bull;</span>
            ${phStatusText}
          </div>

          <!-- Bottom Row: Station Column Tiles Grid -->
          ${stationTilesHtml ? `
            <div class="drainage-station-grid-tiles ${gridClass}">
              ${stationTilesHtml}
            </div>
          ` : ''}

          <!-- 1-Line Out of Range Alert -->
          ${warningBannerHtml}
        </div>

        <!-- 2 SEPARATE GRAPHS (EC TREND & PH TREND PER ENTRY) -->
        <div class="drainage-graphs-card">
          <!-- Graph 1: EC Run-Off Dynamics (Every Entry) -->
          <div class="single-graph-block">
            <div class="graph-block-header">
              <div class="graph-title-left">
                <i data-lucide="zap" style="width:12px;height:12px;color:#34d399;"></i>
                <span>EC Dynamics (Every Entry)</span>
              </div>
              <div class="graph-legend-right">
                <span class="leg-item"><span class="leg-dot dot-ec-in"></span> Inflow</span>
                <span class="leg-item"><span class="leg-dot dot-ec-out"></span> Run-off</span>
              </div>
            </div>
            <div class="graph-canvas-container">
              <canvas id="drainage-ec-chart-${subPlotId}" class="drainage-ec-canvas" data-plot="${subPlotId}"></canvas>
            </div>
          </div>

          <!-- Graph 2: pH Agronomic Dynamics (Every Entry) -->
          <div class="single-graph-block">
            <div class="graph-block-header">
              <div class="graph-title-left">
                <i data-lucide="droplet" style="width:12px;height:12px;color:#fbbf24;"></i>
                <span>pH Dynamics (Every Entry)</span>
              </div>
              <div class="graph-legend-right">
                <span class="leg-item"><span class="leg-dot dot-ph"></span> Run-off pH</span>
                <span class="leg-item"><span class="leg-dot dot-sweet"></span> 5.5–6.3 Target</span>
              </div>
            </div>
            <div class="graph-canvas-container">
              <canvas id="drainage-ph-chart-${subPlotId}" class="drainage-ph-canvas" data-plot="${subPlotId}"></canvas>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Ultra-Clean Dashboard Widget inside Daily Plot Cards with Dedicated Separate Graphs
   */
  renderPlotDrainageCard(plotId) {
    try {
      const isP1 = (plotId === 'plot-1');
      const isP2 = (plotId === 'plot-2');
      if (!isP1 && !isP2) return '';

      let bodyContentHtml = '';

      if (isP1) {
        const historyP1 = this.getPast5Records('plot-1') || [];
        const latestP1 = historyP1.length > 0 ? historyP1[0] : null;
        const summaryP1 = latestP1 ? latestP1.summary : null;
        const badgeHtml = `<span class="plot-color-indicator dot-p1"></span>`;
        bodyContentHtml = this.buildSubPlotTelemetryBlock('plot-1', 'Plot 1 Stations (St 1, 2, 3)', badgeHtml, summaryP1, 'grid-3-tiles');
      } else if (isP2) {
        // Plot 2A (Stations 4 & 5)
        const historyP2a = this.getPast5Records('plot-2a') || [];
        const latestP2a = historyP2a.length > 0 ? historyP2a[0] : null;
        const summaryP2a = latestP2a ? latestP2a.summary : null;
        const badgeP2a = `<span class="plot-color-indicator dot-p2"></span>`;
        const blockP2a = this.buildSubPlotTelemetryBlock('plot-2a', 'Plot 2A (St 4, 5)', badgeP2a, summaryP2a, 'grid-2-tiles');

        // Plot 2B (Stations 6 & 7)
        const historyP2b = this.getPast5Records('plot-2b') || [];
        const latestP2b = historyP2b.length > 0 ? historyP2b[0] : null;
        const summaryP2b = latestP2b ? latestP2b.summary : null;
        const badgeP2b = `<span class="plot-color-indicator" style="background:#818cf8;"></span>`;
        const blockP2b = this.buildSubPlotTelemetryBlock('plot-2b', 'Plot 2B (St 6, 7)', badgeP2b, summaryP2b, 'grid-2-tiles');

        bodyContentHtml = `${blockP2a}${blockP2b}`;
      }

      const plotBadge = isP1 ? "Plot 1" : "Plot 2";

      return `
        <div class="activity-section drainage-monitoring-section" data-plot-id="${plotId}">
          <!-- Header Bar -->
          <div class="drainage-clean-header">
            <div class="drainage-title-box">
              <i data-lucide="test-tube-2" class="drainage-icon"></i>
              <span class="drainage-title-text">Drainage Run-Off</span>
              <span class="drainage-plot-badge">${plotBadge}</span>
            </div>
            <div class="drainage-actions-wrap">
              <button class="btn-clean-action btn-records" data-open-records-modal="${plotId}" title="View all records in full sheet popup">
                <i data-lucide="file-spreadsheet"></i>
                <span>Records</span>
              </button>
              <button class="btn-clean-action btn-log" data-open-drainage-modal="${plotId}" title="Log reading">
                <i data-lucide="plus"></i>
                <span>Log</span>
              </button>
            </div>
          </div>

          ${bodyContentHtml}
        </div>
      `;
    } catch(err) {
      console.error('[DrainageService] renderPlotDrainageCard error:', err);
      return '';
    }
  }

  formatEntryLabel(dateStr, timeStr) {
    const d = dateStr ? dateStr.slice(0, 5) : '';
    let t = timeStr || '';
    t = t.trim().toLowerCase().replace(/\s+/g, '').replace(':00', '');
    return `${d} ${t}`;
  }

  /**
   * Render All Separate Charts (EC & pH) for Every Data Entry using Chart.js
   */
  renderAllDrainageCharts() {
    if (!window.Chart) return;

    ['plot-1', 'plot-2a', 'plot-2b'].forEach(plotId => {
      const pastEntries = this.getPastRecords(plotId, 10);
      const ordered = [...pastEntries].reverse();

      let chartDataPoints = ordered.map(item => {
        const s = item.summary;
        const entryLabel = this.formatEntryLabel(s.date, s.time);
        return {
          label: entryLabel,
          date: s.date,
          time: s.time,
          ecIn: s.ecIn !== null ? s.ecIn : 0.2,
          ecDrain: s.avgDrainageEc !== null ? s.avgDrainageEc : 1.7,
          phDrain: s.avgDrainagePh !== null ? s.avgDrainagePh : 6.7
        };
      });

      if (chartDataPoints.length === 0) {
        chartDataPoints = [
          { label: 'Baseline', date: '31/08/2026', time: '12:00 pm', ecIn: 0.2, ecDrain: 1.7, phDrain: 6.7 }
        ];
      }

      const labels = chartDataPoints.map(d => d.label);
      const ecInValues = chartDataPoints.map(d => d.ecIn);
      const ecDrainValues = chartDataPoints.map(d => d.ecDrain);
      const phValues = chartDataPoints.map(d => d.phDrain);

      // 1. EC Chart
      const ecEl = document.getElementById(`drainage-ec-chart-${plotId}`);
      if (ecEl) {
        const existing = Chart.getChart(ecEl);
        if (existing) existing.destroy();

        const ctx = ecEl.getContext('2d');
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Inflow EC',
                data: ecInValues,
                borderColor: '#38bdf8',
                borderDash: [3, 3],
                borderWidth: 1.5,
                pointRadius: 2.5,
                pointHoverRadius: 4.5,
                pointBackgroundColor: '#38bdf8',
                pointBorderColor: '#0f172a',
                pointBorderWidth: 1,
                fill: false,
                tension: 0.25
              },
              {
                label: 'Run-off EC',
                data: ecDrainValues,
                borderColor: '#34d399',
                backgroundColor: 'rgba(52, 211, 153, 0.15)',
                borderWidth: 2,
                pointRadius: 2.5,
                pointHoverRadius: 4.5,
                pointBackgroundColor: '#34d399',
                pointBorderColor: '#0f172a',
                pointBorderWidth: 1,
                fill: true,
                tension: 0.25
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                titleColor: '#ffffff',
                bodyColor: '#e2e8f0',
                borderColor: 'rgba(52, 211, 153, 0.5)',
                borderWidth: 1,
                padding: 7,
                callbacks: {
                  title: (items) => {
                    if (!items || items.length === 0) return '';
                    const idx = items[0].dataIndex;
                    const pt = chartDataPoints[idx];
                    return `${pt.date} at ${pt.time}`;
                  },
                  label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} EC`
                }
              }
            },
            scales: {
              x: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: '#94a3b8', font: { size: 9, family: 'monospace' } }
              },
              y: {
                suggestedMin: 0,
                suggestedMax: 3.5,
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: {
                  color: '#34d399',
                  font: { size: 9, family: 'monospace' },
                  callback: (v) => `${v} EC`
                }
              }
            }
          }
        });
      }

      // 2. pH Chart
      const phEl = document.getElementById(`drainage-ph-chart-${plotId}`);
      if (phEl) {
        const existing = Chart.getChart(phEl);
        if (existing) existing.destroy();

        const ctx = phEl.getContext('2d');
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Run-off pH',
                data: phValues,
                borderColor: '#fbbf24',
                backgroundColor: 'rgba(251, 191, 36, 0.12)',
                borderWidth: 2,
                pointRadius: 2.5,
                pointHoverRadius: 4.5,
                pointBackgroundColor: '#fbbf24',
                pointBorderColor: '#0f172a',
                pointBorderWidth: 1,
                fill: true,
                tension: 0.25
              },
              {
                label: 'Target (5.5-6.3)',
                data: labels.map(() => 6.0),
                borderColor: '#34d399',
                borderDash: [2, 4],
                borderWidth: 1,
                pointRadius: 0,
                fill: false
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                titleColor: '#ffffff',
                bodyColor: '#e2e8f0',
                borderColor: 'rgba(251, 191, 36, 0.5)',
                borderWidth: 1,
                padding: 7,
                callbacks: {
                  title: (items) => {
                    if (!items || items.length === 0) return '';
                    const idx = items[0].dataIndex;
                    const pt = chartDataPoints[idx];
                    return `${pt.date} at ${pt.time}`;
                  },
                  label: (ctx) => `${ctx.dataset.label}: pH ${ctx.parsed.y.toFixed(1)}`
                }
              }
            },
            scales: {
              x: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: { color: '#94a3b8', font: { size: 9, family: 'monospace' } }
              },
              y: {
                suggestedMin: 3.0,
                suggestedMax: 8.0,
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: {
                  color: '#fbbf24',
                  font: { size: 9, family: 'monospace' },
                  callback: (v) => `pH ${v}`
                }
              }
            }
          }
        });
      }
    });
  }

  /**
   * Render Full Detail Sheet List inside the Mobile-Optimized Records Modal
   */
  renderDetailedRecordsList(plotFilter = 'all') {
    const container = document.getElementById('drainage-records-container');
    const countBadge = document.getElementById('drainage-records-count-badge');
    if (!container) return;

    const allRecords = [...this.records].sort((a, b) => this.compareRecordDate(b, a));
    if (countBadge) countBadge.innerText = `${allRecords.length} Logged`;

    if (allRecords.length === 0) {
      container.innerHTML = `
        <div class="empty-records-box">
          <i data-lucide="inbox" style="width:32px;height:32px;color:#94a3b8;margin-bottom:0.5rem;"></i>
          <p>No drainage records logged yet.</p>
          <button class="btn-primary" id="btn-empty-log-first" style="margin-top:0.75rem;">
            <i data-lucide="plus"></i> Log First Reading
          </button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    let cardsHtml = '';
    allRecords.forEach((entry, idx) => {
      const summaryP1 = this.calcPlotSummary(entry, 'plot-1');
      const summaryP2a = this.calcPlotSummary(entry, 'plot-2a');
      const summaryP2b = this.calcPlotSummary(entry, 'plot-2b');

      const isPlot1Active = (plotFilter === 'plot-1' || plotFilter === 'all');
      const isPlot2aActive = (plotFilter === 'plot-2a' || plotFilter === 'all');
      const isPlot2bActive = (plotFilter === 'plot-2b' || plotFilter === 'all');

      let plotSectionsHtml = '';

      // Plot 1 Section
      if (isPlot1Active && summaryP1) {
        const deltaStr = summaryP1.ecDelta !== null 
          ? (summaryP1.ecDelta > 0 ? `+${summaryP1.ecDelta.toFixed(1)}` : `${summaryP1.ecDelta.toFixed(1)}`) 
          : '--';
        const avgPhStr = summaryP1.avgDrainagePh !== null ? summaryP1.avgDrainagePh.toFixed(1) : '--';
        const ecInStr = summaryP1.ecIn !== null ? Number(summaryP1.ecIn).toFixed(1) : '--';
        const phInStr = summaryP1.phIn !== null ? Number(summaryP1.phIn).toFixed(1) : '--';
        const fertP1 = summaryP1.fertilizer || 'Water';

        plotSectionsHtml += `
          <div class="rec-plot-list-block block-p1" style="margin-top:0.5rem;">
            <div class="rec-plot-list-header">
              <div class="plot-tag-left">
                <span class="plot-color-indicator dot-p1"></span>
                <strong>Plot 1</strong>
                <span class="font-mono" style="font-size:0.68rem; color:#94a3b8; margin-left:0.4rem;">${fertP1} &bull; In: ${ecInStr} EC &bull; pH ${phInStr}</span>
              </div>
              <div class="plot-eval-pills-right">
                <span class="rec-eval-pill ${summaryP1.ecEval.badgeClass}">&Delta;EC ${deltaStr} (${summaryP1.ecEval.tag})</span>
                <span class="rec-eval-pill ${summaryP1.avgPhEval.badgeClass}">pH ${avgPhStr} (${summaryP1.avgPhEval.tag})</span>
              </div>
            </div>
            <div class="rec-station-list-table">
              ${summaryP1.stations.map(st => {
                const ecVal = st.ec !== null ? st.ec.toFixed(1) : '--';
                const phVal = st.ph !== null ? st.ph.toFixed(1) : '--';
                const ev = st.phEval || { status: 'safe', dotClass: 'dot-emerald', shortTag: 'Sweet Spot', badgeClass: 'pill-neutral' };
                return `
                  <div class="rec-station-list-row ${ev.status === 'safe' ? 'row-safe' : 'row-warn'}">
                    <div class="st-item-name">
                      <span class="st-dot ${ev.dotClass}"></span>
                      <span>${st.name.replace('Station ', 'St ')}</span>
                    </div>
                    <div class="st-item-metrics font-mono">
                      <span class="metric-ec"><strong>${ecVal}</strong> <small>EC</small></span>
                      <span class="metric-ph ${ev.status === 'safe' ? 'text-emerald' : 'text-amber'}">pH <strong>${phVal}</strong></span>
                      <span class="metric-diag-pill ${ev.badgeClass}">${ev.shortTag}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }

      // Plot 2A Section
      if (isPlot2aActive && summaryP2a) {
        const deltaStr = summaryP2a.ecDelta !== null 
          ? (summaryP2a.ecDelta > 0 ? `+${summaryP2a.ecDelta.toFixed(1)}` : `${summaryP2a.ecDelta.toFixed(1)}`) 
          : '--';
        const avgPhStr = summaryP2a.avgDrainagePh !== null ? summaryP2a.avgDrainagePh.toFixed(1) : '--';
        const ecInStr = summaryP2a.ecIn !== null ? Number(summaryP2a.ecIn).toFixed(1) : '--';
        const phInStr = summaryP2a.phIn !== null ? Number(summaryP2a.phIn).toFixed(1) : '--';
        const fertP2a = summaryP2a.fertilizer || 'Water';

        plotSectionsHtml += `
          <div class="rec-plot-list-block block-p2" style="margin-top:0.5rem;">
            <div class="rec-plot-list-header">
              <div class="plot-tag-left">
                <span class="plot-color-indicator dot-p2"></span>
                <strong>Plot 2A</strong>
                <span class="font-mono" style="font-size:0.68rem; color:#94a3b8; margin-left:0.4rem;">${fertP2a} &bull; In: ${ecInStr} EC &bull; pH ${phInStr}</span>
              </div>
              <div class="plot-eval-pills-right">
                <span class="rec-eval-pill ${summaryP2a.ecEval.badgeClass}">&Delta;EC ${deltaStr} (${summaryP2a.ecEval.tag})</span>
                <span class="rec-eval-pill ${summaryP2a.avgPhEval.badgeClass}">pH ${avgPhStr} (${summaryP2a.avgPhEval.tag})</span>
              </div>
            </div>
            <div class="rec-station-list-table">
              ${summaryP2a.stations.map(st => {
                const ecVal = st.ec !== null ? st.ec.toFixed(1) : '--';
                const phVal = st.ph !== null ? st.ph.toFixed(1) : '--';
                const ev = st.phEval || { status: 'safe', dotClass: 'dot-emerald', shortTag: 'Sweet Spot', badgeClass: 'pill-neutral' };
                return `
                  <div class="rec-station-list-row ${ev.status === 'safe' ? 'row-safe' : 'row-warn'}">
                    <div class="st-item-name">
                      <span class="st-dot ${ev.dotClass}"></span>
                      <span>${st.name.replace('Station ', 'St ')}</span>
                    </div>
                    <div class="st-item-metrics font-mono">
                      <span class="metric-ec"><strong>${ecVal}</strong> <small>EC</small></span>
                      <span class="metric-ph ${ev.status === 'safe' ? 'text-emerald' : 'text-amber'}">pH <strong>${phVal}</strong></span>
                      <span class="metric-diag-pill ${ev.badgeClass}">${ev.shortTag}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }

      // Plot 2B Section
      if (isPlot2bActive && summaryP2b) {
        const deltaStr = summaryP2b.ecDelta !== null 
          ? (summaryP2b.ecDelta > 0 ? `+${summaryP2b.ecDelta.toFixed(1)}` : `${summaryP2b.ecDelta.toFixed(1)}`) 
          : '--';
        const avgPhStr = summaryP2b.avgDrainagePh !== null ? summaryP2b.avgDrainagePh.toFixed(1) : '--';
        const ecInStr = summaryP2b.ecIn !== null ? Number(summaryP2b.ecIn).toFixed(1) : '--';
        const phInStr = summaryP2b.phIn !== null ? Number(summaryP2b.phIn).toFixed(1) : '--';
        const fertP2b = summaryP2b.fertilizer || 'Water';

        plotSectionsHtml += `
          <div class="rec-plot-list-block" style="border-left-color:#818cf8; margin-top:0.5rem;">
            <div class="rec-plot-list-header">
              <div class="plot-tag-left">
                <span class="plot-color-indicator" style="background:#818cf8;"></span>
                <strong>Plot 2B</strong>
                <span class="font-mono" style="font-size:0.68rem; color:#94a3b8; margin-left:0.4rem;">${fertP2b} &bull; In: ${ecInStr} EC &bull; pH ${phInStr}</span>
              </div>
              <div class="plot-eval-pills-right">
                <span class="rec-eval-pill ${summaryP2b.ecEval.badgeClass}">&Delta;EC ${deltaStr} (${summaryP2b.ecEval.tag})</span>
                <span class="rec-eval-pill ${summaryP2b.avgPhEval.badgeClass}">pH ${avgPhStr} (${summaryP2b.avgPhEval.tag})</span>
              </div>
            </div>
            <div class="rec-station-list-table">
              ${summaryP2b.stations.map(st => {
                const ecVal = st.ec !== null ? st.ec.toFixed(1) : '--';
                const phVal = st.ph !== null ? st.ph.toFixed(1) : '--';
                const ev = st.phEval || { status: 'safe', dotClass: 'dot-emerald', shortTag: 'Sweet Spot', badgeClass: 'pill-neutral' };
                return `
                  <div class="rec-station-list-row ${ev.status === 'safe' ? 'row-safe' : 'row-warn'}">
                    <div class="st-item-name">
                      <span class="st-dot ${ev.dotClass}"></span>
                      <span>${st.name.replace('Station ', 'St ')}</span>
                    </div>
                    <div class="st-item-metrics font-mono">
                      <span class="metric-ec"><strong>${ecVal}</strong> <small>EC</small></span>
                      <span class="metric-ph ${ev.status === 'safe' ? 'text-emerald' : 'text-amber'}">pH <strong>${phVal}</strong></span>
                      <span class="metric-diag-pill ${ev.badgeClass}">${ev.shortTag}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }

      cardsHtml += `
        <div class="drainage-record-card compact-list-card ${idx === 0 ? 'card-latest' : ''}">
          <div class="record-card-top">
            <div class="record-datetime">
              <i data-lucide="calendar" style="width:13px;height:13px;color:#38bdf8;"></i>
              <strong>${entry.date}</strong>
              <span class="record-time-badge font-mono">${entry.time}</span>
            </div>
          </div>
          ${plotSectionsHtml}
        </div>
      `;
    });

    container.innerHTML = cardsHtml;
    if (window.lucide) window.lucide.createIcons();
  }
}

window.DrainageService = DrainageService;
window.drainageService = new DrainageService();

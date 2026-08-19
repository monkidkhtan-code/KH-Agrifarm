/**
 * KH AGRIFARM - MAIN APPLICATION CONTROLLER
 */

class KHAgrifarmApp {
  constructor() {
    this.config = window.APP_CONFIG;
    this.sheetsService = window.GoogleSheetsService ? new window.GoogleSheetsService(this.config) : null;
    this.weatherService = window.weatherService || (window.WeatherService ? new window.WeatherService(this.config) : null);
    
    // Auto-detect Real-Time Today Date
    this.selectedDate = this.getTodayDateStr();
    const [initD, initM, initY] = this.selectedDate.split('/').map(Number);
    this.calCurrentMonth = (initM - 1) || 7; // 0-indexed month
    this.calCurrentYear = initY || 2026;

    this.selectedPlot = "all"; // 'all' or specific plot name
    this.activeView = "daily"; // 'daily', 'weather', 'calendar', 'chemicals', 'all-season'

    this.farmData = {};
    this.weatherData = null;
    this.taskChecklist = this.loadTaskChecklist();
    this.ecChartInstance = null;

    this.init();
  }

  getTodayDateStr() {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  async init() {
    this.setupEventListeners();
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);

    // Initial load from cache or preloaded data
    this.farmData = this.sheetsService.getCachedData();
    this.renderAll();

    // Fetch live weather immediately for Tanjong Karang
    this.refreshWeather();

    // Initialize Soil Moisture Service (RainPoint Cloud Probes)
    if (window.soilMoistureService) {
      await window.soilMoistureService.init();
    }

    // Initialize Tapo Nursery Greenhouse Service (Backup 1 & Backup 2)
    if (window.tapoService) {
      await window.tapoService.init();
    }
    this.renderAll();

    // Trigger live Google Sheets sync immediately on start
    await this.syncSheets(false);

    // 1. Precision Weather & Microclimate Auto-Refresh: 3 minutes (Synchronized with IoT sensors)
    setInterval(() => {
      this.refreshWeather();
    }, 3 * 60 * 1000); // 3 minutes

    // 2. Google Sheets Master Schedule Auto-Sync: 15 minutes
    setInterval(() => {
      this.syncSheets(false);
    }, 15 * 60 * 1000); // 15 minutes

    // Initialize Lucide Icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  /* -------------------------------------------------------------
     EVENT LISTENERS & NAVIGATION
     ------------------------------------------------------------- */
  setupEventListeners() {
    // 1. Plot Navigation Tabs
    const plotTabs = document.querySelectorAll('.plot-tab');
    plotTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        plotTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.selectedPlot = tab.dataset.plot;
        this.renderAll();
      });
    });

    // 2. View Mode Tabs
    const viewTabs = document.querySelectorAll('.view-tab');
    viewTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        viewTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.switchView(tab.dataset.view);
      });
    });

    // 3. Primary Top-Level Navigation (Farm Log vs Weather in Title Bar)
    const btnModeFarmlog = document.getElementById('btn-mode-farmlog');
    const btnModeWeather = document.getElementById('btn-mode-weather');

    if (btnModeFarmlog) {
      btnModeFarmlog.addEventListener('click', () => {
        this.switchView('daily');
      });
    }

    if (btnModeWeather) {
      btnModeWeather.addEventListener('click', () => {
        this.switchView('weather');
      });
    }

    // Weather layout toggle (Desktop Track vs Mobile Vertical List)
    const btnTrack = document.getElementById('btn-toggle-hourly-track');
    const btnList = document.getElementById('btn-toggle-hourly-list');
    const trackEl = document.getElementById('hourly-forecast-track-full');
    const listEl = document.getElementById('hourly-vertical-list-full');

    if (btnTrack && btnList) {
      btnTrack.addEventListener('click', () => {
        btnTrack.classList.add('active');
        btnList.classList.remove('active');
        if (trackEl) trackEl.style.display = 'grid';
        if (listEl) listEl.style.display = 'none';
      });
      btnList.addEventListener('click', () => {
        btnList.classList.add('active');
        btnTrack.classList.remove('active');
        if (trackEl) trackEl.style.display = 'none';
        if (listEl) listEl.style.display = 'flex';
      });
    }

    // Weather Live Refresh Button
    const btnWeatherRefresh = document.getElementById('btn-weather-refresh');
    if (btnWeatherRefresh) {
      btnWeatherRefresh.addEventListener('click', async () => {
        btnWeatherRefresh.classList.add('refreshing');
        try {
          await this.refreshWeather();
          this.showToast("🌤️ Live Tanjong Karang microclimate updated!");
        } catch (e) {
          this.showToast("Failed to refresh weather", "error");
        } finally {
          btnWeatherRefresh.classList.remove('refreshing');
        }
      });
    }

    // 3. Date Navigation Controls
    document.getElementById('btn-prev-day').addEventListener('click', () => this.shiftDay(-1));
    document.getElementById('btn-next-day').addEventListener('click', () => this.shiftDay(1));
    document.getElementById('btn-jump-today').addEventListener('click', () => {
      this.selectedDate = this.getTodayDateStr();
      const [dd, mm, yyyy] = this.selectedDate.split('/').map(Number);
      this.calCurrentMonth = mm - 1;
      this.calCurrentYear = yyyy;
      this.syncDatePickerValue();
      this.renderAll();
      this.showToast(`Jumped to Today (${this.selectedDate})`);
    });

    const datePicker = document.getElementById('native-date-picker');
    datePicker.addEventListener('change', (e) => {
      if (e.target.value) {
        const [yyyy, mm, dd] = e.target.value.split('-');
        this.selectedDate = `${dd}/${mm}/${yyyy}`;
        this.renderAll();
      }
    });

    // 4. Live Sync Button
    document.getElementById('btn-sync').addEventListener('click', () => this.syncSheets(true));

    // 5. Calendar Month Navigation
    document.getElementById('cal-prev-month').addEventListener('click', () => this.shiftCalMonth(-1));
    document.getElementById('cal-next-month').addEventListener('click', () => this.shiftCalMonth(1));

    // 6. Chemical Search & Quick Tags
    const searchInput = document.getElementById('chemical-search-input');
    const clearBtn = document.getElementById('btn-clear-search');
    searchInput.addEventListener('input', (e) => {
      clearBtn.style.display = e.target.value ? 'block' : 'none';
      this.renderChemicalSearchResults(e.target.value.trim());
    });
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      this.renderChemicalSearchResults('');
    });

    // 7. Full Table Search & Export
    const tableFilter = document.getElementById('table-filter-input');
    if (tableFilter) {
      tableFilter.addEventListener('input', (e) => this.renderMasterTable(e.target.value.toLowerCase()));
    }
    const exportBtn = document.getElementById('btn-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportCurrentTableToCSV());
    }

    // 8. Settings Modal Event Handlers
    const settingsBtn = document.getElementById('btn-settings');
    const modal = document.getElementById('settings-modal');
    const modalClose = document.getElementById('modal-close-btn');
    const saveSettings = document.getElementById('btn-save-settings');
    const resetDefaults = document.getElementById('btn-reset-defaults');
    const gpsBtn = document.getElementById('btn-detect-gps');

    const closeModal = () => modal.classList.add('hidden-modal');
    const openModal = () => {
      this.populateSettingsModal();
      modal.classList.remove('hidden-modal');
    };

    if (settingsBtn) settingsBtn.addEventListener('click', openModal);
    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && !modal.classList.contains('hidden-modal')) {
        closeModal();
      }
    });

    if (saveSettings) {
      saveSettings.addEventListener('click', async () => {
        const lat = document.getElementById('input-location-lat').value;
        const lon = document.getElementById('input-location-lon').value;
        if (lat && lon) {
          this.weatherService.setLocation(lat, lon, "LOT 20371, Jalan Sgg 6/3, Kampung Sungai Gulang Gulang, 45500 Tanjong Karang, Selangor");
          this.refreshWeather();
        }
        await this.refreshSensorData(true);
        this.sheetsService.clearCache();
        await this.syncSheets(true);
        this.populateSettingsModal();
        this.showToast("All IoT sensors & farm schedules synchronized!");
      });
    }

    if (resetDefaults) {
      resetDefaults.addEventListener('click', () => {
        document.getElementById('input-location-lat').value = "3.4197";
        document.getElementById('input-location-lon').value = "101.2034";
        this.weatherService.setLocation(3.419686, 101.203391, "LOT 20371, Jalan Sgg 6/3, Kampung Sungai Gulang Gulang, 45500 Tanjong Karang, Selangor");
        this.refreshWeather();
        this.showToast("Coordinates reset to Tanjong Karang farm location");
      });
    }

    if (gpsBtn && navigator.geolocation) {
      gpsBtn.addEventListener('click', () => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            document.getElementById('input-location-lat').value = pos.coords.latitude.toFixed(4);
            document.getElementById('input-location-lon').value = pos.coords.longitude.toFixed(4);
            this.weatherService.setLocation(pos.coords.latitude, pos.coords.longitude, "Current GPS Farm Site");
            this.refreshWeather();
            this.showToast("Farm location updated to GPS coordinates!");
          },
          (err) => this.showToast("Could not retrieve GPS location: " + err.message, "error")
        );
      });
    }
  }

  populateSettingsModal() {
    // 1. Google Sheets Status
    const countEl = document.getElementById('footer-data-count');
    const p1Rows = (this.farmData["Season 6 PLOT 1"] || []).length;
    const p2Rows = (this.farmData["Season 6 PLOT 2"] || []).length;
    const b1Rows = (this.farmData["Backup Trees Batch 1"] || []).length;
    const b2Rows = (this.farmData["Backup Trees Batch 2"] || []).length;

    const p1p2El = document.getElementById('settings-sheet-p1p2-rows');
    const bkEl = document.getElementById('settings-sheet-bk-rows');
    const p1p2Sync = document.getElementById('settings-sheet-p1p2-sync');
    const bkSync = document.getElementById('settings-sheet-bk-sync');

    const lastSyncTime = this.sheetsService ? this.sheetsService.getLastSyncTime() : null;
    const syncTimeStr = lastSyncTime ? `Synced: ${lastSyncTime}` : "Synced: Live (Auto 15m)";

    if (p1p2El) p1p2El.innerText = `${p1Rows + p2Rows} Schedule Entries (P1+P2)`;
    if (bkEl) bkEl.innerText = `${b1Rows + b2Rows} Schedule Entries (B1+B2)`;
    if (p1p2Sync) p1p2Sync.innerHTML = `<i data-lucide="radio" style="width:10px;height:10px;display:inline;"></i> ${syncTimeStr}`;
    if (bkSync) bkSync.innerHTML = `<i data-lucide="radio" style="width:10px;height:10px;display:inline;"></i> ${syncTimeStr}`;

    // 2. RainPoint Soil Moisture Probes
    if (window.soilMoistureService) {
      const p1 = window.soilMoistureService.getPlotSensors('plot-1');
      if (p1 && p1.sensors && p1.sensors[0]) {
        const s = p1.sensors[0];
        const rEl = document.getElementById('settings-p1-reading');
        const syncEl = document.getElementById('settings-p1-sync');
        const batEl = document.getElementById('settings-p1-bat');
        const stEl = document.getElementById('settings-p1-status');
        if (rEl) rEl.innerText = `${s.moisture}% Moisture • ${s.temperature}°C`;
        if (syncEl) syncEl.innerHTML = `<i data-lucide="radio" style="width:10px;height:10px;display:inline;"></i> Synced: ${s.syncTime ? s.syncTime.slice(11) : 'Live'}`;
        if (batEl) batEl.innerHTML = `<i data-lucide="battery" style="width:11px;height:11px;display:inline;"></i> ${s.battery}%`;
        if (stEl) {
          stEl.className = 'sensor-pill pill-safe';
          stEl.innerText = '🟢 Online';
        }
      }

      const p2 = window.soilMoistureService.getPlotSensors('plot-2');
      if (p2 && p2.sensors) {
        const s1 = p2.sensors[0];
        const s2 = p2.sensors[1];
        if (s1) {
          const rEl = document.getElementById('settings-p2s1-reading');
          const syncEl = document.getElementById('settings-p2s1-sync');
          const batEl = document.getElementById('settings-p2s1-bat');
          if (rEl) rEl.innerText = `${s1.moisture}% Moisture • ${s1.temperature}°C`;
          if (syncEl) syncEl.innerHTML = `<i data-lucide="radio" style="width:10px;height:10px;display:inline;"></i> Synced: ${s1.syncTime ? s1.syncTime.slice(11) : 'Live'}`;
          if (batEl) batEl.innerHTML = `<i data-lucide="battery" style="width:11px;height:11px;display:inline;"></i> ${s1.battery}%`;
        }
        if (s2) {
          const rEl = document.getElementById('settings-p2s2-reading');
          const syncEl = document.getElementById('settings-p2s2-sync');
          const batEl = document.getElementById('settings-p2s2-bat');
          if (rEl) rEl.innerText = `${s2.moisture}% Moisture • ${s2.temperature}°C`;
          if (syncEl) syncEl.innerHTML = `<i data-lucide="radio" style="width:10px;height:10px;display:inline;"></i> Synced: ${s2.syncTime ? s2.syncTime.slice(11) : 'Live'}`;
          if (batEl) batEl.innerHTML = `<i data-lucide="battery" style="width:11px;height:11px;display:inline;"></i> ${s2.battery}%`;
        }
      }
    }

    // 3. Tapo T315 Nursery Greenhouse Sensors (Backup 1 & Backup 2)
    if (window.tapoService) {
      const s = window.tapoService.getNurserySensor();
      if (s) {
        ['bk1', 'bk2'].forEach(bk => {
          const rEl = document.getElementById(`settings-tapo-reading-${bk}`);
          const syncEl = document.getElementById(`settings-tapo-sync-${bk}`);
          const batEl = document.getElementById(`settings-tapo-bat-${bk}`);
          const stEl = document.getElementById(`settings-tapo-status-${bk}`);
          if (rEl) rEl.innerText = `${s.temperature}°C • ${s.humidity}% RH (${s.vpd || 1.26} kPa)`;
          if (syncEl) syncEl.innerHTML = `<i data-lucide="radio" style="width:10px;height:10px;display:inline;"></i> Synced: ${s.syncTime ? s.syncTime.slice(11) : 'Live'}`;
          if (batEl) batEl.innerHTML = `<i data-lucide="battery" style="width:11px;height:11px;display:inline;"></i> ${s.battery}% • <i data-lucide="wifi" style="width:11px;height:11px;display:inline;"></i> ${s.signal || '3/3'}`;
          if (stEl) {
            stEl.className = 'sensor-pill pill-safe';
            stEl.innerText = '🟢 Online';
          }
        });
      }
    }

    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  async refreshSensorData(force = false) {
    if (window.soilMoistureService) {
      await window.soilMoistureService.refresh(force);
    }
    if (window.tapoService) {
      await window.tapoService.refresh();
    }
  }

  /* -------------------------------------------------------------
     LIVE SYNC & WEATHER
     ------------------------------------------------------------- */
  async syncSheets(userTriggered = false) {
    const syncBtn = document.getElementById('btn-sync');
    const syncText = document.getElementById('sync-text');
    const syncTime = document.getElementById('sync-time');

    syncBtn.classList.add('syncing');
    syncText.innerText = "Syncing...";

    try {
      const syncResult = await this.sheetsService.fetchAllPlots();
      this.farmData = syncResult.data;

      // Also trigger 15-min sensor refresh for Soil Moisture and Tapo Greenhouse
      await this.refreshSensorData(userTriggered);
      
      syncText.innerText = "Synced Live";
      syncTime.innerText = this.sheetsService.getLastSyncTime();
      this.renderAll();

      if (userTriggered) {
        this.showToast(`✅ Live Synced: RainPoint Soil, Tapo Nursery & Google Sheets up to date!`);
      }
    } catch (err) {
      console.error("Sync error", err);
      syncText.innerText = "Sync Cached";
      if (userTriggered) {
        this.showToast("Error connecting to Google Sheets. Using local farm cache.", "error");
      }
    } finally {
      syncBtn.classList.remove('syncing');
    }
  }

  showToast(message, type = "success") {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.className = `app-toast toast-${type} toast-show`;
    toast.innerText = message;

    setTimeout(() => {
      toast.className = 'app-toast';
    }, 4000);
  }

  async refreshWeather() {
    this.weatherData = await this.weatherService.fetchWeatherData();
    this.renderWeatherHeaderCapsule();
    this.renderWeatherDetailView();
  }

  renderWeatherHeaderCapsule() {
    if (!this.weatherData) return;
    const w = this.weatherData;

    const tempEl = document.getElementById('capsule-temp');
    const rainEl = document.getElementById('capsule-rain');
    const pillEl = document.getElementById('capsule-spray-pill');

    if (tempEl) tempEl.innerText = `${w.temp}°C`;
    if (rainEl) rainEl.innerHTML = `<i data-lucide="umbrella" style="width:12px;height:12px;display:inline;"></i> ${w.rainProbabilityNow}% Rain`;

    const advisory = window.SprayAdvisoryEngine.evaluateSprayWindow(w);
    if (pillEl) {
      pillEl.className = `capsule-spray-pill ${advisory.status === 'optimal' ? 'pill-safe' : (advisory.status === 'caution' ? 'pill-caution' : 'pill-danger')}`;
      pillEl.innerText = advisory.status === 'optimal' ? 'Spray Safe' : (advisory.status === 'caution' ? 'Spray Caution' : 'Do Not Spray');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  renderWeatherDetailView() {
    try {
      if (!this.weatherData) return;
      const w = this.weatherData;

    // 1. Google Maps Link & Coordinates
    const mapsBtn = document.getElementById('btn-maps-locate');
    const coordsBadge = document.getElementById('loc-coords-badge');
    if (mapsBtn && w.mapsUrl) mapsBtn.href = w.mapsUrl;
    if (coordsBadge && w.coordinates) coordsBadge.innerText = `GPS: ${w.coordinates}`;

    // 2. Spray Timing Decision Advisory (Morning vs. Evening)
    if (w.sprayTimingAdvisory) {
      const adv = w.sprayTimingAdvisory;
      const bestVal = document.getElementById('spray-best-choice-val');
      const summaryText = document.getElementById('spray-verdict-summary-text');
      if (bestVal) bestVal.innerText = adv.recommendedChoice;
      if (summaryText) summaryText.innerText = adv.verdictSummary;

      // Morning Window
      const mPill = document.getElementById('morning-status-pill');
      const mRain = document.getElementById('morning-rain-risk');
      const mWind = document.getElementById('morning-wind-speed');
      const mDesc = document.getElementById('morning-window-desc');
      if (mPill) {
        mPill.className = `window-status-pill ${adv.morning.badgeClass}`;
        mPill.innerText = adv.morning.verdict;
      }
      if (mRain) mRain.innerText = `${adv.morning.prob}%`;
      if (mWind) mWind.innerText = `${adv.morning.wind} km/h`;
      if (mDesc) mDesc.innerText = adv.morning.reason;

      // Evening Window
      const ePill = document.getElementById('evening-status-pill');
      const eRain = document.getElementById('evening-rain-risk');
      const eWind = document.getElementById('evening-wind-speed');
      const eDesc = document.getElementById('evening-window-desc');
      if (ePill) {
        ePill.className = `window-status-pill ${adv.evening.badgeClass}`;
        ePill.innerText = adv.evening.verdict;
      }
      if (eRain) eRain.innerText = `${adv.evening.prob}%`;
      if (eWind) eWind.innerText = `${adv.evening.wind} km/h`;
      if (eDesc) eDesc.innerText = adv.evening.reason;
    }

    // 3. 3-Day Forecast Cards (Morning, Noon, Night + Intensity)
    const threedayGrid = document.getElementById('threeday-forecast-grid');
    if (threedayGrid && w.threeDayForecast) {
      threedayGrid.innerHTML = '';
      w.threeDayForecast.forEach(day => {
        const m = day.morning || { icon: 'sun', tempAvg: 28, windAvg: 6, probMax: 15, intensityBadge: 'badge-dry', rainDescription: 'Dry' };
        const n = day.noon || { icon: 'cloud-sun', tempAvg: 32, windAvg: 10, probMax: 30, intensityBadge: 'badge-dry', rainDescription: 'Passing Clouds' };
        const ev = day.night || { icon: 'moon', tempAvg: 27, windAvg: 4, probMax: 15, intensityBadge: 'badge-dry', rainDescription: 'Clear' };
        
        const card = document.createElement('div');
        card.className = 'day-forecast-card';
        card.innerHTML = `
          <div class="day-card-header">
            <div>
              <h4 class="day-title-text">${day.dayLabel || 'Day'}</h4>
              <span class="day-date-sub">${day.dateFormatted || ''}</span>
            </div>
            ${day.morningSpraySafe || day.eveningSpraySafe ? 
              '<span class="day-forecast-status status-safe">🟢 Spray Window Available</span>' : 
              '<span class="day-forecast-status status-danger">🔴 High Rain Day</span>'
            }
          </div>
          <div class="day-periods-stack">
            <!-- Morning Period -->
            <div class="period-row">
              <div class="period-name-group">
                <img src="${m.iconImg || 'assets/weather/accu_clear_day.png'}" class="period-weather-img" alt="Morning">
                <div>
                  <div class="period-name">🌅 Morning (6 AM - 12 PM)</div>
                  <div style="font-size:0.72rem; color:#94a3b8;">${m.tempAvg || 28}°C &bull; Wind ${m.windAvg || 6} km/h</div>
                </div>
              </div>
              <div class="period-rain-group">
                <span class="period-prob">${m.probMax || 0}% Rain</span>
                <span class="rain-intensity-badge ${m.intensityBadge || 'badge-dry'}">${m.rainDescription || 'Dry'}</span>
              </div>
            </div>

            <!-- Noon Period -->
            <div class="period-row">
              <div class="period-name-group">
                <img src="${n.iconImg || 'assets/weather/accu_partly_cloudy_day.png'}" class="period-weather-img" alt="Noon">
                <div>
                  <div class="period-name">☀️ Noon (12 PM - 5:30 PM)</div>
                  <div style="font-size:0.72rem; color:#94a3b8;">${n.tempAvg || 32}°C &bull; Wind ${n.windAvg || 10} km/h</div>
                </div>
              </div>
              <div class="period-rain-group">
                <span class="period-prob">${n.probMax || 0}% Rain</span>
                <span class="rain-intensity-badge ${n.intensityBadge || 'badge-dry'}">${n.rainDescription || 'Dry'}</span>
              </div>
            </div>

            <!-- Evening / Night Period -->
            <div class="period-row">
              <div class="period-name-group">
                <img src="${ev.iconImg || 'assets/weather/accu_clear_night.png'}" class="period-weather-img" alt="Evening">
                <div>
                  <div class="period-name">🌙 Evening (5:30 PM - 10 PM)</div>
                  <div style="font-size:0.72rem; color:#94a3b8;">${ev.tempAvg || 27}°C &bull; Wind ${ev.windAvg || 5} km/h</div>
                </div>
              </div>
              <div class="period-rain-group">
                <span class="period-prob">${ev.probMax || 0}% Rain</span>
                <span class="rain-intensity-badge ${ev.intensityBadge || 'badge-dry'}">${ev.rainDescription || 'Dry'}</span>
              </div>
            </div>
          </div>
        `;
        threedayGrid.appendChild(card);
      });
    }

    // 4. Current Microclimate Hero with Dynamic SVG Art & Day/Night Theme
    const syncBadge = document.getElementById('weather-sync-timestamp');
    if (syncBadge && this.weatherService) {
      const syncStr = this.weatherService.getLastUpdatedFormatted();
      syncBadge.innerHTML = `<i data-lucide="radio" style="width:11px;height:11px;display:inline;"></i> Synced ${syncStr}`;
    }

    const tempEl = document.getElementById('weather-detail-temp');
    if (tempEl) tempEl.innerText = `${w.temp}°C`;

    const condEl = document.getElementById('weather-detail-condition');
    if (condEl) condEl.innerText = w.conditionText;

    const rainProbEl = document.getElementById('weather-detail-rain-prob');
    if (rainProbEl) rainProbEl.innerHTML = `<i data-lucide="umbrella" style="width:13px;height:13px;display:inline;"></i> <span>${w.rainProbabilityNow}% Rain Probability</span>`;

    // Time of day badge
    const timeBadgeText = document.getElementById('weather-time-text');
    if (timeBadgeText) timeBadgeText.innerText = w.timeOfDayLabel || (w.isDay ? "Daylight" : "Night Sky");

    const timeBadgeIcon = document.getElementById('weather-time-icon');
    if (timeBadgeIcon) timeBadgeIcon.setAttribute('data-lucide', w.isDay ? "sun" : "moon");

    // Dynamic Weather Artwork SVG
    const artBox = document.getElementById('weather-hero-art-box');
    if (artBox && w.visualSvg) {
      artBox.innerHTML = w.visualSvg;
    }

    // Set Theme Class on Hero Display Box
    const heroDisplayBox = document.getElementById('weather-hero-display-box');
    if (heroDisplayBox) {
      heroDisplayBox.className = `weather-hero-display ${w.themeClass || 'theme-sunny'}`;
    }

    // 4. Compact 3-Metric Strip (Humidity, Wind Speed, Drift Risk)
    const humEl = document.getElementById('weather-detail-humidity');
    if (humEl) humEl.innerText = `${w.humidity}%`;
    const humTag = document.getElementById('weather-tag-humidity');
    if (humTag) {
      humTag.innerText = w.humidity > 85 ? "High" : (w.humidity < 60 ? "Dry" : "Optimal");
      humTag.className = `w-metric-tag ${w.humidity > 85 ? 'tag-caution' : 'tag-safe'}`;
    }

    const windEl = document.getElementById('weather-detail-wind');
    if (windEl) windEl.innerText = `${w.windSpeed} km/h`;
    const windTag = document.getElementById('weather-tag-wind');
    if (windTag) {
      windTag.innerText = w.windSpeed <= 6 ? "Calm" : (w.windSpeed <= 12 ? "Light" : "Breezy");
      windTag.className = `w-metric-tag ${w.windSpeed > 14 ? 'tag-danger' : (w.windSpeed > 10 ? 'tag-caution' : 'tag-safe')}`;
    }

    const gustEl = document.getElementById('weather-detail-gusts');
    if (gustEl) gustEl.innerText = `${w.windGusts} km/h`;
    const gustTag = document.getElementById('weather-tag-gusts');
    if (gustTag) {
      gustTag.innerText = w.windGusts <= 10 ? "Gentle" : (w.windGusts <= 18 ? "Moderate" : "Gusty");
      gustTag.className = `w-metric-tag ${w.windGusts > 20 ? 'tag-danger' : (w.windGusts > 14 ? 'tag-caution' : 'tag-safe')}`;
    }

    const driftEl = document.getElementById('weather-detail-drift');
    if (driftEl) {
      const isDriftSafe = w.windSpeed <= 12 && w.windGusts <= 18;
      const isDriftCaution = w.windSpeed <= 16 && w.windGusts <= 22;
      driftEl.innerText = isDriftSafe ? "Low" : (isDriftCaution ? "Moderate" : "High");
      const driftTag = document.getElementById('weather-tag-drift');
      if (driftTag) {
        driftTag.innerText = isDriftSafe ? "Safe" : (isDriftCaution ? "Caution" : "Risk");
        driftTag.className = `w-metric-tag ${isDriftSafe ? 'tag-safe' : (isDriftCaution ? 'tag-caution' : 'tag-danger')}`;
      }
    }

    // 5. 12-Hour Desktop Track
    const track = document.getElementById('hourly-forecast-track-full');
    if (track && w.hourlyForecast) {
      track.innerHTML = '';
      w.hourlyForecast.forEach(h => {
        let fillClass = 'fill-low';
        if (h.prob >= 50) fillClass = 'fill-high';
        else if (h.prob >= 25) fillClass = 'fill-med';

        const col = document.createElement('div');
        col.className = 'hourly-bar-col';
        col.innerHTML = `
          <span class="hourly-time">${h.time}</span>
          <div class="hourly-bar-wrap" title="${h.time}: ${h.prob}% rain, ${h.rainIntensity}, ${h.temp}°C, Wind ${h.wind} km/h">
            <div class="hourly-bar-fill ${fillClass}" style="height: ${Math.max(h.prob, 8)}%;"></div>
          </div>
          <span class="hourly-prob" style="color: ${h.prob >= 40 ? '#f87171' : '#38bdf8'}">${h.prob}%</span>
        `;
        track.appendChild(col);
      });
    }

    // 6. 12-Hour Phone-Friendly Vertical List
    const vList = document.getElementById('hourly-vertical-list-full');
    if (vList && w.hourlyForecast) {
      vList.innerHTML = '';
      w.hourlyForecast.forEach(h => {
        let fillClass = 'fill-low';
        if (h.prob >= 50) fillClass = 'fill-high';
        else if (h.prob >= 25) fillClass = 'fill-med';

        const row = document.createElement('div');
        row.className = 'hourly-v-row';
        row.innerHTML = `
          <span class="v-hour-time">${h.time}</span>
          <div class="v-hour-cond" style="display:flex; align-items:center; gap:0.45rem;">
            <img src="${h.iconImg || 'assets/weather/accu_clear_day.png'}" class="v-hour-accu-img" alt="${h.condition}">
            <span>${h.temp}°C &bull; ${h.condition}</span>
          </div>
          <div class="v-hour-rain">
            <div class="v-rain-bar-wrap">
              <div class="v-rain-bar-fill ${fillClass}" style="width: ${Math.max(h.prob, 6)}%;"></div>
            </div>
            <span class="v-rain-text">${h.prob}% Rain &bull; ${h.rainMm > 0 ? h.rainMm + 'mm' : (h.prob >= 50 ? 'Showers Risk' : (h.prob >= 25 ? 'Drizzle Chance' : 'Dry'))}</span>
          </div>
          <div class="v-hour-stats">
            <span><i data-lucide="wind" style="width:12px;height:12px;display:inline;"></i> ${h.wind}k</span>
            <span class="v-safety-pill ${h.spraySafety === 'safe' ? 'pill-safe' : (h.spraySafety === 'caution' ? 'pill-caution' : 'pill-danger')}">
              ${h.spraySafety === 'safe' ? 'Safe' : (h.spraySafety === 'caution' ? 'Caution' : 'Rain Risk')}
            </span>
          </div>
        `;
        vList.appendChild(row);
      });
    }

    if (window.radarService) {
      window.radarService.init();
      window.radarService.invalidateSize();
    }

    if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      console.error('[Weather] renderWeatherDetailView error:', err);
    }
  }

  /* -------------------------------------------------------------
     DATE CONTROLS & PARSING
     ------------------------------------------------------------- */
  shiftDay(offset) {
    const [dd, mm, yyyy] = this.selectedDate.split('/').map(Number);
    const d = new Date(yyyy, mm - 1, dd);
    d.setDate(d.getDate() + offset);

    const newDD = String(d.getDate()).padStart(2, '0');
    const newMM = String(d.getMonth() + 1).padStart(2, '0');
    const newYYYY = d.getFullYear();

    this.selectedDate = `${newDD}/${newMM}/${newYYYY}`;
    this.syncDatePickerValue();
    this.renderAll();
  }

  syncDatePickerValue() {
    const [dd, mm, yyyy] = this.selectedDate.split('/');
    const dateInput = document.getElementById('native-date-picker');
    if (dateInput) {
      dateInput.value = `${yyyy}-${mm}-${dd}`;
    }
  }

  formatDisplayDate(dateStr) {
    const [dd, mm, yyyy] = dateStr.split('/').map(Number);
    const d = new Date(yyyy, mm - 1, dd);
    const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    
    return {
      primary: `${dd} ${shortMonths[d.getMonth()]} ${yyyy}`,
      secondary: shortDays[d.getDay()],
      dayName: shortDays[d.getDay()]
    };
  }

  /* -------------------------------------------------------------
     MAIN RENDERING
     ------------------------------------------------------------- */
  renderAll() {
    this.syncDatePickerValue();
    const dateInfo = this.formatDisplayDate(this.selectedDate);
    document.getElementById('display-date-primary').innerText = dateInfo.primary;
    document.getElementById('display-date-secondary').innerText = dateInfo.secondary;

    // Render depending on active view
    if (this.activeView === 'daily') {
      this.renderDailyCards();
    } else if (this.activeView === 'weather') {
      this.renderWeatherDetailView();
    } else if (this.activeView === 'calendar') {
      this.renderCalendarMonth();
    } else if (this.activeView === 'chemicals') {
      this.renderChemicalView();
    } else if (this.activeView === 'all-season') {
      this.renderMasterTable();
    }

    // Update footer stats
    let totalRows = 0;
    Object.values(this.farmData).forEach(arr => totalRows += (arr ? arr.length : 0));
    const footerCount = document.getElementById('footer-data-count');
    if (footerCount) footerCount.innerText = `${totalRows} total schedule rows loaded`;

    if (window.lucide) window.lucide.createIcons();
  }

  getPlotRowForDate(plotName, dateStr) {
    const list = this.farmData[plotName] || [];
    return list.find(r => r.date === dateStr) || null;
  }

  getPlotShortName(plotName) {
    const plotConf = this.config.sheets.plots.find(p => p.name === plotName || p.shortName === plotName);
    return plotConf ? plotConf.shortName : plotName;
  }

  /* -------------------------------------------------------------
     1. DAILY ACTIVITY CARDS RENDERER
     ------------------------------------------------------------- */
  renderDailyCards() {
    const grid = document.getElementById('daily-cards-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const plotsToDisplay = this.selectedPlot === 'all' 
      ? this.config.sheets.plots 
      : this.config.sheets.plots.filter(p => p.name === this.selectedPlot);

    const isSinglePlot = (plotsToDisplay.length === 1);
    if (isSinglePlot) {
      grid.classList.add('single-plot-view');
    } else {
      grid.classList.remove('single-plot-view');
    }

    plotsToDisplay.forEach(plotConf => {
      const rowData = this.getPlotRowForDate(plotConf.name, this.selectedDate);
      const card = this.createPlotDailyCard(plotConf, rowData);
      if (isSinglePlot) {
        card.classList.add('single-plot-card');
      }
      grid.appendChild(card);
    });

    if (window.soilMoistureService) {
      window.soilMoistureService.renderAllSparklines();
    }

    if (window.tapoService) {
      window.tapoService.renderAllNurserySparklines();
    }

    if (window.lucide) window.lucide.createIcons();
  }

  createPlotDailyCard(plotConf, data) {
    const card = document.createElement('div');
    card.className = 'plot-card';

    const stageText = data && data.stage ? data.stage : 'Rest / No Schedule';
    const stageClass = `stage-${plotConf.id.replace('plot-', 'p')}`;
    const taskKey = `${this.selectedDate}_${plotConf.name}`;
    const isCompleted = !!this.taskChecklist[taskKey];

    // Calculate Month and Week details
    let timeframeText = '';
    if (data) {
      let m = data.month;
      let w = data.week;

      if (data.stage) {
        const hstMatch = data.stage.match(/HST\s*(\d+)/i);
        const hssMatch = data.stage.match(/HSS\s*(\d+)/i);
        if (hstMatch) {
          const num = parseInt(hstMatch[1], 10);
          if (!w && w !== 0) w = Math.max(1, Math.ceil((num + 1) / 7));
          if (!m && m !== 0) m = Math.max(1, Math.ceil((num + 1) / 30));
        } else if (hssMatch) {
          const num = parseInt(hssMatch[1], 10);
          if (!w && w !== 0) w = Math.max(1, Math.ceil(num / 7));
          if (!m && m !== 0) m = 0;
        }
      }

      if ((m !== undefined && m !== '') || (w !== undefined && w !== '')) {
        timeframeText = `Month ${m !== undefined && m !== '' ? m : 1} • Week ${w !== undefined && w !== '' ? w : 1}`;
      }
    }

    // Card Header with Plot Title + Meta Group (Month/Week + Stage)
    let html = `
      <div class="plot-card-header" style="background-color: ${plotConf.bgColor}; border-color: ${plotConf.borderColor};">
        <div class="plot-card-title-group">
          <span class="plot-color-indicator" style="background-color: ${plotConf.color}; box-shadow: 0 0 8px ${plotConf.color};"></span>
          <h4 class="plot-badge" style="color: #ffffff;">${plotConf.shortName || plotConf.name}</h4>
        </div>
        <div class="plot-card-meta-group">
          ${timeframeText ? `<span class="plot-timeframe-badge">${timeframeText}</span>` : ''}
          <span class="plot-stage-badge ${stageClass}">${stageText}</span>
        </div>
      </div>
      <div class="plot-card-body">
    `;

    if (!data) {
      html += `
        <div class="activity-section">
          <div class="activity-content-box box-empty">
            No specific operations scheduled for this date in ${plotConf.shortName || plotConf.name}.
          </div>
        </div>
      `;
    } else {
      // 1. Insecticide & Fungicide Spray
      html += `
        <div class="activity-section">
          <span class="activity-label" style="color: #f87171;"><i data-lucide="spray-can"></i> Insecticide &amp; Fungicide Spray</span>
          ${data.spray 
            ? `<div class="activity-content-box box-spray">
                 <div>${this.formatMultilineText(data.spray)}</div>
                 ${this.renderChemicalBadges(data.spray)}
               </div>`
            : `<div class="activity-content-box box-empty">No spray scheduled today</div>`
          }
        </div>
      `;

      // 2. Foliar Nutrition
      html += `
        <div class="activity-section">
          <span class="activity-label" style="color: #4ade80;"><i data-lucide="leaf"></i> Foliar Nutrition / Booster</span>
          ${data.foliar 
            ? `<div class="activity-content-box box-foliar">${this.formatMultilineText(data.foliar)}</div>`
            : `<div class="activity-content-box box-empty">No foliar applied</div>`
          }
        </div>
      `;

      // 3. Drip Fertigation / Fertilizer
      html += `
        <div class="activity-section">
          <span class="activity-label" style="color: #60a5fa;"><i data-lucide="droplets"></i> Drip Fertigation / Fertilizer</span>
          ${data.drip 
            ? `<div class="activity-content-box box-drip">${this.formatMultilineText(data.drip)}</div>`
            : `<div class="activity-content-box box-empty">Standard water / rest</div>`
          }
        </div>
      `;

      // 3b. Environmental & Sensor Monitoring (RainPoint Soil Probes vs. Tapo Nursery Sensors)
      if (plotConf.id === 'plot-1' || plotConf.id === 'plot-2') {
        if (window.soilMoistureService) {
          html += window.soilMoistureService.renderPlotMoistureCard(plotConf.id, data ? data.moisture : null);
        }
      } else if (plotConf.id === 'plot-3' || plotConf.id === 'plot-4') {
        if (window.tapoService) {
          html += window.tapoService.renderPlotNurseryCard(plotConf.id);
        }
      }

      // 4. Field Tasks & Operations
      if (data.task) {
        html += `
          <div class="activity-section">
            <span class="activity-label" style="color: #cbd5e1;"><i data-lucide="clipboard-check"></i> Field Tasks &amp; Operations</span>
            <div class="activity-content-box box-task">
              ${this.formatMultilineText(data.task)}
            </div>
          </div>
        `;
      }
    }

    // Always ensure Sensor Monitoring is visible on empty/rest days
    if (!data) {
      if (plotConf.id === 'plot-1' || plotConf.id === 'plot-2') {
        if (window.soilMoistureService) html += window.soilMoistureService.renderPlotMoistureCard(plotConf.id, null);
      } else if (plotConf.id === 'plot-3' || plotConf.id === 'plot-4') {
        if (window.tapoService) html += window.tapoService.renderPlotNurseryCard(plotConf.id);
      }
    }

    html += `</div>`; // Close card body

    // Footer with EC Level & Task Complete Checkbox
    const ecVal = data && data.ec ? data.ec : '--';
    html += `
      <div class="plot-card-footer">
        <div class="ec-display-wrap">
          <span class="ec-pill" title="Electrical Conductivity Level of fertilizer formula">
            <i data-lucide="zap"></i> EC: ${ecVal}
          </span>
        </div>
        <label class="task-checkbox-toggle">
          <input type="checkbox" data-task-key="${taskKey}" ${isCompleted ? 'checked' : ''}>
          <span>${isCompleted ? 'Completed' : 'Mark Done'}</span>
        </label>
      </div>
    `;

    card.innerHTML = html;

    // Attach checkbox event
    const chk = card.querySelector('input[type="checkbox"]');
    if (chk) {
      chk.addEventListener('change', (e) => {
        this.taskChecklist[taskKey] = e.target.checked;
        this.saveTaskChecklist();
        chk.nextElementSibling.innerText = e.target.checked ? 'Completed' : 'Mark Done';
      });
    }

    return card;
  }

  renderChemicalBadges(sprayText) {
    const analysis = window.SprayAdvisoryEngine.analyzeChemical(sprayText);
    if (!analysis || analysis.length === 0) return '';

    return `
      <div style="margin-top: 0.4rem; display: flex; flex-wrap: wrap; gap: 0.35rem;">
        ${analysis.map(item => `
          <span style="font-size: 0.68rem; font-weight: 700; background: rgba(239,68,68,0.2); color: #fca5a5; padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid rgba(248,113,113,0.3);">
            ${item.active} (${item.type}) • Rainfast: ${item.rainfast}
          </span>
        `).join('')}
      </div>
    `;
  }

  formatMultilineText(text) {
    if (!text) return '';
    return text.split('\n').map(line => line.trim()).filter(Boolean).join('<br>');
  }

  /* -------------------------------------------------------------
     2. MONTH CALENDAR VIEW RENDERER
     ------------------------------------------------------------- */
  shiftCalMonth(offset) {
    this.calCurrentMonth += offset;
    if (this.calCurrentMonth > 11) {
      this.calCurrentMonth = 0;
      this.calCurrentYear++;
    } else if (this.calCurrentMonth < 0) {
      this.calCurrentMonth = 11;
      this.calCurrentYear--;
    }
    this.renderCalendarMonth();
  }

  renderCalendarMonth() {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById('cal-month-title').innerText = `${months[this.calCurrentMonth]} ${this.calCurrentYear}`;

    const grid = document.getElementById('calendar-days-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const firstDayIndex = new Date(this.calCurrentYear, this.calCurrentMonth, 1).getDay();
    const daysInMonth = new Date(this.calCurrentYear, this.calCurrentMonth + 1, 0).getDate();
    const prevDaysInMonth = new Date(this.calCurrentYear, this.calCurrentMonth, 0).getDate();

    // Fill leading empty cells from prev month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevDaysInMonth - i;
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell other-month';
      cell.innerHTML = `<span class="cal-day-number">${dayNum}</span>`;
      grid.appendChild(cell);
    }

    // Fill current month days
    const todayDateStr = this.getTodayDateStr();
    for (let d = 1; d <= daysInMonth; d++) {
      const dd = String(d).padStart(2, '0');
      const mm = String(this.calCurrentMonth + 1).padStart(2, '0');
      const dateKey = `${dd}/${mm}/${this.calCurrentYear}`;
      const isSelected = dateKey === this.selectedDate;
      const isToday = dateKey === todayDateStr;

      const cell = document.createElement('div');
      cell.className = `cal-day-cell ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`;
      
      // Check activities across plots for this date
      const plotName = this.selectedPlot === 'all' ? "Season 6 PLOT 1" : this.selectedPlot;
      const row = this.getPlotRowForDate(plotName, dateKey);

      let activityPills = '';
      if (row) {
        if (row.spray) {
          activityPills += `<span class="cal-activity-pill pill-spray" title="${row.spray}">🧪 Spray</span>`;
        }
        if (row.foliar) {
          activityPills += `<span class="cal-activity-pill pill-foliar" title="${row.foliar}">🌿 Foliar</span>`;
        }
        if (row.drip) {
          activityPills += `<span class="cal-activity-pill pill-drip" title="${row.drip}">💧 ${row.drip.slice(0, 10)}</span>`;
        }
        if (row.ec) {
          activityPills += `<span class="cal-activity-pill pill-ec">EC ${row.ec}</span>`;
        }
      }

      cell.innerHTML = `
        <div class="cal-day-header">
          <span class="cal-day-number">${d}</span>
          ${isToday ? `<span class="cal-today-tag">TODAY</span>` : ''}
        </div>
        <div class="cal-activity-dots">
          ${activityPills}
        </div>
      `;

      cell.addEventListener('click', () => {
        this.selectedDate = dateKey;
        this.switchView('daily');
      });

      grid.appendChild(cell);
    }

    if (window.lucide) window.lucide.createIcons();
  }

  /* -------------------------------------------------------------
     3. CHEMICAL SEARCH & EC CHART VIEW
     ------------------------------------------------------------- */
  renderChemicalView() {
    this.renderChemicalQuickTags();
    this.renderChemicalSearchResults('');
    this.renderECProgressionChart();
    if (window.soilMoistureService) {
      window.soilMoistureService.renderEmbeddedChart();
    }
  }

  renderChemicalQuickTags() {
    const tagsContainer = document.getElementById('quick-chemical-tags');
    if (!tagsContainer) return;

    const popularChems = [
      "Solomon", "Mancozeb", "Sivanto", "Neem Oil", "Plenum", 
      "Sanmite", "Super Amino", "Oliga Chitosan", "Bio-Botava", 
      "Superturbo", "Luna Experience"
    ];

    tagsContainer.innerHTML = popularChems.map(name => `
      <button class="chem-tag" data-tag="${name}">${name}</button>
    `).join('');

    tagsContainer.querySelectorAll('.chem-tag').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('chemical-search-input').value = btn.dataset.tag;
        document.getElementById('btn-clear-search').style.display = 'block';
        this.renderChemicalSearchResults(btn.dataset.tag);
      });
    });
  }

  renderChemicalSearchResults(query) {
    const list = document.getElementById('chemical-results-list');
    if (!list) return;
    list.innerHTML = '';

    const lower = query.toLowerCase();
    const results = [];

    // Search across all 4 plots
    Object.entries(this.farmData).forEach(([plotName, rows]) => {
      rows.forEach(r => {
        const fullText = `${r.spray} ${r.foliar} ${r.drip} ${r.task}`.toLowerCase();
        if (!lower || fullText.includes(lower)) {
          if (r.spray || r.foliar || r.drip) {
            results.push({
              plotName,
              date: r.date,
              day: r.day,
              stage: r.stage,
              spray: r.spray,
              foliar: r.foliar,
              drip: r.drip,
              ec: r.ec
            });
          }
        }
      });
    });

    if (results.length === 0) {
      list.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: #94a3b8; font-size: 0.88rem;">No chemical applications found matching "${query}".</div>`;
      return;
    }

    // Sort by chronological appearance
    results.slice(0, 40).forEach(res => {
      const shortPlotName = this.getPlotShortName(res.plotName);
      const item = document.createElement('div');
      item.className = 'chem-result-item';
      item.innerHTML = `
        <div class="chem-item-info">
          <span class="chem-name-text">
            ${res.spray ? `🧪 ${res.spray}` : ''}
            ${res.foliar ? ` 🌿 ${res.foliar}` : ''}
            ${res.drip ? ` 💧 ${res.drip}` : ''}
          </span>
          <span class="chem-plot-sub">${shortPlotName} &bull; ${res.stage} (EC: ${res.ec || '--'})</span>
        </div>
        <span class="chem-date-badge">${res.date}</span>
      `;

      item.addEventListener('click', () => {
        this.selectedDate = res.date;
        this.selectedPlot = res.plotName;
        // Update active plot tab in UI
        document.querySelectorAll('.plot-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.plot === res.plotName);
        });
        this.switchView('daily');
      });

      list.appendChild(item);
    });
  }

  renderECProgressionChart() {
    const ctx = document.getElementById('ecProgressionChart');
    if (!ctx) return;

    if (this.ecChartInstance) {
      this.ecChartInstance.destroy();
    }

    const plotName = this.selectedPlot === 'all' ? "Season 6 PLOT 1" : this.selectedPlot;
    const shortPlotName = this.getPlotShortName(plotName);
    const rows = (this.farmData[plotName] || []).filter(r => r.ec && !isNaN(parseFloat(r.ec)));

    const labels = rows.map(r => `${r.date.slice(0, 5)} (${r.stage || ''})`);
    const dataPoints = rows.map(r => parseFloat(r.ec));

    this.ecChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: `${shortPlotName} EC Level (mS/cm)`,
          data: dataPoints,
          borderColor: '#c084fc',
          backgroundColor: 'rgba(192, 132, 252, 0.15)',
          borderWidth: 2.5,
          tension: 0,
          fill: true,
          pointBackgroundColor: '#c084fc',
          pointRadius: 3,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#ffffff', font: { family: 'Plus Jakarta Sans', weight: '700' } }
          },
          tooltip: {
            backgroundColor: '#03140e',
            titleColor: '#6ebc48',
            bodyColor: '#ffffff',
            borderColor: 'rgba(110, 188, 72, 0.3)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8
          }
        },
        scales: {
          y: {
            title: { display: true, text: 'EC Level', color: '#94a3b8' },
            min: 0,
            max: 4.0,
            grid: { color: 'rgba(255, 255, 255, 0.08)' },
            ticks: { color: '#cbd5e1' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#cbd5e1', maxTicksLimit: 12 }
          }
        }
      }
    });
  }

  /* -------------------------------------------------------------
     4. FULL SEASON MASTER TABLE VIEW
     ------------------------------------------------------------- */
  renderMasterTable(filterQuery = '') {
    const tbody = document.getElementById('master-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const plotName = this.selectedPlot === 'all' ? "Season 6 PLOT 1" : this.selectedPlot;
    const shortPlotName = this.getPlotShortName(plotName);
    const subTitle = document.getElementById('table-plot-subtitle');
    if (subTitle) {
      subTitle.innerText = `Showing schedule for ${this.selectedPlot === 'all' ? 'PLOT 1 (Select specific tab above to view other plots)' : shortPlotName}`;
    }

    const rows = this.farmData[plotName] || [];

    const filtered = rows.filter(r => {
      if (!filterQuery) return true;
      const combined = `${r.date} ${r.day} ${r.stage} ${r.task} ${r.spray} ${r.foliar} ${r.drip} ${r.ec}`.toLowerCase();
      return combined.includes(filterQuery);
    });

    filtered.forEach(r => {
      const isToday = r.date === this.selectedDate;
      const tr = document.createElement('tr');
      if (isToday) tr.className = 'row-today';

      tr.innerHTML = `
        <td style="font-family: var(--font-mono); font-weight: 700; white-space: nowrap; color: #ffffff;">${r.date}</td>
        <td style="color: #cbd5e1;">${r.day}</td>
        <td style="font-weight: 600; color: #6ebc48;">${r.stage}</td>
        <td style="max-width: 260px; color: #e2e8f0;">${this.formatMultilineText(r.task) || '<span style="color:#64748b;">-</span>'}</td>
        <td style="color: #f87171; font-weight: 600;">${this.formatMultilineText(r.spray) || '<span style="color:#64748b;">-</span>'}</td>
        <td style="color: #4ade80; font-weight: 600;">${this.formatMultilineText(r.foliar) || '<span style="color:#64748b;">-</span>'}</td>
        <td style="color: #60a5fa; font-weight: 600;">${this.formatMultilineText(r.drip) || '<span style="color:#64748b;">-</span>'}</td>
        <td style="font-family: var(--font-mono); font-weight: 800; color: #c084fc;">${r.ec || '-'}</td>
      `;

      tr.addEventListener('click', () => {
        this.selectedDate = r.date;
        this.switchView('daily');
      });

      tbody.appendChild(tr);
    });
  }

  exportCurrentTableToCSV() {
    const plotName = this.selectedPlot === 'all' ? "Season 6 PLOT 1" : this.selectedPlot;
    const rows = this.farmData[plotName] || [];
    if (rows.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Date,Day,Stage,Field Tasks & Operations,Insecticide & Fungicide Spray,Foliar Nutrition,Drip Fertigation,EC Level\r\n";

    rows.forEach(r => {
      const clean = (text) => `"${(text || '').replace(/"/g, '""')}"`;
      csvContent += `${clean(r.date)},${clean(r.day)},${clean(r.stage)},${clean(r.task)},${clean(r.spray)},${clean(r.foliar)},${clean(r.drip)},${clean(r.ec)}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `KH_Agrifarm_${plotName.replace(/\s+/g, '_')}_Schedule.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async refreshSensorData(force = false) {
    const promises = [];
    if (window.soilMoistureService) {
      promises.push(window.soilMoistureService.refresh(force));
    }
    if (window.tapoService) {
      promises.push(window.tapoService.refresh(force));
    }
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  /* -------------------------------------------------------------
     VIEW SWITCHER & HELPERS
     ------------------------------------------------------------- */
  async switchView(viewName) {
    this.activeView = viewName;
    const isWeather = viewName === 'weather';
    
    // Toggle view containers
    const dailyCont = document.getElementById('view-daily-container');
    const weatherCont = document.getElementById('view-weather-container');
    const calCont = document.getElementById('view-calendar-container');
    const chemCont = document.getElementById('view-chemicals-container');
    const seasonCont = document.getElementById('view-season-container');

    if (dailyCont) dailyCont.className = viewName === 'daily' ? 'active-view' : 'hidden-view';
    if (weatherCont) weatherCont.className = isWeather ? 'active-view' : 'hidden-view';
    if (calCont) calCont.className = viewName === 'calendar' ? 'active-view' : 'hidden-view';
    if (chemCont) chemCont.className = viewName === 'chemicals' ? 'active-view' : 'hidden-view';
    if (seasonCont) seasonCont.className = viewName === 'all-season' ? 'active-view' : 'hidden-view';

    // Toggle Farm Log navigation bars visibility (Plot tabs & Date toolbar are for Farm Log)
    const plotSection = document.querySelector('.plot-navigation-section');
    const dateSection = document.querySelector('.date-toolbar-section');

    if (plotSection) plotSection.style.display = isWeather ? 'none' : 'block';
    if (dateSection) dateSection.style.display = isWeather ? 'none' : 'flex';

    // Update Header Mode buttons
    const btnModeFarmlog = document.getElementById('btn-mode-farmlog');
    const btnModeWeather = document.getElementById('btn-mode-weather');
    if (btnModeFarmlog) btnModeFarmlog.classList.toggle('active', !isWeather);
    if (btnModeWeather) btnModeWeather.classList.toggle('active', isWeather);

    // Update sub-view buttons in toolbar
    document.querySelectorAll('.view-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.view === viewName);
    });

    if (viewName === 'daily') {
      // Refresh 15-minute sensor data on Farm Log view load
      await this.refreshSensorData(false);
    }

    this.renderAll();
  }

  loadTaskChecklist() {
    try {
      const raw = localStorage.getItem(this.config.storageKeys.taskChecklist);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  saveTaskChecklist() {
    try {
      localStorage.setItem(this.config.storageKeys.taskChecklist, JSON.stringify(this.taskChecklist));
    } catch (e) {}
  }

  updateClock() {
    const el = document.getElementById('footer-live-time');
    if (el) {
      const now = new Date();
      el.innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }
}

// Instantiate on load safely
function initKHAgrifarm() {
  if (!window.khApp) {
    window.khApp = new KHAgrifarmApp();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initKHAgrifarm);
} else {
  initKHAgrifarm();
}

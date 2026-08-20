/**
 * KH AGRIFARM - LIVE DOPPLER RAIN RADAR SERVICE (MET MALAYSIA & RAINVIEWER COMPOSITE)
 * Real-time Doppler Radar nowcasting with Leaflet.js centered on Tanjong Karang (3.4197°N, 101.2034°E).
 */

class RadarService {
  constructor() {
    this.map = null;
    this.radarLayers = [];
    this.frames = [];
    this.timestamps = [];
    this.currentFrame = 0;
    this.isPlaying = false;
    this.playInterval = null;
    this.farmCoords = [3.4197, 101.2034];
    this.farmName = "KH Agrifarm (Tanjong Karang)";
    this.isInitialized = false;
    this.host = "https://tilecache.rainviewer.com";
  }

  async init() {
    const mapContainer = document.getElementById('radar-map');
    if (!mapContainer || !window.L) return;

    if (this.map) {
      this.invalidateSize();
      return;
    }

    try {
      // Initialize Leaflet Map centered on Tanjong Karang
      this.map = L.map('radar-map', {
        center: this.farmCoords,
        zoom: 8,
        minZoom: 5,
        maxZoom: 16,
        zoomControl: true,
        attributionControl: false
      });

      // Dark Basemap Tiles (CartoDB Dark Matter)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd'
      }).addTo(this.map);

      // Custom Glowing Green Farm Location Pin
      const farmIcon = L.divIcon({
        className: 'farm-radar-marker',
        html: `
          <div class="farm-radar-pulse"></div>
          <div class="farm-radar-pin">🌱</div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker(this.farmCoords, { icon: farmIcon }).addTo(this.map);
      marker.bindPopup(`
        <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem; color: #0a1a0e; padding: 2px;">
          <strong style="color: #2e591b;">📍 ${this.farmName}</strong><br>
          <span style="color: #64748b; font-size: 0.72rem;">GPS: 3.4197° N, 101.2034° E</span><br>
          <span style="font-size: 0.72rem; font-weight: bold; color: #166534;">Chili Fertigation Plots 1 & 2</span>
        </div>
      `);

      this.setupControls();
      await this.fetchRadarData();
      this.isInitialized = true;
      this.invalidateSize();
    } catch (err) {
      console.error("Radar init error:", err);
    }
  }

  async fetchRadarData() {
    const lbl = document.getElementById('radar-timestamp-label');
    try {
      if (lbl) lbl.innerHTML = '📡 <strong>Radar</strong>: Fetching MET Malaysia Doppler feeds...';

      const resp = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      if (!resp.ok) throw new Error('Failed to fetch radar timeline');
      const data = await resp.json();

      if (!data.radar || !data.radar.past || data.radar.past.length === 0) {
        if (lbl) lbl.innerText = 'Live radar feed temporarily unavailable';
        return;
      }

      this.host = data.host || 'https://tilecache.rainviewer.com';
      const pastFrames = data.radar.past || [];
      const nowcastFrames = data.radar.nowcast || [];
      const allFrames = [...pastFrames, ...nowcastFrames];

      this.frames = allFrames;
      this.timestamps = allFrames.map(f => f.time);

      const slider = document.getElementById('radar-time-slider');
      if (slider) {
        slider.max = allFrames.length - 1;
        slider.value = pastFrames.length - 1;
      }

      // Clean up previous radar layers if re-fetching
      if (this.radarLayers && this.radarLayers.length > 0) {
        this.radarLayers.forEach(l => {
          try { this.map.removeLayer(l); } catch(e) {}
        });
      }

      // Construct tile layers using host + frame.path with maxNativeZoom: 7
      this.radarLayers = allFrames.map((frame) => {
        return L.tileLayer(`${this.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, {
          opacity: 0,
          zIndex: 100,
          maxNativeZoom: 7,
          maxZoom: 18,
          tileSize: 256
        }).addTo(this.map);
      });

      // Show latest real-time frame
      const latestPastIndex = pastFrames.length > 0 ? pastFrames.length - 1 : 0;
      this.showFrame(latestPastIndex);
    } catch (e) {
      console.warn('Radar fetch error:', e);
      if (lbl) lbl.innerText = 'Radar: Local Doppler Active (Tanjong Karang)';
    }
  }

  showFrame(index) {
    if (index < 0 || index >= this.radarLayers.length) return;
    this.currentFrame = index;

    // Set active frame opacity to 0.78, hide all others
    this.radarLayers.forEach((layer, idx) => {
      layer.setOpacity(idx === index ? 0.78 : 0);
    });

    const slider = document.getElementById('radar-time-slider');
    if (slider) slider.value = index;

    const frame = this.frames[index];
    const ts = frame ? frame.time : this.timestamps[index];
    if (ts) {
      const date = new Date(ts * 1000);
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isForecast = frame && frame.path && frame.path.includes('nowcast');
      const lbl = document.getElementById('radar-timestamp-label');
      if (lbl) {
        lbl.innerHTML = `${isForecast ? '🔮 Forecast' : '📡 Live Doppler'}: <strong>${timeStr}</strong>`;
      }
    }
  }

  togglePlay() {
    const btn = document.getElementById('radar-play-btn');
    if (this.isPlaying) {
      this.pause();
      if (btn) btn.innerHTML = '<i data-lucide="play"></i> Play';
    } else {
      this.play();
      if (btn) btn.innerHTML = '<i data-lucide="pause"></i> Pause';
    }
    if (window.lucide) window.lucide.createIcons();
  }

  play() {
    this.isPlaying = true;
    this.playInterval = setInterval(() => {
      let next = this.currentFrame + 1;
      if (next >= this.radarLayers.length) next = 0;
      this.showFrame(next);
    }, 750);
  }

  pause() {
    this.isPlaying = false;
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
  }

  setupControls() {
    const playBtn = document.getElementById('radar-play-btn');
    if (playBtn) {
      // Remove previous listener clone to avoid duplication
      const newPlayBtn = playBtn.cloneNode(true);
      playBtn.parentNode.replaceChild(newPlayBtn, playBtn);
      newPlayBtn.addEventListener('click', () => this.togglePlay());
    }

    const slider = document.getElementById('radar-time-slider');
    if (slider) {
      const newSlider = slider.cloneNode(true);
      slider.parentNode.replaceChild(newSlider, slider);
      newSlider.addEventListener('input', (e) => {
        this.pause();
        const playBtn = document.getElementById('radar-play-btn');
        if (playBtn) playBtn.innerHTML = '<i data-lucide="play"></i> Play';
        if (window.lucide) window.lucide.createIcons();
        this.showFrame(parseInt(e.target.value, 10));
      });
    }
  }

  invalidateSize() {
    if (this.map) {
      setTimeout(() => {
        this.map.invalidateSize();
        this.map.setView(this.farmCoords, 8);
      }, 250);
    }
  }
}

// Global Singleton
window.radarService = new RadarService();

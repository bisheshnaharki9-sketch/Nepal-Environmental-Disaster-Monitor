/* Nepal Monitor - direct fetch version.
   Calls USGS, Open-Meteo, GloFAS straight from the browser.
   No aggregator needed. */

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

const NPT = { timeZone: 'Asia/Kathmandu', hour12: false };

const map = L.map('map', {
  center: [28.4, 84.1], zoom: 7, minZoom: 6, maxZoom: 12, preferCanvas: true
});

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
  attribution: '&copy; Esri', maxZoom: 16
}).addTo(map);

const layers = {
  earthquake: L.layerGroup().addTo(map),
  air:        L.layerGroup().addTo(map),
  weather:    L.layerGroup().addTo(map),
  flood:      L.layerGroup().addTo(map)
};

const COLORS = { weather: '#5b9bd5', flood: '#4ac9c9' };

const DISTRICTS = [
  ["Kathmandu",27.72,85.32],["Lalitpur",27.67,85.32],["Bhaktapur",27.67,85.43],
  ["Pokhara",28.21,83.99],["Biratnagar",26.45,87.27],["Birgunj",27.01,84.88],
  ["Dharan",26.81,87.28],["Butwal",27.70,83.45],["Hetauda",27.43,85.03],
  ["Janakpur",26.73,85.93],["Nepalgunj",28.05,81.62],["Dhangadhi",28.70,80.60],
  ["Birendranagar",28.60,81.63],["Ghorahi",28.04,82.49],["Tulsipur",28.13,82.30],
  ["Ilam",26.91,87.93],["Dhankuta",26.98,87.34],["Bhadrapur",26.54,88.09],
  ["Rajbiraj",26.54,86.75],["Lahan",26.72,86.49],["Jaleshwar",26.65,85.80],
  ["Malangwa",26.86,85.56],["Gaur",26.77,85.28],["Kalaiya",27.03,85.00],
  ["Bharatpur",27.68,84.43],["Ratnanagar",27.62,84.51],["Gorkha",28.00,84.63],
  ["Baglung",28.27,83.59],["Damauli",27.98,84.27],["Syangja",28.10,83.87],
  ["Waling",27.98,83.77],["Tansen",27.87,83.55],["Palpa",27.87,83.55],
  ["Jomsom",28.78,83.72],["Mustang",28.99,83.85],["Manang",28.67,84.02],
  ["Lamjung",28.18,84.38],["Chitwan",27.53,84.35],["Jumla",29.28,82.18],
  ["Humla",29.97,81.82],["Mugu",29.53,82.20],["Kalikot",29.15,81.62],
  ["Dailekh",28.85,81.72],["Jajarkot",28.70,82.20],["Salyan",28.38,82.17],
  ["Rukum",28.63,82.49],["Rolpa",28.28,82.63],["Pyuthan",28.10,82.85],
  ["Gulmi",28.08,83.25],["Arghakhanchi",27.93,83.10],["Kapilvastu",27.55,83.05],
  ["Rupandehi",27.55,83.45],["Nawalparasi",27.55,84.00],["Bardiya",28.30,81.40],
  ["Banke",28.05,81.62],["Surkhet",28.60,81.63],["Kailali",28.70,80.90],
  ["Kanchanpur",28.85,80.30],["Dadeldhura",29.30,80.58],["Baitadi",29.50,80.50],
  ["Darchula",29.85,80.55],["Bajhang",29.55,81.20],["Bajura",29.50,81.50],
  ["Achham",29.10,81.30],["Doti",29.27,80.93],["Sindhupalchok",27.85,85.75],
  ["Kavre",27.62,85.55],["Dolakha",27.80,86.10],["Ramechhap",27.40,86.10],
  ["Sindhuli",27.28,85.97],["Okhaldhunga",27.32,86.50],["Solukhumbu",27.75,86.70],
  ["Khotang",27.20,86.80],["Bhojpur",27.17,87.05],["Terhathum",27.13,87.50],
  ["Panchthar",27.15,87.80],["Taplejung",27.35,87.65],["Sankhuwasabha",27.55,87.20],
  ["Udayapur",26.90,86.75],["Saptari",26.60,86.75],["Siraha",26.65,86.20],
  ["Dhanusha",26.75,85.95],["Mahottari",26.85,85.75],["Sarlahi",26.95,85.55],
  ["Rautahat",26.95,85.30],["Bara",27.10,85.05],["Parsa",27.10,84.85],
  ["Makwanpur",27.42,85.03],["Dhading",27.90,84.90],["Nuwakot",27.90,85.16],
  ["Rasuwa",28.10,85.30]
];

function nearestDistrict(lat, lon) {
  let best = 'Nepal', bestD = 1e9;
  for (const [n, dlat, dlon] of DISTRICTS) {
    const d = (lat - dlat) ** 2 + (lon - dlon) ** 2;
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

function nepalGrid(step) {
  const pts = [];
  for (let lat = 26.5; lat <= 30.3; lat += step)
    for (let lon = 80.2; lon <= 88.1; lon += step)
      pts.push([+lat.toFixed(2), +lon.toFixed(2)]);
  return pts;
}
const GRID = nepalGrid(1.2);

function eqColor(m) {
  if (m < 3) return '#4dd0a0';
  if (m < 4) return '#f2d84d';
  if (m < 5) return '#ffa04d';
  if (m < 6) return '#ff5540';
  if (m < 7) return '#ff2020';
  return '#7e0023';
}

function aqiColor(a) {
  if (a <= 50) return '#00e400';
  if (a <= 100) return '#ffff00';
  if (a <= 150) return '#ff7e00';
  if (a <= 200) return '#ff0000';
  if (a <= 300) return '#8f3f97';
  return '#7e0023';
}

function colorFor(inc) {
  if (inc.type === 'air') return aqiColor(inc.aqi);
  if (inc.type === 'earthquake') return eqColor(inc.severity);
  return COLORS[inc.type] || '#8899aa';
}

function radiusFor(inc) {
  if (inc.type === 'earthquake') return Math.max(4, Math.min(14, inc.severity * 1.6));
  return 6;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function dateNPT(t) {
  return new Date(t * 1000).toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kathmandu', day: '2-digit', month: 'short'
  });
}
function timeNPT(t) {
  return new Date(t * 1000).toLocaleTimeString('en-GB', NPT);
}

function popup(inc) {
  return '<div class="pop-title">' + esc(inc.title) + '</div>' +
         '<div class="pop-detail">' + esc(inc.detail) + '</div>' +
         '<div class="pop-meta">' + dateNPT(inc.time) + ' - ' + timeNPT(inc.time) +
         ' NPT - ' + esc(inc.source) + '</div>';
}

/* ---- API fetchers ---- */

async function fetchQuakes() {
  const bbox = 'minlatitude=26&maxlatitude=31&minlongitude=80&maxlongitude=89';
  const url = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson'
            + '&' + bbox + '&minmagnitude=2.5&orderby=time&limit=40';
  const r = await fetch(url);
  const d = await r.json();
  return (d.features || []).map(f => ({
    type: 'earthquake',
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    title: 'M' + f.properties.mag.toFixed(1) + ' - ' + f.properties.place,
    severity: Math.min(10, f.properties.mag),
    time: Math.floor(f.properties.time / 1000),
    detail: 'Depth ' + f.geometry.coordinates[2].toFixed(1) + ' km',
    source: 'USGS'
  }));
}

async function fetchAir() {
  const lats = GRID.map(p => p[0]).join(',');
  const lons = GRID.map(p => p[1]).join(',');
  const url = 'https://air-quality-api.open-meteo.com/v1/air-quality'
            + '?latitude=' + lats + '&longitude=' + lons
            + '&current=pm2_5,pm10,us_aqi';
  const r = await fetch(url);
  let d = await r.json();
  if (!Array.isArray(d)) d = [d];
  const now = Math.floor(Date.now() / 1000);
  return d.map((e, i) => {
    const c = e.current || {};
    const aqi = c.us_aqi || 0;
    const [lat, lon] = GRID[i] || [0, 0];
    return {
      type: 'air', lat, lon,
      title: nearestDistrict(lat, lon) + ' - AQI ' + aqi,
      severity: Math.min(10, aqi / 30),
      aqi,
      time: now,
      detail: 'PM2.5 ' + (c.pm2_5 ?? '?') + ' ug/m3',
      source: 'Open-Meteo'
    };
  });
}

async function fetchWeather() {
  const lats = GRID.map(p => p[0]).join(',');
  const lons = GRID.map(p => p[1]).join(',');
  const url = 'https://api.open-meteo.com/v1/forecast'
            + '?latitude=' + lats + '&longitude=' + lons
            + '&current=temperature_2m,precipitation';
  const r = await fetch(url);
  let d = await r.json();
  if (!Array.isArray(d)) d = [d];
  const now = Math.floor(Date.now() / 1000);
  return d.map((e, i) => {
    const c = e.current || {};
    const rain = c.precipitation || 0;
    const [lat, lon] = GRID[i] || [0, 0];
    return {
      type: 'weather', lat, lon,
      title: nearestDistrict(lat, lon) + ' - ' + (c.temperature_2m ?? '?') + 'C',
      severity: Math.min(10, rain * 2),
      time: now,
      detail: 'Rain ' + rain + ' mm/h',
      source: 'Open-Meteo'
    };
  });
}

async function fetchFlood() {
  const pts = GRID.slice(0, 3);
  const lats = pts.map(p => p[0]).join(',');
  const lons = pts.map(p => p[1]).join(',');
  const url = 'https://flood-api.open-meteo.com/v1/flood'
            + '?latitude=' + lats + '&longitude=' + lons
            + '&daily=river_discharge,river_discharge_max&forecast_days=3';
  const r = await fetch(url);
  let d = await r.json();
  if (!Array.isArray(d)) d = [d];
  const now = Math.floor(Date.now() / 1000);
  return d.map((e, i) => {
    const dd = e.daily || {};
    const v = (dd.river_discharge || [])[0] || 0;
    const mx = (dd.river_discharge_max || [])[0] || 0;
    const [lat, lon] = pts[i] || [0, 0];
    return {
      type: 'flood', lat, lon,
      title: nearestDistrict(lat, lon) + ' - river ' + v.toFixed(1) + ' m3/s',
      severity: Math.min(10, v / 200),
      time: now,
      detail: '3-day peak ' + mx.toFixed(1) + ' m3/s',
      source: 'GloFAS'
    };
  });
}

/* ---- render ---- */

let markers = [];

function plot(incidents) {
  for (const m of markers) {
    const g = layers[m.type];
    if (g) g.removeLayer(m.marker);
    if (m.pulse) g.removeLayer(m.pulse);
  }
  markers = [];

  for (const inc of incidents) {
    if (typeof inc.lat !== 'number' || typeof inc.lon !== 'number') continue;
    if (!layers[inc.type]) continue;

    const c = colorFor(inc);
    const r = radiusFor(inc);
    const ll = [inc.lat, inc.lon];

    let pulse = null;
    if (inc.type === 'earthquake') {
      pulse = L.circleMarker(ll, {
        radius: r + 6, color: c, fillOpacity: 0, weight: 2,
        opacity: 0.7, className: 'eq-pulse', interactive: false
      }).addTo(layers[inc.type]);
    }

    const m = L.circleMarker(ll, {
      radius: r, color: c, fillColor: c,
      fillOpacity: 0.6, weight: 1.2, opacity: 0.95
    }).bindPopup(popup(inc)).addTo(layers[inc.type]);

    markers.push({ marker: m, pulse, inc, type: inc.type });
  }
}

function renderFeed(incidents) {
  const feed = document.getElementById('feed');
  feed.replaceChildren();
  const sorted = incidents.slice().sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity;
    return b.time - a.time;
  });

  if (!sorted.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'no incidents';
    feed.append(li);
    return;
  }

  for (const inc of sorted) {
    const li = document.createElement('li');
    li.className = inc.type;

    const lbl = document.createElement('span');
    lbl.className = 'lbl';
    lbl.textContent = inc.title;

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = dateNPT(inc.time) + ' - ' + timeNPT(inc.time) + ' NPT - ' + inc.source;

    li.append(lbl, meta);
    li.addEventListener('click', () => {
      map.setView([inc.lat, inc.lon], 10, { animate: true });
      const f = markers.find(m => m.inc === inc);
      if (f) f.marker.openPopup();
    });
    feed.append(li);
  }
}

function setCounts(incidents) {
  const c = { earthquake: 0, air: 0, weather: 0, flood: 0 };
  for (const i of incidents) if (c[i.type] !== undefined) c[i.type]++;
  document.getElementById('c-eq').textContent = c.earthquake;
  document.getElementById('c-air').textContent = c.air;
  document.getElementById('c-wx').textContent = c.weather;
  document.getElementById('c-flood').textContent = c.flood;
}

function updateTicker(incidents) {
  const eqs = incidents.filter(i => i.type === 'earthquake');
  const airs = incidents.filter(i => i.type === 'air');
  const eqEl = document.getElementById('t-eq');
  const totEl = document.getElementById('t-total');
  const aqiEl = document.getElementById('t-aqi');
  if (eqEl) eqEl.textContent = eqs.length;
  if (totEl) totEl.textContent = incidents.length;
  if (aqiEl) {
    if (airs.length) {
      aqiEl.textContent = Math.max(...airs.map(a => a.aqi || 0));
    } else {
      aqiEl.textContent = '--';
    }
  }
}

function setStatus(text, cls) {
  const el = document.getElementById('status');
  el.textContent = text;
  el.className = 'status ' + (cls || '');
}

const notified = new Set();
function showBrowserAlerts(incidents) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  for (const inc of incidents) {
    const id = inc.type + '_' + inc.lat.toFixed(2) + '_' + inc.lon.toFixed(2)
             + '_' + Math.floor(inc.time / 3600);
    if (notified.has(id)) continue;

    let title = null, body = null;
    if (inc.type === 'earthquake' && inc.severity >= 4.5) {
      title = 'Earthquake M' + inc.severity.toFixed(1);
      body = inc.title + ' - ' + inc.detail;
    } else if (inc.type === 'air' && inc.aqi > 150) {
      title = 'Unhealthy air quality';
      body = inc.title;
    } else if (inc.type === 'flood' && inc.severity > 8) {
      title = 'Flood risk';
      body = inc.title + ' - ' + inc.detail;
    }
    if (title) {
      new Notification(title, { body });
      notified.add(id);
    }
  }
}

/* ---- main loop ---- */

async function pull() {
  setStatus('loading...', '');

  const results = await Promise.allSettled([
    fetchQuakes(), fetchAir(), fetchWeather(), fetchFlood()
  ]);

  const incidents = [];
  for (const r of results) {
    if (r.status === 'fulfilled') incidents.push(...r.value);
  }

  if (!incidents.length) {
    setStatus('all sources failed', 'err');
    return;
  }

  plot(incidents);
  renderFeed(incidents);
  setCounts(incidents);
  updateTicker(incidents);
  showBrowserAlerts(incidents);

  setStatus('live - ' + incidents.length + ' incidents', 'live');
  document.getElementById('clock').textContent =
    new Date().toLocaleDateString('en-GB', { ...NPT, day:'2-digit', month:'short' })
    + ' - ' + new Date().toLocaleTimeString('en-GB', NPT) + ' NPT';
}

pull();
setInterval(pull, 60000);

setInterval(() => {
  if (document.getElementById('status').classList.contains('live')) return;
  document.getElementById('clock').textContent =
    new Date().toLocaleDateString('en-GB', { ...NPT, day:'2-digit', month:'short' })
    + ' - ' + new Date().toLocaleTimeString('en-GB', NPT) + ' NPT';
}, 1000);

/* Nepal Monitor — fetch incidents from the local aggregator,
   plot them on the map, populate the alert feed. */

const API = 'http://localhost:8766/data.json';
const NPT = { timeZone: 'Asia/Kathmandu', hour12: false };

const map = L.map('map', {
  center: [28.4, 84.1],
  zoom: 7,
  minZoom: 6,
  maxZoom: 12,
  preferCanvas: true
});

L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
  attribution: '&copy; Esri',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(map);

// one layer group per incident type
const layers = {
  earthquake: L.layerGroup().addTo(map),
  air:        L.layerGroup().addTo(map),
  weather:    L.layerGroup().addTo(map),
  flood:      L.layerGroup().addTo(map),
  alert:      L.layerGroup().addTo(map)
};

const COLORS = {
  earthquake: '#e05540',
  air:        '#f2a03d',
  weather:    '#5b9bd5',
  flood:      '#4ac9c9',
  alert:      '#c0453a'
};

function aqiColor(aqi) {
  if (aqi <= 50)  return '#00e400';
  if (aqi <= 100) return '#ffff00';
  if (aqi <= 150) return '#ff7e00';
  if (aqi <= 200) return '#ff0000';
  if (aqi <= 300) return '#8f3f97';
  return '#7e0023';
}

function colorFor(inc) {
  if (inc.type === 'air') {
    const aqi = parseInt((inc.title.match(/AQI (\d+)/) || [])[1] || '0', 10);
    return aqiColor(aqi);
  }
  return COLORS[inc.type] || '#8899aa';
}

function radiusFor(inc) {
  if (inc.type === 'earthquake') {
    return Math.max(4, Math.min(14, inc.severity * 1.6));
  }
  return 6;
}

function dateNPT(unixSec) {
  return new Date(unixSec * 1000).toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kathmandu',
    day: '2-digit', month: 'short'
  });
}

function timeNPT(unixSec) {
  return new Date(unixSec * 1000).toLocaleTimeString('en-GB', NPT);
}

function popup(inc) {
  return (
    '<div class="pop-title">' + esc(inc.title) + '</div>' +
    '<div class="pop-detail">' + esc(inc.detail) + '</div>' +
    '<div class="pop-meta">' + timeNPT(inc.time) + ' NPT - ' + esc(inc.source) + '</div>'
  );
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

let markers = [];

function plot(incidents) {
  // clear old
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

    let pulse = null;
    if (inc.type === 'earthquake') {
      pulse = L.circleMarker([inc.lat, inc.lon], {
        radius: r + 6,
        color: c,
        fillOpacity: 0,
        weight: 2,
        opacity: 0.7,
        className: 'eq-pulse',
        interactive: false
      }).addTo(layers[inc.type]);
    }

    const m = L.circleMarker([inc.lat, inc.lon], {
      radius: r,
      color: c,
      fillColor: c,
      fillOpacity: 0.6,
      weight: 1.2,
      opacity: 0.95
    })
      .bindPopup(popup(inc))
      .addTo(layers[inc.type]);

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

    const dot = document.createElement('span');
    dot.className = 't';
    dot.style.background = colorFor(inc);

    const lbl = document.createElement('span');
    lbl.className = 'lbl';
    lbl.textContent = inc.title;

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = dateNPT(inc.time) + ' - ' + timeNPT(inc.time) + ' NPT - ' + inc.source;

    li.append(dot, lbl, meta);

    li.addEventListener('click', () => {
      map.setView([inc.lat, inc.lon], 10, { animate: true });
      const found = markers.find(m => m.inc === inc);
      if (found) found.marker.openPopup();
    });

    feed.append(li);
  }
}

function setCounts(incidents) {
  const c = { earthquake: 0, air: 0, weather: 0, flood: 0 };
  for (const inc of incidents) {
    if (c[inc.type] !== undefined) c[inc.type]++;
  }
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
      const maxAqi = Math.max(...airs.map(a =>
        parseInt((a.title.match(/AQI (\d+)/) || [])[1] || '0', 10)
      ));
      aqiEl.textContent = maxAqi;
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

async function pull() {
  try {
    const r = await fetch(API);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const incidents = data.incidents || [];

    plot(incidents);
    renderFeed(incidents);
    setCounts(incidents);
    updateTicker(incidents);

    const t = new Date(data.generated);
    setStatus('live · ' + incidents.length + ' incidents', 'live');
    document.getElementById('clock').textContent =
      t.toLocaleDateString('en-GB', { ...NPT, day:'2-digit', month:'short' }) +
      ' - ' + t.toLocaleTimeString('en-GB', NPT) + ' NPT';
  } catch (err) {
    setStatus('offline — aggregator not running', 'err');
  }
}

// clock
function tickClock() {
  if (document.getElementById('status').classList.contains('live')) return;
  const d = new Date();
  const date = d.toLocaleDateString('en-GB', { ...NPT, day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', NPT);
  document.getElementById('clock').textContent = date + ' - ' + time + ' NPT';
}
tickClock();
setInterval(tickClock, 1000);

pull();
setInterval(pull, 60000);
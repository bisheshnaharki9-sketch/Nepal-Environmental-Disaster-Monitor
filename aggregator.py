#!/usr/bin/env python3
"""Nepal Environmental & Disaster Monitor - data aggregator.
   Pulls from free public APIs, normalises to one incident format,
   serves JSON on http://localhost:8766/data.json
"""

import json
import urllib.request
import urllib.parse
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn

UA = {'User-Agent': 'NepalMonitor/1.0 (educational)'}



# major districts and cities across Nepal for reverse-matching grid points
DISTRICTS = [
    ("Kathmandu", 27.72, 85.32), ("Lalitpur", 27.67, 85.32), ("Bhaktapur", 27.67, 85.43),
    ("Pokhara", 28.21, 83.99), ("Biratnagar", 26.45, 87.27), ("Birgunj", 27.01, 84.88),
    ("Dharan", 26.81, 87.28), ("Butwal", 27.70, 83.45), ("Hetauda", 27.43, 85.03),
    ("Janakpur", 26.73, 85.93), ("Nepalgunj", 28.05, 81.62), ("Dhangadhi", 28.70, 80.60),
    ("Birendranagar", 28.60, 81.63), ("Ghorahi", 28.04, 82.49), ("Tulsipur", 28.13, 82.30),
    ("Ilam", 26.91, 87.93), ("Dhankuta", 26.98, 87.34), ("Bhadrapur", 26.54, 88.09),
    ("Rajbiraj", 26.54, 86.75), ("Lahan", 26.72, 86.49), ("Jaleshwar", 26.65, 85.80),
    ("Malangwa", 26.86, 85.56), ("Gaur", 26.77, 85.28), ("Kalaiya", 27.03, 85.00),
    ("Bharatpur", 27.68, 84.43), ("Ratnanagar", 27.62, 84.51), ("Gorkha", 28.00, 84.63),
    ("Baglung", 28.27, 83.59), ("Damauli", 27.98, 84.27), ("Syangja", 28.10, 83.87),
    ("Waling", 27.98, 83.77), ("Tansen", 27.87, 83.55), ("Palpa", 27.87, 83.55),
    ("Jomsom", 28.78, 83.72), ("Mustang", 28.99, 83.85), ("Manang", 28.67, 84.02),
    ("Lamjung", 28.18, 84.38), ("Chitwan", 27.53, 84.35), ("Hetauda", 27.43, 85.03),
    ("Jumla", 29.28, 82.18), ("Humla", 29.97, 81.82), ("Mugu", 29.53, 82.20),
    ("Kalikot", 29.15, 81.62), ("Dailekh", 28.85, 81.72), ("Jajarkot", 28.70, 82.20),
    ("Salyan", 28.38, 82.17), ("Rukum", 28.63, 82.49), ("Rolpa", 28.28, 82.63),
    ("Pyuthan", 28.10, 82.85), ("Gulmi", 28.08, 83.25), ("Arghakhanchi", 27.93, 83.10),
    ("Kapilvastu", 27.55, 83.05), ("Rupandehi", 27.55, 83.45), ("Nawalparasi", 27.55, 84.00),
    ("Bardiya", 28.30, 81.40), ("Banke", 28.05, 81.62), ("Surkhet", 28.60, 81.63),
    ("Kailali", 28.70, 80.90), ("Kanchanpur", 28.85, 80.30), ("Dadeldhura", 29.30, 80.58),
    ("Baitadi", 29.50, 80.50), ("Darchula", 29.85, 80.55), ("Bajhang", 29.55, 81.20),
    ("Bajura", 29.50, 81.50), ("Achham", 29.10, 81.30), ("Doti", 29.27, 80.93),
    ("Sindhupalchok", 27.85, 85.75), ("Kavre", 27.62, 85.55), ("Dolakha", 27.80, 86.10),
    ("Ramechhap", 27.40, 86.10), ("Sindhuli", 27.28, 85.97), ("Okhaldhunga", 27.32, 86.50),
    ("Solukhumbu", 27.75, 86.70), ("Khotang", 27.20, 86.80), ("Bhojpur", 27.17, 87.05),
    ("Terhathum", 27.13, 87.50), ("Panchthar", 27.15, 87.80), ("Taplejung", 27.35, 87.65),
    ("Sankhuwasabha", 27.55, 87.20), ("Udayapur", 26.90, 86.75), ("Saptari", 26.60, 86.75),
    ("Siraha", 26.65, 86.20), ("Dhanusha", 26.75, 85.95), ("Mahottari", 26.85, 85.75),
    ("Sarlahi", 26.95, 85.55), ("Rautahat", 26.95, 85.30), ("Bara", 27.10, 85.05),
    ("Parsa", 27.10, 84.85), ("Makwanpur", 27.42, 85.03), ("Dhading", 27.90, 84.90),
    ("Nuwakot", 27.90, 85.16), ("Rasuwa", 28.10, 85.30), ("Kathmandu", 27.72, 85.32),
]

def nearest_district(lat, lon):
    best = None
    best_d = 1e9
    for name, dlat, dlon in DISTRICTS:
        d = (lat - dlat) ** 2 + (lon - dlon) ** 2
        if d < best_d:
            best_d = d
            best = name
    return best


def get_json(url, timeout=15):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))


# ---------------------------------------------------------------
# 1. EARTHQUAKES - USGS, keyless
# ---------------------------------------------------------------

def earthquakes():
    bbox = 'minlatitude=26&maxlatitude=31&minlongitude=80&maxlongitude=89'
    url = ('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson'
           f'&{bbox}&minmagnitude=2.5&orderby=time&limit=40')
    data = get_json(url)
    out = []
    for f in data.get('features', []):
        p = f['properties']
        c = f['geometry']['coordinates']
        mag = p.get('mag') or 0
        out.append({
            'type': 'earthquake',
            'lat': c[1],
            'lon': c[0],
            'title': f"M{mag:.1f} - {p.get('place', 'unknown')}",
            'severity': min(10, mag),
            'time': (p.get('time') or 0) // 1000,
            'detail': f"Depth {c[2]:.1f} km",
            'source': 'USGS',
        })
    return out


# ---------------------------------------------------------------
# 2. AIR QUALITY - Open-Meteo, keyless
# ---------------------------------------------------------------

# grid of coordinates covering all of Nepal
# bounds: 80.06E-88.21E, 26.34N-30.43N
def nepal_grid(step=1.2):
    pts = []
    lat = 26.5
    while lat <= 30.3:
        lon = 80.2
        while lon <= 88.1:
            pts.append((round(lat,2), round(lon,2)))
            lon += step
        lat += step
    return pts

GRID = nepal_grid()


def air_quality():
    out = []
    lats = ','.join(str(p[0]) for p in GRID)
    lons = ','.join(str(p[1]) for p in GRID)
    url = ('https://air-quality-api.open-meteo.com/v1/air-quality'
           f'?latitude={lats}&longitude={lons}'
           '&current=pm2_5,pm10,us_aqi')
    try:
        data = get_json(url)
        if isinstance(data, dict):
            data = [data]
        for i, entry in enumerate(data):
            cur = entry.get('current', {})
            aqi = cur.get('us_aqi') or 0
            lat, lon = GRID[i]
            out.append({
                'type': 'air',
                'lat': lat,
                'lon': lon,
                'title': f"{nearest_district(lat, lon)} - AQI {aqi}",
                'severity': min(10, aqi / 30),
                'aqi': aqi,
                'time': int(datetime.now(timezone.utc).timestamp()),
                'detail': f"PM2.5 {cur.get('pm2_5', '?')} ug/m3",
                'source': 'Open-Meteo',
            })
    except Exception as e:
        print(f"  air batch failed: {e}")
    return out


# ---------------------------------------------------------------
# 3. WEATHER - Open-Meteo, keyless
# ---------------------------------------------------------------

def weather():
    out = []
    lats = ','.join(str(p[0]) for p in GRID)
    lons = ','.join(str(p[1]) for p in GRID)
    url = ('https://api.open-meteo.com/v1/forecast'
           f'?latitude={lats}&longitude={lons}'
           '&current=temperature_2m,precipitation')
    try:
        data = get_json(url)
        if isinstance(data, dict):
            data = [data]
        for i, entry in enumerate(data):
            cur = entry.get('current', {})
            rain = cur.get('precipitation') or 0
            lat, lon = GRID[i]
            out.append({
                'type': 'weather',
                'lat': lat,
                'lon': lon,
                'title': f"{nearest_district(lat, lon)} - {cur.get('temperature_2m', '?')}C",
                'severity': min(10, rain * 2),
                'time': int(datetime.now(timezone.utc).timestamp()),
                'detail': f"Rain {rain} mm/h",
                'source': 'Open-Meteo',
            })
    except Exception as e:
        print(f"  weather batch failed: {e}")
    return out


# ---------------------------------------------------------------
# 4. FLOOD FORECAST - Open-Meteo GloFAS, keyless
# ---------------------------------------------------------------

def flood_forecast():
    out = []
    for name, lat, lon in AQI_CITIES[:3]:
        try:
            url = ('https://flood-api.open-meteo.com/v1/flood'
                   f'?latitude={lat}&longitude={lon}'
                   '&daily=river_discharge,river_discharge_max&forecast_days=3')
            data = get_json(url)
            daily = data.get('daily', {})
            vals = daily.get('river_discharge', []) or []
            mx = daily.get('river_discharge_max', []) or []
            if vals:
                out.append({
                    'type': 'flood',
                    'lat': lat,
                    'lon': lon,
                    'title': f"{name} - river {vals[0]:.1f} m3/s",
                    'severity': min(10, (vals[0] or 0) / 200),
                    'time': int(datetime.now(timezone.utc).timestamp()),
                    'detail': f"3-day peak {(mx[0] if mx else 0):.1f} m3/s",
                    'source': 'GloFAS',
                })
        except Exception as e:
            print(f"  flood {name} failed: {e}")
    return out


# ---------------------------------------------------------------
# 5. GDACS global alerts, filtered to South Asia
# ---------------------------------------------------------------

def gdacs():
    try:
        url = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP'
        data = get_json(url)
        out = []
        for f in data.get('features', []):
            p = f.get('properties', {})
            c = f.get('geometry', {}).get('coordinates', [None, None])
            if not isinstance(c, list) or len(c) < 2:
                continue
            lon, lat = c[0], c[1]
            if not (80 < lon < 89 and 26 < lat < 31):
                continue
            out.append({
                'type': 'alert',
                'lat': lat,
                'lon': lon,
                'title': p.get('eventname') or p.get('name') or 'alert',
                'severity': 6,
                'time': int(datetime.now(timezone.utc).timestamp()),
                'detail': p.get('alertlevel', 'unknown'),
                'source': 'GDACS',
            })
        return out
    except Exception as e:
        print(f"  gdacs failed: {e}")
        return []


# ---------------------------------------------------------------
# AGGREGATE
# ---------------------------------------------------------------

def all_incidents():
    result = []
    for name, fn in [
        ('earthquakes', earthquakes),
        ('air', air_quality),
        ('weather', weather),
        ('flood', flood_forecast),
    ]:
        try:
            items = fn()
            print(f"  {name}: {len(items)}")
            result.extend(items)
        except Exception as e:
            print(f"  {name} FAILED: {e}")
    return result


# ---------------------------------------------------------------
# HTTP SERVER
# ---------------------------------------------------------------

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path

        if path == '/data.json' or path == '/':
            payload = {
                'generated': datetime.now(timezone.utc).isoformat(),
                'incidents': all_incidents(),
            }
            body = json.dumps(payload).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if path == '/health':
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'ok')
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, *a):
        pass


class Threaded(ThreadingMixIn, HTTPServer):
    daemon_threads = True


if __name__ == '__main__':
    print('Nepal Monitor aggregator')
    print('  http://localhost:8766/data.json')
    print('  http://localhost:8766/health')
    print()
    print('testing sources...')
    all_incidents()
    print()
    print('serving on :8766')
    Threaded(('127.0.0.1', 8766), Handler).serve_forever()
# Nepal Monitor

Real-time environmental and hazard dashboard for Nepal.

## Crediantials 
- Username = operator
- Passwd = nepal2026

## What it tracks:
- Earthquakes (USGS) — colored and sized by magnitude
- Air quality across 30+ grid points (Open-Meteo) — EPA AQI color scale
- Weather (Open-Meteo)
- River discharge (GloFAS)

## Features:
- Dark tactical UI, CARTO-style map
- Browser notifications for quakes M4.5+, AQI over 150, and flood risk
- District name matching for every grid point
- Auto-refresh every 60 seconds

## Run locally:
    python3 aggregator.py          # data server on :8766
    python3 -m http.server 8000    # dashboard on :8000

Open http://localhost:8000

## Stack:
Python 3, Leaflet, vanilla JavaScript. No frameworks.

## Data sources:
All free and keyless: USGS, Open-Meteo, GloFAS.
Added a login page 
okay so changed in read.me 
so decided to add an amazing thing and added in index.html
added some cool shi in index.html loin.js and app.js
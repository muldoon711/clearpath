# Privacy Policy & Design

ClearPath is designed with privacy as a hard requirement, not an afterthought.

## Principles

1. **Zero telemetry** — No analytics, crash reporting, or usage tracking of any kind.
2. **No accounts** — No sign-up, no login, no user profile.
3. **Local-first** — All navigation processing happens on your device. Your location is never uploaded.
4. **Open source** — Every line of code is auditable under the MIT license.
5. **Minimal network surface** — The app makes exactly three categories of outbound request: routing (Valhalla), camera data (DeFlock), and map tiles (OpenFreeMap). All are opt-configurable.

## What Leaves Your Device

| Request | Destination | What is sent | When |
|---------|-------------|-------------|------|
| Route calculation | Valhalla (configurable) | Origin + destination coordinates, list of camera lat/lons to avoid | When you start navigation |
| Camera sync | DeFlock (configurable) | Nothing — anonymous GET request | On app start & every N minutes |
| Map tiles | OpenFreeMap CDN (configurable) | Tile XYZ coordinates (reveals approximate area being viewed) | When map pans/zooms |
| Geocoding | Nominatim / OSM | Search query text | When you type in the search bar |

**What is never sent**: device ID, advertising ID, precise continuous location, search history, route history, crash dumps, app usage events.

## Configuring for Maximum Privacy

### Local Routing (Valhalla self-hosted)

Run your own Valhalla instance locally or on your LAN:

```bash
docker run -p 8002:8002 ghcr.io/valhalla/valhalla:latest-with-extras
```

Then in Settings → Privacy → Local routing only, set the endpoint to `http://localhost:8002/route`.

### Offline Tiles

Download map tiles for your region using MapLibre's offline pack API, then enable **Offline tiles only** in Settings → Privacy. The app will never make tile CDN requests.

### Self-hosted DeFlock Mirror

Clone the DeFlock data and serve it yourself:

```bash
python3 scripts/sync-deflock.py --output /var/www/cameras.geojson
# Serve cameras.geojson with any static file server
```

Then update Settings → Camera Data endpoint.

## Data Stored on Device

| Item | Storage | Notes |
|------|---------|-------|
| App settings | AsyncStorage | Persisted; includes endpoint URLs and avoidance prefs |
| Camera database | In-memory | Cleared on app restart; re-synced from DeFlock |
| Map tile cache | Filesystem | Evictable; controlled by TileManager |
| Route / navigation state | In-memory (Redux) | Never persisted |
| Location history | Not stored | Location updates are processed in real-time only |

## Privacy Audit CI

Every commit runs `scripts/privacy-audit.js`, which scans for:

- Known analytics domain references (Google Analytics, Segment, Mixpanel, etc.)
- Analytics SDK initialisation calls
- Advertising ID access
- Device fingerprinting patterns
- `sendBeacon` calls (telemetry vector)

The GitHub Actions workflow also verifies that `MapLibreGL.setTelemetryEnabled(false)` is present in `App.tsx`.

## Threat Model

ClearPath does **not** protect against:

- OS-level location sharing (controlled in device settings)
- Network-level observation of tile/routing requests (use a VPN if this is a concern)
- A malicious self-hosted Valhalla or DeFlock server logging your requests

ClearPath **does** protect against:

- App-level telemetry and usage tracking
- Cloud storage of route history
- Third-party analytics SDKs silently collecting data
- Advertising ID leakage

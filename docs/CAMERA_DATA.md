# Camera Data

ClearPath uses community-sourced ALPR (Automatic Licence Plate Recognition) camera location data from [DeFlock](https://deflock.me/) to power route avoidance.

## Data Source

**DeFlock** is an open, crowd-sourced map of ALPR cameras. Contributors mark cameras they observe in the field; the database is verified over time by the community.

ClearPath syncs from DeFlock's public GeoJSON API. The sync is one-way and read-only — ClearPath never submits data back without the user explicitly opting in.

## Schema

Camera data follows the JSON Schema defined in `data/schema.json`. The root object is a GeoJSON `FeatureCollection`; each feature is a `Point` with the following properties:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✓ | Unique camera identifier |
| `vendor` | enum | ✓ | `flock_safety` · `vigilant` · `motorola` · `unknown` |
| `status` | enum | ✓ | `active` · `inactive` · `unverified` |
| `last_verified` | ISO-8601 | ✓ | When the community last confirmed this camera |
| `avoid_radius_meters` | number | — | Buffer radius for route avoidance (default 50 m) |
| `address` | string | — | Street address |
| `notes` | string | — | Freeform community notes |

### Example Feature

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [-122.4194, 37.7749]
  },
  "properties": {
    "id": "flock_sf_001",
    "vendor": "flock_safety",
    "status": "active",
    "last_verified": "2025-03-15T12:00:00Z",
    "avoid_radius_meters": 50,
    "address": "Market St & 5th St, San Francisco, CA",
    "notes": "Pole-mounted, north-facing"
  }
}
```

## Sync Behaviour

1. On app start, `DeflockSync.needsSync()` checks whether the last sync is older than `syncIntervalMinutes` (default 60).
2. If a sync is needed, `DeflockSync.fetchAndStore()` fetches the GeoJSON endpoint with no-referrer headers and no session token.
3. The response is validated (type, geometry, vendor enum, status enum, coordinates range).
4. Valid features are upserted into `CameraDatabase` (in-memory, keyed by `id`).
5. The Redux `cameras` slice records the sync timestamp and count.

Sync can also be triggered manually from Settings → Camera Data → Sync Now.

## Route Avoidance

When calculating a route, `routeSlice.calculateRoute` queries `CameraDatabase` for all active cameras within the bounding box of the origin–destination pair, filtered by the vendor avoidance settings. These cameras are passed to `ValhallaRouter` as `avoid_locations`:

```typescript
avoid_locations: cameras.map(c => ({
  lat: c.location.latitude,
  lon: c.location.longitude,
  radius: avoidRadiusMeters,
}))
```

Valhalla's cost model penalises routing through these points. If avoidance would make the route impossibly long, Valhalla will find the best available path through the fewest cameras.

## Map Display

`CameraLayer` renders cameras as coloured dots on the map:

| Vendor | Colour |
|--------|--------|
| Flock Safety | Red `#FF3B30` |
| Vigilant | Orange `#FF9500` |
| Motorola | Yellow `#FFCC00` |
| Unknown | Grey `#8E8E93` |

Inactive cameras are shown at reduced opacity. Only cameras at zoom ≥ 12 are loaded to keep rendering performant.

## Running the Sync Script

To fetch and cache camera data offline (e.g. for CI or self-hosting):

```bash
python3 scripts/sync-deflock.py
# Output: data/cameras/cameras.geojson
```

With a custom endpoint:

```bash
python3 scripts/sync-deflock.py --endpoint https://your-mirror.example/cameras.geojson
```

The script validates the response against `data/schema.json` before writing. CI runs the schema validation step on every push.

## Accuracy & Disclaimer

Camera data is community-contributed and may be incomplete, outdated, or incorrect. ClearPath makes no warranty about the presence or absence of ALPR cameras on any given route. Always obey traffic laws regardless of camera presence.

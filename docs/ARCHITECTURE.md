# ClearPath Architecture

ClearPath is a privacy-first React Native navigation app. Every design decision prioritises keeping sensitive location data on-device and giving the user full control over what — if anything — leaves their phone.

## Layer Overview

```
┌─────────────────────────────────────────────────────┐
│                     App.tsx                         │
│          Redux Provider + Navigation Container       │
└───────────────┬─────────────────────────────────────┘
                │
   ┌────────────▼────────────┐
   │         Screens         │
   │  MapScreen / Search /   │
   │     Settings            │
   └────────────┬────────────┘
                │
   ┌────────────▼────────────┐
   │       Components        │
   │  ClearpathMap           │
   │  CameraLayer            │
   │  RouteLayer             │
   │  TurnByTurn             │
   │  SearchBar              │
   └──────┬───────┬──────────┘
          │       │
   ┌──────▼──┐ ┌──▼────────────────────────────────────┐
   │ Redux   │ │            Services                    │
   │ Store   │ │  ValhallaRouter  DeflockSync           │
   │ 4 slices│ │  CameraDatabase  LocationService       │
   └──────┬──┘ │  TileManager     CarPlayService        │
          │    │  AndroidAutoService                    │
          │    └───────────────────────────────────────┘
          │
   ┌──────▼───────────────────┐
   │      Persistence         │
   │  AsyncStorage (settings) │
   │  In-memory camera DB     │
   │  MapLibre tile cache     │
   └──────────────────────────┘
```

## Redux Store

Four slices, all managed by Redux Toolkit:

| Slice | Responsibility |
|-------|---------------|
| `map` | Viewport (center, zoom, bearing, pitch), map style, follow-user flag |
| `route` | Active route, navigation state, routing status/error |
| `cameras` | Visible cameras in viewport, sync status |
| `settings` | Persisted user preferences (travel mode, avoidance, privacy flags) |

Only the `settings` slice is persisted via `redux-persist` + `AsyncStorage`. All other slices reset on app restart, ensuring no stale location history is stored.

## Data Flow: Routing

```
User selects destination
        │
        ▼
MapScreen.handleSearchResult()
        │
        ├── CameraDatabase.getCamerasInBounds()   ← local DB query only
        │
        ▼
ValhallaRouter.route({
  origin, destination, travelMode,
  avoid_locations: [ { lat, lon, radius } ... ]   ← camera avoidance
})
        │
        ▼  (HTTP POST to Valhalla endpoint)
Valhalla routing engine
        │
        ▼
routeSlice.calculateRoute.fulfilled
        │
        ▼
RouteLayer renders GeoJSON geometry
TurnByTurn shows step-by-step instructions
CarPlayService / AndroidAutoService sync to vehicle display
```

**What the routing server sees**: origin + destination coordinates + a list of lat/lon points to avoid. No user ID, device ID, or session token is sent.

## Data Flow: Camera Data

```
DeflockSync.fetchAndStore(endpoint)
        │
        ▼  (HTTP GET, no-referrer, no session)
DeFlock GeoJSON endpoint
        │
        ▼
CameraDatabase.ingestGeoJSON()
        │  (stores to in-memory Map; future: SQLite)
        ▼
cameraSlice.loadVisibleCameras(bounds)
        │
        ▼
CameraLayer renders dots on map
```

## Services

### ValhallaRouter
Wraps the [Valhalla](https://valhalla.readthedocs.io/) HTTP API. The default endpoint is `valhalla1.openstreetmap.de` (public, no auth). Users can configure a self-hosted instance via Settings → Privacy → Local routing only.

### DeflockSync
Fetches GeoJSON from [DeFlock](https://deflock.me/) (community ALPR map). Validates the response against `data/schema.json` before storing. Background sync interval is configurable; default 60 minutes.

### CameraDatabase
In-memory singleton backed by a `Map<string, CameraRecord>`. Camera queries are fully local — no network request is made when loading visible cameras on the map.

### LocationService
Wraps `@react-native-community/geolocation`. Emits location updates to registered callbacks. Location data never leaves the app — it is used only for map centering and navigation progress tracking.

### TileManager
Manages the MapLibre offline tile cache via `react-native-fs`. Provides cache eviction (by age) and size reporting.

### CarPlayService / AndroidAutoService
Bridge services that forward navigation state updates to the vehicle display via React Native's `NativeModules` bridge.

## File Count

| Category | Files |
|----------|-------|
| TypeScript types | 1 |
| Redux store (index + 4 slices) | 5 |
| Services | 7 |
| Map components | 3 |
| Navigation/search components | 2 |
| Screens | 3 |
| Utilities | 2 |
| App root | 3 (App.tsx, index.js, app.json) |
| Native (Swift/Kotlin) | 2 |
| Config | 3 (tsconfig, babel, metro) |
| Data schema | 1 |
| Scripts | 2 |
| GitHub Actions | 2 |
| Documentation | 4 |
| **Total** | **40+** |

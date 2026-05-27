# ClearPath

**Privacy-first navigation that routes around Flock Safety ALPR cameras.**

ClearPath is a React Native app that uses [DeFlock](https://deflock.me/) community data and the [Valhalla](https://valhalla.readthedocs.io/) routing engine to generate driving, cycling, and walking directions that avoid Automatic Licence Plate Recognition (ALPR) cameras.

Zero telemetry. No accounts. MIT license.

---

## Features

- **ALPR avoidance** — Routes around Flock Safety, Vigilant, Motorola, and unknown-vendor cameras using Valhalla's `avoid_locations` API.
- **Live camera map** — Community-sourced camera markers from DeFlock rendered on a MapLibre map.
- **Turn-by-turn navigation** — Step-by-step directions with distance and ETA.
- **CarPlay & Android Auto** — Full vehicle display support.
- **Privacy-first** — No analytics, no accounts, no location uploads. See [PRIVACY.md](docs/PRIVACY.md).
- **Offline capable** — Download tiles and camera data; configure a local Valhalla instance for fully air-gapped operation.

## Quick Start

### Prerequisites

- Node.js 20+
- React Native CLI
- Xcode 14+ (iOS) or Android Studio (Android)

### Install

```bash
git clone https://github.com/muldoon711/clearpath.git
cd clearpath
npm install
```

### iOS

```bash
cd ios && pod install && cd ..
npx react-native run-ios
```

### Android

```bash
npx react-native run-android
```

## Syncing Camera Data

```bash
python3 scripts/sync-deflock.py
```

See [CAMERA_DATA.md](docs/CAMERA_DATA.md) for schema documentation and self-hosting instructions.

## Configuration

All settings are in the app under the Settings tab:

| Setting | Default | Description |
|---------|---------|-------------|
| Travel mode | Car | auto / bicycle / pedestrian |
| Avoid Flock Safety | On | Route around Flock cameras |
| Avoid Vigilant/Motorola | On | Route around commercial cameras |
| Avoidance radius | 50 m | Buffer around each camera |
| Local routing only | Off | Use self-hosted Valhalla |
| Offline tiles only | Off | Never fetch tile CDN |
| Sync interval | 60 min | Background camera data refresh |

## Architecture

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for a full breakdown of the service layer, Redux store, and data flows.

## CarPlay / Android Auto

See [CARPLAY.md](docs/CARPLAY.md) for setup instructions and entitlement requirements.

## Privacy

See [PRIVACY.md](docs/PRIVACY.md) for a full audit of what data leaves the device and how to achieve fully local operation.

## CI

Every push runs:

1. TypeScript type check
2. ESLint
3. Unit tests
4. **Privacy audit** — static scan for telemetry patterns
5. JSON Schema validation for camera data

## License

MIT — see [LICENSE](LICENSE).

## Contributing

1. Fork the repo
2. Create a feature branch
3. Ensure `npm run privacy-audit` passes
4. Open a pull request

Camera data contributions should go directly to [DeFlock](https://deflock.me/).

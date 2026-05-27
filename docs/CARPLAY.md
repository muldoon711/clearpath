# CarPlay & Android Auto Integration

ClearPath supports both CarPlay (iOS) and Android Auto so navigation continues on the vehicle display while the phone stays in your pocket.

## Architecture

The integration uses two layers:

1. **Native module** (Swift/Kotlin) — registers with the platform's car app framework and owns the vehicle-side UI.
2. **React Native bridge service** (TypeScript) — forwards Redux navigation state to the native module via `NativeModules`.

```
Redux store (navigation state)
        │
        ▼
CarPlayService / AndroidAutoService   ← TypeScript bridge
        │
        ▼
NativeModules.CarPlayModule /          ← RN bridge
NativeModules.AndroidAutoModule
        │
        ▼
CarPlaySceneDelegate (Swift)           ← native CarPlay UI
AndroidAutoCarScreen (Kotlin)          ← native Auto UI
```

## CarPlay (iOS)

### Requirements

- Xcode 14+
- `com.apple.developer.carplay-navigation` entitlement (requires Apple approval for production)
- Info.plist entry: `CPSupportedTemplates` → `CPMapTemplate`
- Scene configuration: `CPTemplateApplicationScene` with delegate `CarPlaySceneDelegate`

### Setup

1. Add the CarPlay entitlement in Xcode → Signing & Capabilities → + CarPlay.
2. Set `CarPlaySceneDelegate` as the scene delegate class in Info.plist under `UIApplicationSceneManifest`.
3. Link `CarPlay.framework` (automatically linked on iOS 14+).

### What the vehicle display shows

- **Map view** — MapLibre renders to the CarPlay window via `CPMapTemplate`.
- **Maneuver card** — Current instruction, distance to next turn.
- **Trip progress bar** — Remaining distance and ETA.
- **Off-route banner** — Appears when `isOffRoute` is true.

### Entitlement note

For development/testing you do **not** need the production entitlement — the CarPlay Simulator in Xcode works without it.

## Android Auto

### Requirements

- `androidx.car.app:app:1.4.0` (Car App Library)
- `android.hardware.type.automotive` **not** required (phone projection mode)
- Declare `CarAppService` in `AndroidManifest.xml`

### Setup

1. Add the Car App Library dependency to `android/app/build.gradle`:
   ```groovy
   implementation "androidx.car.app:app:1.4.0"
   ```
2. Declare the service in `AndroidManifest.xml`:
   ```xml
   <service
       android:name=".ClearPathCarAppService"
       android:exported="true">
     <intent-filter>
       <action android:name="androidx.car.app.CarAppService" />
       <category android:name="androidx.car.app.category.NAVIGATION" />
     </intent-filter>
   </service>
   ```
3. Register `AndroidAutoModule` in your `ReactPackage`.

### What the vehicle display shows

- **Navigation template** — Turn card with maneuver arrow, distance, instruction.
- **Step list** — Upcoming maneuvers scrollable list.
- **Arrival card** — Shown when `stopNavigation()` is called.

## State Sync

Both services listen for Redux navigation updates in `MapScreen.tsx`:

```typescript
if (carPlay.connected) {
  carPlay.updateManeuver(nav, step.instruction, units);
}
if (androidAuto.connected) {
  androidAuto.sendStep(nav, step.instruction, step.maneuverType, units);
}
```

Updates are sent on every location tick (~1 Hz), ensuring the vehicle display stays in sync without any polling.

## Privacy

Neither CarPlay nor Android Auto integration sends location data to external services. The car display is a local mirror of the phone's navigation state — all routing computation happens on-device first.

// ─── Core geographic primitives ───────────────────────────────────────────────

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

// ─── ALPR Camera ───────────────────────────────────────────────────────────────

export type CameraVendor = 'flock_safety' | 'vigilant' | 'motorola' | 'unknown';
export type CameraStatus = 'active' | 'inactive' | 'unverified';

export interface ALPRCamera {
  id: string;
  location: LatLng;
  vendor: CameraVendor;
  status: CameraStatus;
  /** ISO-8601 timestamp of last community verification */
  lastVerified: string;
  /** Radius in metres to buffer around camera for route avoidance */
  avoidRadiusMeters: number;
  address?: string;
  notes?: string;
}

export interface CameraAvoidLocation {
  lat: number;
  lon: number;
  radius: number; // metres
}

// ─── DeFlock data structures ──────────────────────────────────────────────────

export interface DeflockFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    id: string;
    vendor: CameraVendor;
    status: CameraStatus;
    last_verified: string;
    avoid_radius_meters?: number;
    address?: string;
    notes?: string;
  };
}

export interface DeflockGeoJSON {
  type: 'FeatureCollection';
  generated_at: string;
  features: DeflockFeature[];
}

// ─── Routing ───────────────────────────────────────────────────────────────────

export type TravelMode = 'auto' | 'bicycle' | 'pedestrian';
export type RouteStatus = 'idle' | 'calculating' | 'active' | 'arrived' | 'error';

export interface RouteStep {
  instruction: string;
  distance: number; // metres
  duration: number; // seconds
  maneuverType: string;
  maneuverModifier?: string;
  location: LatLng;
  bearing?: number;
}

export interface Route {
  id: string;
  origin: LatLng;
  destination: LatLng;
  steps: RouteStep[];
  /** GeoJSON LineString coordinates [lng, lat] pairs */
  geometry: [number, number][];
  totalDistance: number; // metres
  totalDuration: number; // seconds
  cameraCount: number;
  travelMode: TravelMode;
  avoidedCameraIds: string[];
}

export interface ValhallaRouteRequest {
  locations: Array<{ lat: number; lon: number }>;
  costing: TravelMode;
  avoid_locations?: CameraAvoidLocation[];
  directions_options?: {
    units?: 'kilometers' | 'miles';
    language?: string;
  };
}

export interface ValhallaManeuver {
  type: number;
  instruction: string;
  length: number;
  time: number;
  begin_shape_index: number;
  end_shape_index: number;
  verbal_pre_transition_instruction?: string;
  verbal_post_transition_instruction?: string;
}

export interface ValhallaLeg {
  maneuvers: ValhallaManeuver[];
  shape: string; // encoded polyline
  summary: {
    length: number;
    time: number;
  };
}

export interface ValhallaResponse {
  trip: {
    legs: ValhallaLeg[];
    summary: {
      length: number;
      time: number;
    };
    status: number;
    status_message: string;
  };
}

// ─── Navigation ────────────────────────────────────────────────────────────────

export interface NavigationState {
  currentStepIndex: number;
  distanceToNextManeuver: number; // metres
  remainingDistance: number; // metres
  remainingDuration: number; // seconds
  isOffRoute: boolean;
  speedMetersPerSecond: number;
}

// ─── Map ───────────────────────────────────────────────────────────────────────

export type MapStyle = 'streets' | 'satellite' | 'dark' | 'topo';

export interface MapState {
  center: LatLng;
  zoom: number;
  bearing: number;
  pitch: number;
  isFollowingUser: boolean;
  mapStyle: MapStyle;
  showCameras: boolean;
}

// ─── Settings ──────────────────────────────────────────────────────────────────

export type Units = 'metric' | 'imperial';
export type Language = 'en' | 'es' | 'fr' | 'de';

export interface PrivacySettings {
  /** Never send location to any external service */
  localRoutingOnly: boolean;
  /** Strip all analytics/telemetry */
  noTelemetry: boolean;
  /** Use local tile cache only — no tile CDN requests */
  offlineTilesOnly: boolean;
}

export interface AvoidanceSettings {
  avoidFlockSafety: boolean;
  avoidVigilant: boolean;
  avoidMotorola: boolean;
  avoidUnknown: boolean;
  /** Buffer radius in metres around each camera */
  avoidRadiusMeters: number;
}

export interface NotificationSettings {
  /** Announce upcoming cameras via TTS */
  announceCameras: boolean;
  /** Distance (metres) at which to warn */
  cameraWarningDistanceMeters: number;
}

export interface AppSettings {
  travelMode: TravelMode;
  units: Units;
  language: Language;
  mapStyle: MapStyle;
  privacy: PrivacySettings;
  avoidance: AvoidanceSettings;
  notifications: NotificationSettings;
  valhallaEndpoint: string;
  deflockEndpoint: string;
  /** How often (minutes) to sync camera data in background */
  syncIntervalMinutes: number;
}

// ─── Search ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  location: LatLng;
  type: 'address' | 'poi' | 'coordinate';
}

// ─── Tile cache ────────────────────────────────────────────────────────────────

export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

export interface TileCacheStats {
  totalTiles: number;
  totalBytes: number;
  oldestEntry: string;
  newestEntry: string;
}

// ─── Sync ──────────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSync: string | null;
  cameraCount: number;
  error: string | null;
}

import { Platform, PermissionsAndroid } from 'react-native';
import type { LatLng, NavigationState } from '../types';
import { haversineDistance, bearing } from '../utils/geo';

type LocationCallback = (location: LatLng, heading: number, speed: number) => void;
type ErrorCallback = (error: string) => void;

interface LocationServiceOptions {
  distanceFilter?: number; // metres
  desiredAccuracy?: 'best' | 'navigation' | 'hundred-meters';
  onLocation?: LocationCallback;
  onError?: ErrorCallback;
}

/**
 * Wraps the React Native Geolocation API.
 * All location data stays on-device — never forwarded to analytics.
 */
export default class LocationService {
  private static instance: LocationService;
  private watchId: ReturnType<typeof setInterval> | null = null;
  private lastPosition: LatLng | null = null;
  private callbacks = new Set<LocationCallback>();
  private errorCallbacks = new Set<ErrorCallback>();
  private isTracking = false;

  private constructor() {}

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'ClearPath Location Permission',
          message:
            'ClearPath needs your location to navigate. Location data never leaves your device.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    }
    // iOS permissions are handled via Info.plist + Geolocation.requestAuthorization
    return true;
  }

  startTracking(options: LocationServiceOptions = {}): void {
    if (this.isTracking) return;
    this.isTracking = true;

    if (options.onLocation) this.callbacks.add(options.onLocation);
    if (options.onError) this.errorCallbacks.add(options.onError);

    const Geolocation = require('@react-native-community/geolocation').default;

    Geolocation.watchPosition(
      (pos: { coords: { latitude: number; longitude: number; speed: number | null; heading: number | null } }) => {
        const current: LatLng = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        const speed = pos.coords.speed ?? 0;
        const hdg = pos.coords.heading ?? 0;
        this.lastPosition = current;
        this.callbacks.forEach(cb => cb(current, hdg, speed));
      },
      (err: { message: string }) => {
        this.errorCallbacks.forEach(cb => cb(err.message));
      },
      {
        enableHighAccuracy: true,
        distanceFilter: options.distanceFilter ?? 5,
        interval: 1000,
        fastestInterval: 500,
      },
    );
  }

  stopTracking(): void {
    const Geolocation = require('@react-native-community/geolocation').default;
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId as unknown as number);
      this.watchId = null;
    }
    this.isTracking = false;
    this.callbacks.clear();
    this.errorCallbacks.clear();
  }

  getLastPosition(): LatLng | null {
    return this.lastPosition;
  }

  async getCurrentPosition(): Promise<LatLng> {
    return new Promise((resolve, reject) => {
      const Geolocation = require('@react-native-community/geolocation').default;
      Geolocation.getCurrentPosition(
        (pos: { coords: { latitude: number; longitude: number } }) =>
          resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err: { message: string }) => reject(new Error(err.message)),
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 5_000 },
      );
    });
  }

  /** Calculate navigation state relative to a route step */
  computeNavigationState(
    current: LatLng,
    speed: number,
    stepLocation: LatLng,
    remainingDistance: number,
    remainingDuration: number,
  ): NavigationState {
    const distanceToNext = haversineDistance(current, stepLocation);
    const isOffRoute = distanceToNext > 50; // metres threshold

    return {
      currentStepIndex: 0, // updated by caller
      distanceToNextManeuver: distanceToNext,
      remainingDistance,
      remainingDuration,
      isOffRoute,
      speedMetersPerSecond: speed,
    };
  }
}

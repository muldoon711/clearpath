import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import type { Route, NavigationState, LatLng } from '../types';
import { formatDistance, formatDuration } from '../utils/geo';

const { CarPlayModule } = NativeModules;

/**
 * Bridges React Native navigation state to the CarPlay dashboard.
 * The native CarPlaySceneDelegate (iOS) renders the map and turn card;
 * this service keeps it in sync with the Redux-driven navigation state.
 */
export default class CarPlayService {
  private static instance: CarPlayService;
  private emitter: NativeEventEmitter | null = null;
  private isConnected = false;

  private constructor() {
    if (Platform.OS !== 'ios' || !CarPlayModule) return;
    this.emitter = new NativeEventEmitter(CarPlayModule);
    this.emitter.addListener('CarPlay:Connected', this.onConnected.bind(this));
    this.emitter.addListener('CarPlay:Disconnected', this.onDisconnected.bind(this));
  }

  static getInstance(): CarPlayService {
    if (!CarPlayService.instance) {
      CarPlayService.instance = new CarPlayService();
    }
    return CarPlayService.instance;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  /** Push a new active route to the CarPlay trip UI */
  startTrip(route: Route): void {
    if (!this.isConnected || !CarPlayModule) return;
    CarPlayModule.startTrip({
      routeId: route.id,
      destinationLabel: this.formatDestination(route.destination),
      totalDistanceKm: route.totalDistance / 1000,
      estimatedArrival: new Date(Date.now() + route.totalDuration * 1000).toISOString(),
      stepsCount: route.steps.length,
    });
  }

  /** Update the currently displayed maneuver card */
  updateManeuver(navState: NavigationState, stepInstruction: string, units: 'metric' | 'imperial'): void {
    if (!this.isConnected || !CarPlayModule) return;
    CarPlayModule.updateManeuver({
      instruction: stepInstruction,
      distanceLabel: formatDistance(navState.distanceToNextManeuver, units),
      remainingLabel: `${formatDuration(navState.remainingDuration)} · ${formatDistance(navState.remainingDistance, units)}`,
      isOffRoute: navState.isOffRoute,
    });
  }

  /** Signal arrival to CarPlay so it can show the arrival card */
  endTrip(): void {
    if (!this.isConnected || !CarPlayModule) return;
    CarPlayModule.endTrip();
  }

  /** Update the map center for the CarPlay display */
  updateMapCenter(center: LatLng, zoom: number): void {
    if (!this.isConnected || !CarPlayModule) return;
    CarPlayModule.updateMapCenter({
      latitude: center.latitude,
      longitude: center.longitude,
      zoom,
    });
  }

  private onConnected(): void {
    this.isConnected = true;
  }

  private onDisconnected(): void {
    this.isConnected = false;
  }

  private formatDestination(destination: LatLng): string {
    return `${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)}`;
  }
}

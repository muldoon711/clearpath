import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import type { Route, NavigationState } from '../types';
import { formatDistance, formatDuration } from '../utils/geo';

const { AndroidAutoModule } = NativeModules;

/**
 * Bridges React Native navigation state to Android Auto.
 * The native AndroidAutoModule (Kotlin) renders via the Car App Library;
 * this service keeps it synchronized with Redux navigation state.
 */
export default class AndroidAutoService {
  private static instance: AndroidAutoService;
  private emitter: NativeEventEmitter | null = null;
  private isConnected = false;

  private constructor() {
    if (Platform.OS !== 'android' || !AndroidAutoModule) return;
    this.emitter = new NativeEventEmitter(AndroidAutoModule);
    this.emitter.addListener('AndroidAuto:Connected', this.onConnected.bind(this));
    this.emitter.addListener('AndroidAuto:Disconnected', this.onDisconnected.bind(this));
  }

  static getInstance(): AndroidAutoService {
    if (!AndroidAutoService.instance) {
      AndroidAutoService.instance = new AndroidAutoService();
    }
    return AndroidAutoService.instance;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  /** Send the active route metadata to Android Auto */
  startNavigation(route: Route): void {
    if (!this.isConnected || !AndroidAutoModule) return;
    AndroidAutoModule.startNavigation({
      routeId: route.id,
      totalDistanceMeters: route.totalDistance,
      totalDurationSeconds: route.totalDuration,
      stepsCount: route.steps.length,
      destinationLat: route.destination.latitude,
      destinationLng: route.destination.longitude,
    });
  }

  /** Push the current maneuver update to Android Auto's turn card */
  sendStep(
    navState: NavigationState,
    instruction: string,
    maneuverType: string,
    units: 'metric' | 'imperial',
  ): void {
    if (!this.isConnected || !AndroidAutoModule) return;
    AndroidAutoModule.sendStep({
      instruction,
      maneuverType,
      distanceLabel: formatDistance(navState.distanceToNextManeuver, units),
      remainingLabel: `${formatDuration(navState.remainingDuration)} · ${formatDistance(
        navState.remainingDistance,
        units,
      )}`,
      isOffRoute: navState.isOffRoute,
    });
  }

  /** Notify Android Auto of arrival */
  stopNavigation(): void {
    if (!this.isConnected || !AndroidAutoModule) return;
    AndroidAutoModule.stopNavigation();
  }

  private onConnected(): void {
    this.isConnected = true;
  }

  private onDisconnected(): void {
    this.isConnected = false;
  }
}

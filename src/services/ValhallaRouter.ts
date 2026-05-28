import type {
  ALPRCamera,
  LatLng,
  Route,
  RouteStep,
  TravelMode,
  ValhallaRouteRequest,
  ValhallaResponse,
  ValhallaManeuver,
} from '../types';
import { decodePolyline } from '../utils/geo';
import { privacyFetchHeaders } from '../utils/privacy';

interface RouterOptions {
  origin: LatLng;
  destination: LatLng;
  travelMode: TravelMode;
  avoidCameras: ALPRCamera[];
  avoidRadiusMeters: number;
  endpoint: string;
}

/**
 * Thin wrapper around the Valhalla routing API.
 *
 * Camera locations are passed as `avoid_locations` so Valhalla's
 * routing engine penalises paths that pass within `avoidRadiusMeters`
 * of any ALPR camera — entirely server-side, with no PII sent.
 */
export default class ValhallaRouter {
  private static instance: ValhallaRouter;

  private constructor() {}

  static getInstance(): ValhallaRouter {
    if (!ValhallaRouter.instance) {
      ValhallaRouter.instance = new ValhallaRouter();
    }
    return ValhallaRouter.instance;
  }

  async route(options: RouterOptions): Promise<Route | null> {
    const { origin, destination, travelMode, avoidCameras, avoidRadiusMeters, endpoint } = options;

    const body: ValhallaRouteRequest = {
      locations: [
        { lat: origin.latitude, lon: origin.longitude },
        { lat: destination.latitude, lon: destination.longitude },
      ],
      costing: travelMode,
      directions_options: { units: 'kilometers', language: 'en-US' },
    };

    if (avoidCameras.length > 0) {
      body.avoid_locations = avoidCameras.map((c) => ({
        lat: c.location.latitude,
        lon: c.location.longitude,
        radius: avoidRadiusMeters,
      }));
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...privacyFetchHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.warn('[ValhallaRouter] Network error:', err);
      return null;
    }

    if (!response.ok) {
      console.warn('[ValhallaRouter] HTTP error:', response.status);
      return null;
    }

    const data: ValhallaResponse = await response.json();

    if (data.trip.status !== 0) {
      console.warn('[ValhallaRouter] Routing error:', data.trip.status_message);
      return null;
    }

    return this.parseResponse(data, origin, destination, travelMode, avoidCameras);
  }

  private parseResponse(
    data: ValhallaResponse,
    origin: LatLng,
    destination: LatLng,
    travelMode: TravelMode,
    avoidedCameras: ALPRCamera[],
  ): Route {
    const leg = data.trip.legs[0];
    const geometry = decodePolyline(leg.shape, 6);
    const steps: RouteStep[] = leg.maneuvers.map((m) => this.maneuverToStep(m, geometry));

    return {
      id: `route_${Date.now()}`,
      origin,
      destination,
      steps,
      geometry,
      totalDistance: leg.summary.length * 1000, // km → m
      totalDuration: leg.summary.time,
      cameraCount: avoidedCameras.length,
      travelMode,
      avoidedCameraIds: avoidedCameras.map((c) => c.id),
    };
  }

  private maneuverToStep(maneuver: ValhallaManeuver, geometry: [number, number][]): RouteStep {
    const [lng, lat] = geometry[maneuver.begin_shape_index] ?? [0, 0];
    return {
      instruction: maneuver.verbal_pre_transition_instruction ?? maneuver.instruction,
      distance: maneuver.length * 1000, // km → m
      duration: maneuver.time,
      maneuverType: MANEUVER_TYPES[maneuver.type] ?? 'continue',
      location: { latitude: lat, longitude: lng },
    };
  }
}

const MANEUVER_TYPES: Record<number, string> = {
  0: 'none',
  1: 'start',
  2: 'start_right',
  3: 'start_left',
  4: 'destination',
  5: 'destination_right',
  6: 'destination_left',
  7: 'becomes',
  8: 'continue',
  9: 'slight_right',
  10: 'right',
  11: 'sharp_right',
  12: 'u_turn_right',
  13: 'u_turn_left',
  14: 'sharp_left',
  15: 'left',
  16: 'slight_left',
  17: 'ramp_straight',
  18: 'ramp_right',
  19: 'ramp_left',
  20: 'exit_right',
  21: 'exit_left',
  22: 'stay_straight',
  23: 'stay_right',
  24: 'stay_left',
  25: 'merge',
  26: 'roundabout_enter',
  27: 'roundabout_exit',
  28: 'ferry_enter',
  29: 'ferry_exit',
};

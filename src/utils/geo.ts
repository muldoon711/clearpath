import type { LatLng, BoundingBox, TileCoordinate } from '../types';

const EARTH_RADIUS_M = 6_371_000;

/** Haversine distance in metres between two coordinates */
export function haversineDistance(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c =
    sinDLat * sinDLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(c));
}

/** Bearing in degrees (0-360) from a to b */
export function bearing(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Move a point by deltaMetres in a given bearing (degrees) */
export function destinationPoint(origin: LatLng, distanceMeters: number, bearingDeg: number): LatLng {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const d = distanceMeters / EARTH_RADIUS_M;
  const brng = toRad(bearingDeg);
  const lat1 = toRad(origin.latitude);
  const lng1 = toRad(origin.longitude);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { latitude: toDeg(lat2), longitude: toDeg(lng2) };
}

/** Expand a bounding box by a given distance in metres on all sides */
export function expandBounds(bounds: BoundingBox, metres: number): BoundingBox {
  const degLat = metres / EARTH_RADIUS_M * (180 / Math.PI);
  const degLng = degLat / Math.cos(((bounds.minLat + bounds.maxLat) / 2) * (Math.PI / 180));
  return {
    minLat: bounds.minLat - degLat,
    minLng: bounds.minLng - degLng,
    maxLat: bounds.maxLat + degLat,
    maxLng: bounds.maxLng + degLng,
  };
}

/** Whether a coordinate lies within a bounding box */
export function isInBounds(point: LatLng, bounds: BoundingBox): boolean {
  return (
    point.latitude >= bounds.minLat &&
    point.latitude <= bounds.maxLat &&
    point.longitude >= bounds.minLng &&
    point.longitude <= bounds.maxLng
  );
}

/** Convert a route geometry ([lng, lat] pairs) to a BoundingBox */
export function geometryBounds(coords: [number, number][]): BoundingBox {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [lng, lat] of coords) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return { minLat, minLng, maxLat, maxLng };
}

/** Snap zoom level to valid MapLibre range [0, 22] */
export function clampZoom(zoom: number): number {
  return Math.max(0, Math.min(22, zoom));
}

/** XYZ tile coordinate for a lat/lng at a given zoom level */
export function latLngToTile(point: LatLng, zoom: number): TileCoordinate {
  const z = Math.floor(zoom);
  const x = Math.floor(((point.longitude + 180) / 360) * Math.pow(2, z));
  const latRad = (point.latitude * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, z),
  );
  return { z, x, y };
}

/** Format a distance for display given the units setting */
export function formatDistance(metres: number, units: 'metric' | 'imperial'): string {
  if (units === 'imperial') {
    const feet = metres * 3.28084;
    if (feet < 1000) return `${Math.round(feet)} ft`;
    const miles = feet / 5280;
    return `${miles.toFixed(1)} mi`;
  }
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** Format a duration in seconds to a human-readable string */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

/**
 * Decode a Valhalla/OSRM encoded polyline into [lng, lat] coordinate pairs.
 * Uses precision=6 (Valhalla default).
 */
export function decodePolyline(encoded: string, precision = 6): [number, number][] {
  const factor = Math.pow(10, precision);
  const coords: [number, number][] = [];
  let lat = 0;
  let lng = 0;
  let i = 0;

  while (i < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / factor, lat / factor]);
  }
  return coords;
}

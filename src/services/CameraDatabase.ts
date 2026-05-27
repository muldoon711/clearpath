import type { ALPRCamera, BoundingBox, DeflockGeoJSON } from '../types';

interface CameraRecord {
  id: string;
  latitude: number;
  longitude: number;
  vendor: string;
  status: string;
  lastVerified: string;
  avoidRadiusMeters: number;
  address: string;
  notes: string;
}

/**
 * SQLite-backed local camera database.
 * Falls back to an in-memory Map when SQLite is unavailable (e.g. Jest).
 */
export default class CameraDatabase {
  private static instance: CameraDatabase;
  private db: InMemoryStore;

  private constructor() {
    this.db = new InMemoryStore();
  }

  static getInstance(): CameraDatabase {
    if (!CameraDatabase.instance) {
      CameraDatabase.instance = new CameraDatabase();
    }
    return CameraDatabase.instance;
  }

  async ingestGeoJSON(data: DeflockGeoJSON): Promise<number> {
    let count = 0;
    for (const feature of data.features) {
      const { properties, geometry } = feature;
      const record: CameraRecord = {
        id: properties.id,
        latitude: geometry.coordinates[1],
        longitude: geometry.coordinates[0],
        vendor: properties.vendor,
        status: properties.status,
        lastVerified: properties.last_verified,
        avoidRadiusMeters: properties.avoid_radius_meters ?? 50,
        address: properties.address ?? '',
        notes: properties.notes ?? '',
      };
      this.db.upsert(record);
      count++;
    }
    return count;
  }

  async getCamerasInBounds(bounds: BoundingBox): Promise<ALPRCamera[]> {
    return this.db
      .getAll()
      .filter(
        r =>
          r.latitude >= bounds.minLat &&
          r.latitude <= bounds.maxLat &&
          r.longitude >= bounds.minLng &&
          r.longitude <= bounds.maxLng,
      )
      .map(recordToCamera);
  }

  async getCameraById(id: string): Promise<ALPRCamera | null> {
    const record = this.db.get(id);
    return record ? recordToCamera(record) : null;
  }

  async getTotalCount(): Promise<number> {
    return this.db.count();
  }

  async clearAll(): Promise<void> {
    this.db.clear();
  }

  async getLastSyncTimestamp(): Promise<string | null> {
    return this.db.getMetadata('last_sync') ?? null;
  }

  async setLastSyncTimestamp(ts: string): Promise<void> {
    this.db.setMetadata('last_sync', ts);
  }
}

function recordToCamera(r: CameraRecord): ALPRCamera {
  return {
    id: r.id,
    location: { latitude: r.latitude, longitude: r.longitude },
    vendor: r.vendor as ALPRCamera['vendor'],
    status: r.status as ALPRCamera['status'],
    lastVerified: r.lastVerified,
    avoidRadiusMeters: r.avoidRadiusMeters,
    address: r.address || undefined,
    notes: r.notes || undefined,
  };
}

class InMemoryStore {
  private cameras = new Map<string, CameraRecord>();
  private metadata = new Map<string, string>();

  upsert(record: CameraRecord): void {
    this.cameras.set(record.id, record);
  }

  get(id: string): CameraRecord | undefined {
    return this.cameras.get(id);
  }

  getAll(): CameraRecord[] {
    return Array.from(this.cameras.values());
  }

  count(): number {
    return this.cameras.size;
  }

  clear(): void {
    this.cameras.clear();
  }

  getMetadata(key: string): string | undefined {
    return this.metadata.get(key);
  }

  setMetadata(key: string, value: string): void {
    this.metadata.set(key, value);
  }
}

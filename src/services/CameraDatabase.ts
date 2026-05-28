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

type OPSQLiteConnection = {
  execute: (sql: string, params?: unknown[]) => Promise<{ rows: { _array: unknown[] } }>;
  transaction: (fn: (tx: OPSQLiteConnection) => Promise<void>) => Promise<void>;
  close: () => Promise<void>;
};

/**
 * Camera database with SQLite persistence via @op-engineering/op-sqlite.
 * Falls back to an in-memory store in Jest / environments without native modules.
 */
export default class CameraDatabase {
  private static instance: CameraDatabase;
  private sqliteDb: OPSQLiteConnection | null = null;
  private fallback: InMemoryStore | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): CameraDatabase {
    if (!CameraDatabase.instance) {
      CameraDatabase.instance = new CameraDatabase();
    }
    return CameraDatabase.instance;
  }

  // ── Initialization ──────────────────────────────────────────────────────────

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const { open } = require('@op-engineering/op-sqlite') as {
        open: (opts: { name: string }) => OPSQLiteConnection;
      };
      this.sqliteDb = open({ name: 'clearpath.db' });
      await this.createSchema();
    } catch {
      // Native module not available (e.g. Jest, web preview)
      this.fallback = new InMemoryStore();
    }
  }

  private async createSchema(): Promise<void> {
    const db = this.sqliteDb!;
    await db.execute(`
      CREATE TABLE IF NOT EXISTS cameras (
        id TEXT PRIMARY KEY,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        vendor TEXT NOT NULL,
        status TEXT NOT NULL,
        last_verified TEXT NOT NULL,
        avoid_radius_meters REAL NOT NULL DEFAULT 50,
        address TEXT,
        notes TEXT
      )
    `);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_cameras_lat ON cameras(latitude)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_cameras_lng ON cameras(longitude)`);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  async ingestGeoJSON(data: DeflockGeoJSON): Promise<number> {
    await this.ensureInitialized();

    if (this.fallback) {
      let count = 0;
      for (const feature of data.features) {
        this.fallback.upsert(featureToRecord(feature));
        count++;
      }
      return count;
    }

    const db = this.sqliteDb!;
    let count = 0;

    await db.transaction(async (tx) => {
      for (const feature of data.features) {
        const r = featureToRecord(feature);
        await tx.execute(
          `INSERT OR REPLACE INTO cameras
             (id, latitude, longitude, vendor, status, last_verified,
              avoid_radius_meters, address, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            r.id,
            r.latitude,
            r.longitude,
            r.vendor,
            r.status,
            r.lastVerified,
            r.avoidRadiusMeters,
            r.address,
            r.notes,
          ],
        );
        count++;
      }
    });

    return count;
  }

  async getCamerasInBounds(bounds: BoundingBox): Promise<ALPRCamera[]> {
    await this.ensureInitialized();

    if (this.fallback) {
      return this.fallback
        .getAll()
        .filter(
          (r) =>
            r.latitude >= bounds.minLat &&
            r.latitude <= bounds.maxLat &&
            r.longitude >= bounds.minLng &&
            r.longitude <= bounds.maxLng,
        )
        .map(recordToCamera);
    }

    const result = await this.sqliteDb!.execute(
      `SELECT * FROM cameras
       WHERE latitude  BETWEEN ? AND ?
         AND longitude BETWEEN ? AND ?`,
      [bounds.minLat, bounds.maxLat, bounds.minLng, bounds.maxLng],
    );

    return (result.rows._array as CameraRecord[]).map(recordToCamera);
  }

  async getCameraById(id: string): Promise<ALPRCamera | null> {
    await this.ensureInitialized();

    if (this.fallback) {
      const r = this.fallback.get(id);
      return r ? recordToCamera(r) : null;
    }

    const result = await this.sqliteDb!.execute(`SELECT * FROM cameras WHERE id = ? LIMIT 1`, [id]);
    const rows = result.rows._array as CameraRecord[];
    return rows.length > 0 ? recordToCamera(rows[0]) : null;
  }

  async getTotalCount(): Promise<number> {
    await this.ensureInitialized();

    if (this.fallback) return this.fallback.count();

    const result = await this.sqliteDb!.execute(`SELECT COUNT(*) as cnt FROM cameras`);
    return (result.rows._array[0] as { cnt: number }).cnt ?? 0;
  }

  async clearAll(): Promise<void> {
    await this.ensureInitialized();

    if (this.fallback) {
      this.fallback.clearCameras();
      return;
    }

    await this.sqliteDb!.execute(`DELETE FROM cameras`);
  }

  async getLastSyncTimestamp(): Promise<string | null> {
    await this.ensureInitialized();

    if (this.fallback) return this.fallback.getMetadata('last_sync') ?? null;

    const result = await this.sqliteDb!.execute(
      `SELECT value FROM metadata WHERE key = 'last_sync' LIMIT 1`,
    );
    const rows = result.rows._array as Array<{ value: string }>;
    return rows.length > 0 ? rows[0].value : null;
  }

  async setLastSyncTimestamp(ts: string): Promise<void> {
    await this.ensureInitialized();

    if (this.fallback) {
      this.fallback.setMetadata('last_sync', ts);
      return;
    }

    await this.sqliteDb!.execute(
      `INSERT OR REPLACE INTO metadata (key, value) VALUES ('last_sync', ?)`,
      [ts],
    );
  }

  /** Force reset singleton — for tests only */
  static _resetForTests(): void {
    CameraDatabase.instance = undefined as unknown as CameraDatabase;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function featureToRecord(feature: DeflockGeoJSON['features'][number]): CameraRecord {
  const { properties, geometry } = feature;
  return {
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

// ── In-memory fallback ────────────────────────────────────────────────────────

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
  clearCameras(): void {
    this.cameras.clear();
  }
  getMetadata(key: string): string | undefined {
    return this.metadata.get(key);
  }
  setMetadata(key: string, value: string): void {
    this.metadata.set(key, value);
  }
}

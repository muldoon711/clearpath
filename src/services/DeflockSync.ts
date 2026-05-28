import type { DeflockGeoJSON } from '../types';
import { privacyFetchHeaders } from '../utils/privacy';
import CameraDatabase from './CameraDatabase';

interface SyncResult {
  success: boolean;
  count: number;
  timestamp: string;
  error?: string;
}

/**
 * Fetches community-sourced ALPR camera data from DeFlock (or a
 * self-hosted mirror) and stores it in the local CameraDatabase.
 *
 * All requests use no-referrer headers and no session tokens so the
 * remote server cannot correlate requests to a specific user.
 */
export default class DeflockSync {
  private static instance: DeflockSync;

  private constructor() {}

  static getInstance(): DeflockSync {
    if (!DeflockSync.instance) {
      DeflockSync.instance = new DeflockSync();
    }
    return DeflockSync.instance;
  }

  async fetchAndStore(endpoint: string): Promise<SyncResult> {
    const timestamp = new Date().toISOString();

    let data: DeflockGeoJSON;
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: privacyFetchHeaders(),
      });

      if (!response.ok) {
        return {
          success: false,
          count: 0,
          timestamp,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      data = (await response.json()) as DeflockGeoJSON;
    } catch (err) {
      return {
        success: false,
        count: 0,
        timestamp,
        error: err instanceof Error ? err.message : 'Network error',
      };
    }

    if (!this.validateGeoJSON(data)) {
      return { success: false, count: 0, timestamp, error: 'Invalid GeoJSON response' };
    }

    const db = CameraDatabase.getInstance();
    const count = await db.ingestGeoJSON(data);
    await db.setLastSyncTimestamp(timestamp);

    return { success: true, count, timestamp };
  }

  private validateGeoJSON(data: unknown): data is DeflockGeoJSON {
    if (!data || typeof data !== 'object') return false;
    const obj = data as Record<string, unknown>;
    return obj.type === 'FeatureCollection' && Array.isArray(obj.features);
  }

  /** Check whether enough time has passed since the last sync */
  async needsSync(intervalMinutes: number): Promise<boolean> {
    const db = CameraDatabase.getInstance();
    const lastSync = await db.getLastSyncTimestamp();
    if (!lastSync) return true;
    const elapsed = Date.now() - new Date(lastSync).getTime();
    return elapsed > intervalMinutes * 60 * 1000;
  }
}

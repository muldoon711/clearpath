import DeflockSync from '../../services/DeflockSync';
import CameraDatabase from '../../services/CameraDatabase';
import type { DeflockGeoJSON } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidGeoJSON(features: DeflockGeoJSON['features'] = []): DeflockGeoJSON {
  return {
    type: 'FeatureCollection',
    generated_at: new Date().toISOString(),
    features,
  };
}

function makeCameraFeature(id: string, lat: number, lng: number): DeflockGeoJSON['features'][0] {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      id,
      vendor: 'flock_safety',
      status: 'active',
      last_verified: '2024-01-01T00:00:00Z',
      avoid_radius_meters: 50,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;

function mockFetchSuccess(body: unknown, status = 200): jest.SpyInstance {
  return jest.spyOn(g, 'fetch').mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
  } as Response);
}

function mockFetchFailure(message: string): jest.SpyInstance {
  return jest.spyOn(g, 'fetch').mockRejectedValueOnce(new Error(message));
}

// ---------------------------------------------------------------------------
// Reset singletons between tests
// ---------------------------------------------------------------------------

// Expose a way to reset the singleton's internal store between tests.
// CameraDatabase is a singleton so we reset its data (cameras + metadata)
// by calling clearAll() and then overwriting the metadata map via the
// private InMemoryStore indirection. Since CameraDatabase exposes
// setLastSyncTimestamp we can use a sentinel: set a known-null state by
// re-creating the store — but the singleton pattern prevents that.
// Instead we write a fresh timestamp of undefined by casting.
// Simplest: track and reset via the public API.
async function resetDatabase(): Promise<void> {
  const db = CameraDatabase.getInstance();
  await db.clearAll();
  // Reset the last sync timestamp by setting it to a value and then
  // clearing it via a private-cast workaround (since there is no public
  // clearMetadata API). We use internal knowledge that the metadata Map
  // can be reached via the db instance's private field.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).fallback.metadata.clear();
}

beforeEach(async () => {
  jest.restoreAllMocks();
  await resetDatabase();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeflockSync', () => {
  const sync = DeflockSync.getInstance();
  const endpoint = 'https://deflock.me/api/v1/cameras.geojson';

  describe('fetchAndStore — valid GeoJSON', () => {
    it('returns success=true and the correct count', async () => {
      const geoJSON = makeValidGeoJSON([
        makeCameraFeature('cam-1', 37.7, -122.4),
        makeCameraFeature('cam-2', 37.8, -122.5),
      ]);
      mockFetchSuccess(geoJSON);

      const result = await sync.fetchAndStore(endpoint);
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.error).toBeUndefined();
    });

    it('stores cameras in the database after a successful fetch', async () => {
      const geoJSON = makeValidGeoJSON([makeCameraFeature('cam-store', 37.7, -122.4)]);
      mockFetchSuccess(geoJSON);

      await sync.fetchAndStore(endpoint);
      const camera = await CameraDatabase.getInstance().getCameraById('cam-store');
      expect(camera).not.toBeNull();
      expect(camera!.id).toBe('cam-store');
    });

    it('updates the last sync timestamp on success', async () => {
      const geoJSON = makeValidGeoJSON([]);
      mockFetchSuccess(geoJSON);
      const before = new Date();

      await sync.fetchAndStore(endpoint);

      const ts = await CameraDatabase.getInstance().getLastSyncTimestamp();
      expect(ts).not.toBeNull();
      expect(new Date(ts!).getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('returns a timestamp in the result', async () => {
      mockFetchSuccess(makeValidGeoJSON([]));
      const result = await sync.fetchAndStore(endpoint);
      expect(result.timestamp).toBeTruthy();
      expect(() => new Date(result.timestamp)).not.toThrow();
    });
  });

  describe('fetchAndStore — validateGeoJSON (via mocked fetch)', () => {
    it('returns success=false when type is not "FeatureCollection"', async () => {
      mockFetchSuccess({ type: 'Feature', features: [] });
      const result = await sync.fetchAndStore(endpoint);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid GeoJSON/i);
    });

    it('returns success=false when features array is missing', async () => {
      mockFetchSuccess({ type: 'FeatureCollection' });
      const result = await sync.fetchAndStore(endpoint);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/Invalid GeoJSON/i);
    });

    it('returns success=false when features is not an array', async () => {
      mockFetchSuccess({ type: 'FeatureCollection', features: {} });
      const result = await sync.fetchAndStore(endpoint);
      expect(result.success).toBe(false);
    });

    it('returns success=false for a null body', async () => {
      mockFetchSuccess(null);
      const result = await sync.fetchAndStore(endpoint);
      expect(result.success).toBe(false);
    });

    it('returns success=false for an empty object', async () => {
      mockFetchSuccess({});
      const result = await sync.fetchAndStore(endpoint);
      expect(result.success).toBe(false);
    });

    it('does not store cameras when GeoJSON is invalid', async () => {
      mockFetchSuccess({ type: 'FeatureCollection' }); // missing features
      await sync.fetchAndStore(endpoint);
      expect(await CameraDatabase.getInstance().getTotalCount()).toBe(0);
    });
  });

  describe('fetchAndStore — HTTP errors', () => {
    it('returns success=false with error message on HTTP 404', async () => {
      mockFetchSuccess(null, 404);
      const result = await sync.fetchAndStore(endpoint);
      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('returns success=false with error message on HTTP 500', async () => {
      mockFetchSuccess(null, 500);
      const result = await sync.fetchAndStore(endpoint);
      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('returns count=0 on HTTP error', async () => {
      mockFetchSuccess(null, 503);
      const result = await sync.fetchAndStore(endpoint);
      expect(result.count).toBe(0);
    });
  });

  describe('fetchAndStore — network errors', () => {
    it('returns success=false when fetch throws', async () => {
      mockFetchFailure('Network request failed');
      const result = await sync.fetchAndStore(endpoint);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network request failed');
    });

    it('returns count=0 on network failure', async () => {
      mockFetchFailure('timeout');
      const result = await sync.fetchAndStore(endpoint);
      expect(result.count).toBe(0);
    });
  });

  describe('needsSync', () => {
    it('returns true when lastSync is null (never synced)', async () => {
      // resetDatabase() in beforeEach cleared the metadata map so
      // getLastSyncTimestamp() returns null here.
      expect(await CameraDatabase.getInstance().getLastSyncTimestamp()).toBeNull();
      const needsIt = await sync.needsSync(60);
      expect(needsIt).toBe(true);
    });

    it('returns true when last sync was longer ago than the interval', async () => {
      // Set a timestamp 2 hours ago
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      await CameraDatabase.getInstance().setLastSyncTimestamp(twoHoursAgo);
      const needsIt = await sync.needsSync(60); // 60-minute interval
      expect(needsIt).toBe(true);
    });

    it('returns false when synced recently', async () => {
      // Set a timestamp 10 minutes ago
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      await CameraDatabase.getInstance().setLastSyncTimestamp(tenMinutesAgo);
      const needsIt = await sync.needsSync(60); // 60-minute interval
      expect(needsIt).toBe(false);
    });

    it('returns false when synced exactly at the interval boundary minus 1 second', async () => {
      // Just under the interval: 59 minutes 59 seconds ago
      const justUnder = new Date(Date.now() - (60 * 60 * 1000 - 1000)).toISOString();
      await CameraDatabase.getInstance().setLastSyncTimestamp(justUnder);
      const needsIt = await sync.needsSync(60);
      expect(needsIt).toBe(false);
    });

    it('returns true when elapsed equals the interval (boundary)', async () => {
      // Exactly at the interval: 60 minutes + 1 second ago
      const justOver = new Date(Date.now() - (60 * 60 * 1000 + 1000)).toISOString();
      await CameraDatabase.getInstance().setLastSyncTimestamp(justOver);
      const needsIt = await sync.needsSync(60);
      expect(needsIt).toBe(true);
    });
  });
});

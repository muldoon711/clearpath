import CameraDatabase from '../../services/CameraDatabase';
import type { DeflockGeoJSON, DeflockFeature } from '../../types';

// Helper to build a minimal DeflockGeoJSON fixture
function buildGeoJSON(
  cameras: Array<{
    id: string;
    lat: number;
    lng: number;
    vendor?: string;
    status?: string;
  }>,
): DeflockGeoJSON {
  const features: DeflockFeature[] = cameras.map((c) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [c.lng, c.lat],
    },
    properties: {
      id: c.id,
      vendor: (c.vendor ?? 'flock_safety') as DeflockFeature['properties']['vendor'],
      status: (c.status ?? 'active') as DeflockFeature['properties']['status'],
      last_verified: '2024-01-01T00:00:00Z',
      avoid_radius_meters: 50,
      address: '123 Main St',
      notes: '',
    },
  }));

  return {
    type: 'FeatureCollection',
    generated_at: '2024-01-01T00:00:00Z',
    features,
  };
}

describe('CameraDatabase', () => {
  let db: CameraDatabase;

  beforeEach(async () => {
    db = CameraDatabase.getInstance();
    await db.clearAll();
  });

  describe('ingestGeoJSON', () => {
    it('returns the correct count of ingested cameras', async () => {
      const data = buildGeoJSON([
        { id: 'cam-1', lat: 37.7, lng: -122.4 },
        { id: 'cam-2', lat: 37.8, lng: -122.5 },
        { id: 'cam-3', lat: 37.9, lng: -122.6 },
      ]);
      const count = await db.ingestGeoJSON(data);
      expect(count).toBe(3);
    });

    it('makes cameras queryable after ingest', async () => {
      const data = buildGeoJSON([{ id: 'cam-1', lat: 37.7, lng: -122.4 }]);
      await db.ingestGeoJSON(data);
      const camera = await db.getCameraById('cam-1');
      expect(camera).not.toBeNull();
      expect(camera!.id).toBe('cam-1');
    });

    it('stores correct coordinates', async () => {
      const data = buildGeoJSON([{ id: 'cam-1', lat: 34.0522, lng: -118.2437 }]);
      await db.ingestGeoJSON(data);
      const camera = await db.getCameraById('cam-1');
      expect(camera!.location.latitude).toBeCloseTo(34.0522, 4);
      expect(camera!.location.longitude).toBeCloseTo(-118.2437, 4);
    });

    it('upserts on duplicate id (last write wins)', async () => {
      const first = buildGeoJSON([{ id: 'cam-1', lat: 37.7, lng: -122.4, vendor: 'flock_safety' }]);
      const second = buildGeoJSON([{ id: 'cam-1', lat: 37.8, lng: -122.5, vendor: 'vigilant' }]);
      await db.ingestGeoJSON(first);
      await db.ingestGeoJSON(second);
      const camera = await db.getCameraById('cam-1');
      expect(camera!.vendor).toBe('vigilant');
      // Count should still be 1 (upsert, not duplicate)
      expect(await db.getTotalCount()).toBe(1);
    });

    it('handles an empty features array', async () => {
      const data: DeflockGeoJSON = {
        type: 'FeatureCollection',
        generated_at: '2024-01-01T00:00:00Z',
        features: [],
      };
      const count = await db.ingestGeoJSON(data);
      expect(count).toBe(0);
    });
  });

  describe('getCamerasInBounds', () => {
    beforeEach(async () => {
      const data = buildGeoJSON([
        { id: 'inside-1', lat: 37.75, lng: -122.41 },
        { id: 'inside-2', lat: 37.77, lng: -122.43 },
        { id: 'outside-north', lat: 37.9, lng: -122.41 },
        { id: 'outside-south', lat: 37.6, lng: -122.41 },
        { id: 'outside-east', lat: 37.75, lng: -122.3 },
        { id: 'outside-west', lat: 37.75, lng: -122.6 },
      ]);
      await db.ingestGeoJSON(data);
    });

    const bounds = {
      minLat: 37.7,
      maxLat: 37.8,
      minLng: -122.5,
      maxLng: -122.35,
    };

    it('returns only cameras inside the bounds', async () => {
      const cameras = await db.getCamerasInBounds(bounds);
      const ids = cameras.map((c) => c.id).sort();
      expect(ids).toEqual(['inside-1', 'inside-2']);
    });

    it('excludes cameras outside bounds', async () => {
      const cameras = await db.getCamerasInBounds(bounds);
      const ids = cameras.map((c) => c.id);
      expect(ids).not.toContain('outside-north');
      expect(ids).not.toContain('outside-south');
      expect(ids).not.toContain('outside-east');
      expect(ids).not.toContain('outside-west');
    });

    it('returns an empty array for bounds with no cameras', async () => {
      const emptyBounds = { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
      const cameras = await db.getCamerasInBounds(emptyBounds);
      expect(cameras).toEqual([]);
    });

    it('includes cameras exactly on the boundary (inclusive)', async () => {
      // Add a camera exactly at a corner of the bounds
      await db.ingestGeoJSON(buildGeoJSON([{ id: 'on-corner', lat: 37.7, lng: -122.5 }]));
      const cameras = await db.getCamerasInBounds(bounds);
      const ids = cameras.map((c) => c.id);
      expect(ids).toContain('on-corner');
    });
  });

  describe('getCameraById', () => {
    beforeEach(async () => {
      await db.ingestGeoJSON(
        buildGeoJSON([
          { id: 'cam-abc', lat: 37.7, lng: -122.4, vendor: 'motorola', status: 'inactive' },
        ]),
      );
    });

    it('finds a camera by its id', async () => {
      const camera = await db.getCameraById('cam-abc');
      expect(camera).not.toBeNull();
      expect(camera!.id).toBe('cam-abc');
      expect(camera!.vendor).toBe('motorola');
      expect(camera!.status).toBe('inactive');
    });

    it('returns null for an unknown id', async () => {
      const camera = await db.getCameraById('does-not-exist');
      expect(camera).toBeNull();
    });
  });

  describe('getTotalCount', () => {
    it('returns 0 when the database is empty', async () => {
      expect(await db.getTotalCount()).toBe(0);
    });

    it('matches the number of ingested cameras', async () => {
      await db.ingestGeoJSON(
        buildGeoJSON([
          { id: 'a', lat: 1, lng: 1 },
          { id: 'b', lat: 2, lng: 2 },
        ]),
      );
      expect(await db.getTotalCount()).toBe(2);
    });
  });

  describe('clearAll', () => {
    it('empties the camera store', async () => {
      await db.ingestGeoJSON(buildGeoJSON([{ id: 'cam-x', lat: 37.7, lng: -122.4 }]));
      expect(await db.getTotalCount()).toBe(1);

      await db.clearAll();
      expect(await db.getTotalCount()).toBe(0);
    });

    it('makes previously ingested cameras unfindable', async () => {
      await db.ingestGeoJSON(buildGeoJSON([{ id: 'cam-y', lat: 37.7, lng: -122.4 }]));
      await db.clearAll();
      expect(await db.getCameraById('cam-y')).toBeNull();
    });
  });

  describe('getLastSyncTimestamp / setLastSyncTimestamp', () => {
    it('returns null when no timestamp has been set', async () => {
      expect(await db.getLastSyncTimestamp()).toBeNull();
    });

    it('returns the timestamp that was set', async () => {
      const ts = '2024-06-01T12:00:00.000Z';
      await db.setLastSyncTimestamp(ts);
      expect(await db.getLastSyncTimestamp()).toBe(ts);
    });

    it('overwrites an older timestamp', async () => {
      await db.setLastSyncTimestamp('2024-01-01T00:00:00.000Z');
      await db.setLastSyncTimestamp('2024-06-01T12:00:00.000Z');
      expect(await db.getLastSyncTimestamp()).toBe('2024-06-01T12:00:00.000Z');
    });

    it('survives clearAll (metadata is separate from cameras)', async () => {
      const ts = '2024-06-01T12:00:00.000Z';
      await db.setLastSyncTimestamp(ts);
      await db.clearAll(); // clearAll only clears camera records, not metadata
      // Note: CameraDatabase.clearAll() calls InMemoryStore.clear() which only
      // clears the cameras map — metadata is preserved
      expect(await db.getLastSyncTimestamp()).toBe(ts);
    });
  });
});

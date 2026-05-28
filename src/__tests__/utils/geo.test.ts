import {
  haversineDistance,
  bearing,
  formatDistance,
  formatDuration,
  decodePolyline,
  isInBounds,
  geometryBounds,
  clampZoom,
  latLngToTile,
} from '../../utils/geo';

describe('haversineDistance', () => {
  it('returns 0 for the same point', () => {
    const sf = { latitude: 37.7749, longitude: -122.4194 };
    expect(haversineDistance(sf, sf)).toBe(0);
  });

  it('returns approximately 559 km between SF and LA', () => {
    const sf = { latitude: 37.7749, longitude: -122.4194 };
    const la = { latitude: 34.0522, longitude: -118.2437 };
    const distM = haversineDistance(sf, la);
    const distKm = distM / 1000;
    // Accepted haversine range: 559 ± 5 km
    expect(distKm).toBeGreaterThan(554);
    expect(distKm).toBeLessThan(564);
  });

  it('is symmetric', () => {
    const a = { latitude: 40.7128, longitude: -74.006 };
    const b = { latitude: 51.5074, longitude: -0.1278 };
    expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 0);
  });
});

describe('bearing', () => {
  const origin = { latitude: 0, longitude: 0 };

  it('returns ~0 for due north', () => {
    const north = { latitude: 1, longitude: 0 };
    expect(bearing(origin, north)).toBeCloseTo(0, 0);
  });

  it('returns ~90 for due east', () => {
    const east = { latitude: 0, longitude: 1 };
    expect(bearing(origin, east)).toBeCloseTo(90, 0);
  });

  it('returns ~180 for due south', () => {
    const south = { latitude: -1, longitude: 0 };
    expect(bearing(origin, south)).toBeCloseTo(180, 0);
  });

  it('returns ~270 for due west', () => {
    const west = { latitude: 0, longitude: -1 };
    expect(bearing(origin, west)).toBeCloseTo(270, 0);
  });

  it('returns a value in [0, 360)', () => {
    const a = { latitude: 48.8566, longitude: 2.3522 };
    const b = { latitude: 35.6895, longitude: 139.6917 };
    const b_ = bearing(a, b);
    expect(b_).toBeGreaterThanOrEqual(0);
    expect(b_).toBeLessThan(360);
  });
});

describe('formatDistance', () => {
  describe('metric', () => {
    it('formats metres below 1000 as "X m"', () => {
      expect(formatDistance(500, 'metric')).toBe('500 m');
    });

    it('rounds metres to whole number', () => {
      expect(formatDistance(499.6, 'metric')).toBe('500 m');
    });

    it('formats >= 1000 metres as "X.X km"', () => {
      expect(formatDistance(1500, 'metric')).toBe('1.5 km');
    });

    it('formats exactly 1000 m as "1.0 km"', () => {
      expect(formatDistance(1000, 'metric')).toBe('1.0 km');
    });
  });

  describe('imperial', () => {
    it('formats feet below 1000 as "X ft"', () => {
      // 100 m ≈ 328 ft
      expect(formatDistance(100, 'imperial')).toBe('328 ft');
    });

    it('formats >= 1000 ft as "X.X mi"', () => {
      // 1609.34 m ≈ 1 mile
      const result = formatDistance(1609.34, 'imperial');
      expect(result).toMatch(/mi$/);
      const miles = parseFloat(result);
      expect(miles).toBeCloseTo(1.0, 1);
    });

    it('uses "mi" suffix for larger distances', () => {
      expect(formatDistance(5000, 'imperial')).toMatch(/mi$/);
    });
  });
});

describe('formatDuration', () => {
  it('formats 0 seconds as "0 min"', () => {
    expect(formatDuration(0)).toBe('0 min');
  });

  it('formats less than 1 hour as "X min"', () => {
    expect(formatDuration(600)).toBe('10 min');
  });

  it('formats exactly 1 hour as "1h 0m"', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
  });

  it('formats 1h 30m correctly', () => {
    expect(formatDuration(5400)).toBe('1h 30m');
  });

  it('formats 2h 5m correctly', () => {
    expect(formatDuration(7500)).toBe('2h 5m');
  });

  it('floors partial minutes', () => {
    // 65 seconds = 1 min (floor)
    expect(formatDuration(65)).toBe('1 min');
  });
});

describe('decodePolyline', () => {
  it('decodes a known single-point encoded string', () => {
    // Valhalla precision=6 encoded polyline for (0, 0)
    // encoding: lat=0 → 0*2=0 → 0+63=63='?' | lng=0 → same
    const encoded = '??';
    const result = decodePolyline(encoded);
    expect(result).toHaveLength(1);
    expect(result[0][0]).toBeCloseTo(0, 5); // lng
    expect(result[0][1]).toBeCloseTo(0, 5); // lat
  });

  it('decodes a known two-point polyline (precision 5)', () => {
    // "_p~iF~ps|U_ulLnnqC" is the classic Google Maps example (precision=5)
    // Point 1: lng=-120.2, lat=38.5
    // Point 2: lng=-120.95, lat=40.7  (delta-encoded from point 1)
    const encoded = '_p~iF~ps|U_ulLnnqC';
    const result = decodePolyline(encoded, 5);
    expect(result).toHaveLength(2);
    expect(result[0][1]).toBeCloseTo(38.5, 1); // lat
    expect(result[0][0]).toBeCloseTo(-120.2, 1); // lng
    expect(result[1][1]).toBeCloseTo(40.7, 1);
    expect(result[1][0]).toBeCloseTo(-120.95, 1);
  });

  it('returns empty array for empty string', () => {
    expect(decodePolyline('')).toEqual([]);
  });

  it('emits [lng, lat] order', () => {
    // Encoding of SF (37.7749, -122.4194) at precision 6
    // Verify the output tuple is [lng, lat]
    const encoded = '_p~iF~ps|U';
    const result = decodePolyline(encoded, 5);
    // lng is the first element and should be negative for western hemisphere
    expect(result[0][0]).toBeLessThan(0); // lng (western = negative)
    expect(result[0][1]).toBeGreaterThan(0); // lat (northern = positive)
  });
});

describe('isInBounds', () => {
  const bounds = { minLat: 10, maxLat: 20, minLng: 30, maxLng: 40 };

  it('returns true for a point strictly inside', () => {
    expect(isInBounds({ latitude: 15, longitude: 35 }, bounds)).toBe(true);
  });

  it('returns false for a point north of bounds', () => {
    expect(isInBounds({ latitude: 25, longitude: 35 }, bounds)).toBe(false);
  });

  it('returns false for a point south of bounds', () => {
    expect(isInBounds({ latitude: 5, longitude: 35 }, bounds)).toBe(false);
  });

  it('returns false for a point east of bounds', () => {
    expect(isInBounds({ latitude: 15, longitude: 45 }, bounds)).toBe(false);
  });

  it('returns false for a point west of bounds', () => {
    expect(isInBounds({ latitude: 15, longitude: 25 }, bounds)).toBe(false);
  });

  it('returns true for a point on the min corner (inclusive)', () => {
    expect(isInBounds({ latitude: 10, longitude: 30 }, bounds)).toBe(true);
  });

  it('returns true for a point on the max corner (inclusive)', () => {
    expect(isInBounds({ latitude: 20, longitude: 40 }, bounds)).toBe(true);
  });
});

describe('geometryBounds', () => {
  it('extracts correct min/max from a simple triangle', () => {
    const coords: [number, number][] = [
      [-122.4, 37.7],
      [-118.2, 34.0],
      [-117.2, 32.7],
    ];
    const result = geometryBounds(coords);
    expect(result.minLng).toBe(-122.4);
    expect(result.maxLng).toBe(-117.2);
    expect(result.minLat).toBe(32.7);
    expect(result.maxLat).toBe(37.7);
  });

  it('handles a single point', () => {
    const coords: [number, number][] = [[-122.4194, 37.7749]];
    const result = geometryBounds(coords);
    expect(result.minLat).toBe(37.7749);
    expect(result.maxLat).toBe(37.7749);
    expect(result.minLng).toBe(-122.4194);
    expect(result.maxLng).toBe(-122.4194);
  });
});

describe('clampZoom', () => {
  it('clamps values below 0 to 0', () => {
    expect(clampZoom(-5)).toBe(0);
    expect(clampZoom(-0.1)).toBe(0);
  });

  it('clamps values above 22 to 22', () => {
    expect(clampZoom(23)).toBe(22);
    expect(clampZoom(100)).toBe(22);
  });

  it('passes through valid values unchanged', () => {
    expect(clampZoom(0)).toBe(0);
    expect(clampZoom(13)).toBe(13);
    expect(clampZoom(22)).toBe(22);
    expect(clampZoom(7.5)).toBe(7.5);
  });
});

describe('latLngToTile', () => {
  it('returns correct tile for SF at zoom 13', () => {
    // SF: 37.7749, -122.4194 at zoom 13
    // Expected: z=13, x=1310, y=3166 (standard Web Mercator)
    const sf = { latitude: 37.7749, longitude: -122.4194 };
    const tile = latLngToTile(sf, 13);
    expect(tile.z).toBe(13);
    expect(tile.x).toBe(1310);
    expect(tile.y).toBe(3166);
  });

  it('floors non-integer zoom levels', () => {
    const sf = { latitude: 37.7749, longitude: -122.4194 };
    const tile = latLngToTile(sf, 13.9);
    expect(tile.z).toBe(13);
  });

  it('x is within [0, 2^z) and y is within [0, 2^z)', () => {
    const point = { latitude: 48.8566, longitude: 2.3522 }; // Paris
    const tile = latLngToTile(point, 10);
    const maxTile = Math.pow(2, 10);
    expect(tile.x).toBeGreaterThanOrEqual(0);
    expect(tile.x).toBeLessThan(maxTile);
    expect(tile.y).toBeGreaterThanOrEqual(0);
    expect(tile.y).toBeLessThan(maxTile);
  });
});

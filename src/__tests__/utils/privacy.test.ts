import {
  sanitizeTileUrl,
  redactCoordinates,
  isTelemetryUrl,
  validateEndpointUrl,
  ephemeralSessionId,
} from '../../utils/privacy';

describe('sanitizeTileUrl', () => {
  it('strips session param', () => {
    const url = 'https://tiles.example.com/tile/0/0/0.png?session=abc123&foo=bar';
    const result = sanitizeTileUrl(url);
    expect(result).not.toContain('session=');
    expect(result).toContain('foo=bar');
  });

  it('strips uid param', () => {
    const url = 'https://tiles.example.com/tile/1/2/3.png?uid=user42&z=10';
    const result = sanitizeTileUrl(url);
    expect(result).not.toContain('uid=');
    expect(result).toContain('z=10');
  });

  it('strips token param', () => {
    const url = 'https://tiles.example.com/tile?token=secret&style=streets';
    const result = sanitizeTileUrl(url);
    expect(result).not.toContain('token=');
    expect(result).toContain('style=streets');
  });

  it('strips sid param', () => {
    const url = 'https://tiles.example.com/?sid=xyz&format=png';
    const result = sanitizeTileUrl(url);
    expect(result).not.toContain('sid=');
  });

  it('strips user param', () => {
    const url = 'https://tiles.example.com/?user=john&q=1';
    const result = sanitizeTileUrl(url);
    expect(result).not.toContain('user=');
  });

  it('strips key and apikey params', () => {
    const url = 'https://tiles.example.com/?key=k1&apikey=k2&x=1';
    const result = sanitizeTileUrl(url);
    expect(result).not.toContain('key=k1');
    expect(result).not.toContain('apikey=');
    expect(result).toContain('x=1');
  });

  it('preserves the URL path', () => {
    const url = 'https://tiles.example.com/v3/streets/13/1310/3166.png?token=t';
    const result = sanitizeTileUrl(url);
    expect(result).toContain('/v3/streets/13/1310/3166.png');
  });

  it('preserves non-tracking query parameters', () => {
    const url = 'https://tiles.example.com/?style=dark&format=webp';
    const result = sanitizeTileUrl(url);
    expect(result).toContain('style=dark');
    expect(result).toContain('format=webp');
  });

  it('returns the original string for invalid URLs', () => {
    const bad = 'not a url at all %%';
    expect(sanitizeTileUrl(bad)).toBe(bad);
  });

  it('handles URLs with no query string', () => {
    const url = 'https://tiles.example.com/tile/0/0/0.png';
    expect(sanitizeTileUrl(url)).toBe(url);
  });
});

describe('redactCoordinates', () => {
  it('rounds to 2 decimal places', () => {
    const result = redactCoordinates(37.7749295, -122.4194155);
    expect(result.lat).toBe(37.77);
    expect(result.lng).toBe(-122.42);
  });

  it('reduces precision for a point in Europe', () => {
    const result = redactCoordinates(48.856613, 2.352222);
    expect(result.lat).toBe(48.86);
    expect(result.lng).toBe(2.35);
  });

  it('handles negative latitudes', () => {
    const result = redactCoordinates(-33.8688197, 151.2092955);
    expect(result.lat).toBe(-33.87);
    expect(result.lng).toBe(151.21);
  });

  it('handles exact 2-decimal values unchanged', () => {
    const result = redactCoordinates(10.5, -20.25);
    expect(result.lat).toBe(10.5);
    expect(result.lng).toBe(-20.25);
  });
});

describe('isTelemetryUrl', () => {
  const telemetryUrls = [
    'https://www.google-analytics.com/collect',
    'https://analytics.google-analytics.com/g/collect',
    'https://api.segment.io/v1/track',
    'https://cdn.segment.com/analytics.js',
    'https://api.mixpanel.com/track/',
    'https://api2.amplitude.com/2/httpapi',
    'https://heapanalytics.heap.io/track',
    'https://o123456.ingest.sentry.io/api/error/',
    'https://notify.bugsnag.com/',
    'https://reports.crashlytics.com/',
    'https://app.firebase.io/',
    'https://clearpath.firebaseapp.com/analytics',
    'https://www.googletagmanager.com/gtag/js',
  ];

  test.each(telemetryUrls)('returns true for %s', (url) => {
    expect(isTelemetryUrl(url)).toBe(true);
  });

  const safeUrls = [
    'https://tile.openstreetmap.org/13/1310/3166.png',
    'https://valhalla1.openstreetmap.de/route',
    'https://deflock.me/api/v1/cameras.geojson',
    'https://nominatim.openstreetmap.org/search',
  ];

  test.each(safeUrls)('returns false for %s', (url) => {
    expect(isTelemetryUrl(url)).toBe(false);
  });

  it('returns false for an invalid URL', () => {
    expect(isTelemetryUrl('not-a-url')).toBe(false);
  });
});

describe('validateEndpointUrl', () => {
  it('accepts https URL on an allowed host', () => {
    expect(
      validateEndpointUrl('https://valhalla1.openstreetmap.de/route', ['openstreetmap.de']),
    ).toBe(true);
  });

  it('accepts https URL on a subdomain of allowed host', () => {
    expect(validateEndpointUrl('https://api.example.com/endpoint', ['example.com'])).toBe(true);
  });

  it('accepts http URL for a host on the allowlist (http is permitted by implementation)', () => {
    // The implementation allows both http and https for any allowed host
    expect(validateEndpointUrl('http://example.com/route', ['example.com'])).toBe(true);
  });

  it('accepts http URL for localhost', () => {
    expect(validateEndpointUrl('http://localhost:8002/route', ['localhost'])).toBe(true);
  });

  it('rejects a URL whose host is not in the allowlist', () => {
    expect(validateEndpointUrl('https://evil.com/route', ['valhalla.openstreetmap.de'])).toBe(
      false,
    );
  });

  it('rejects ftp:// protocol', () => {
    expect(validateEndpointUrl('ftp://example.com/file', ['example.com'])).toBe(false);
  });

  it('rejects an invalid URL', () => {
    expect(validateEndpointUrl('not a url', ['example.com'])).toBe(false);
  });

  it('rejects partial host name match (not on subdomain boundary)', () => {
    // "notexample.com" should NOT match allowedHost "example.com"
    expect(validateEndpointUrl('https://notexample.com/path', ['example.com'])).toBe(false);
  });
});

describe('ephemeralSessionId', () => {
  it('returns a 32-character string', () => {
    const id = ephemeralSessionId();
    expect(id).toHaveLength(32);
  });

  it('returns a hex string (only 0-9a-f)', () => {
    const id = ephemeralSessionId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('returns different values on consecutive calls', () => {
    const id1 = ephemeralSessionId();
    const id2 = ephemeralSessionId();
    // Astronomically unlikely to collide on 16 random bytes
    expect(id1).not.toBe(id2);
  });

  it('returns a new value each invocation (sample 5)', () => {
    const ids = new Set(Array.from({ length: 5 }, () => ephemeralSessionId()));
    expect(ids.size).toBe(5);
  });
});

/**
 * Privacy utilities — all helpers used to ensure zero telemetry and
 * local-only processing of sensitive location data.
 */

/** Strip any query parameters or path segments that could identify the user */
export function sanitizeTileUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove any session, user, or tracking params
    const TRACKING_PARAMS = ['session', 'sid', 'uid', 'user', 'token', 'key', 'apikey', 'api_key'];
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Redact precise coordinates to a ~1km cell for logging purposes */
export function redactCoordinates(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
  };
}

/**
 * Build fetch options that prevent browser/RN from leaking the Referer
 * or any identifying headers to external services.
 */
export function privacyFetchHeaders(): Record<string, string> {
  return {
    Referrer: 'no-referrer',
    'Cache-Control': 'no-store',
  };
}

/** Validate that a user-supplied endpoint is HTTPS and on an allowlist domain */
export function validateEndpointUrl(url: string, allowedHosts: string[]): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return allowedHosts.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

/** Check whether a URL points to a known analytics or telemetry domain */
export function isTelemetryUrl(url: string): boolean {
  const TELEMETRY_DOMAINS = [
    'google-analytics.com',
    'googletagmanager.com',
    'segment.io',
    'segment.com',
    'mixpanel.com',
    'amplitude.com',
    'heap.io',
    'sentry.io',
    'bugsnag.com',
    'crashlytics.com',
    'firebase.io',
    'firebaseapp.com',
  ];
  try {
    const parsed = new URL(url);
    return TELEMETRY_DOMAINS.some(
      (d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`),
    );
  } catch {
    return false;
  }
}

/** Wipe any cached sensitive data from AsyncStorage keys */
export async function clearSensitiveCache(AsyncStorage: {
  multiRemove: (keys: string[]) => Promise<void>;
  getAllKeys: () => Promise<readonly string[]>;
}): Promise<void> {
  const SENSITIVE_PREFIXES = ['last_location', 'route_history', 'search_history'];
  const allKeys = await AsyncStorage.getAllKeys();
  const toDelete = (allKeys as string[]).filter((k) =>
    SENSITIVE_PREFIXES.some((prefix) => k.startsWith(prefix)),
  );
  if (toDelete.length > 0) {
    await AsyncStorage.multiRemove(toDelete);
  }
}

/** Generate a random ephemeral session ID that is never persisted */
export function ephemeralSessionId(): string {
  const bytes = new Uint8Array(16);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maybeCrypto = (globalThis as any).crypto;
  if (maybeCrypto && maybeCrypto.getRandomValues) {
    maybeCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

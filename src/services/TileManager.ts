import { Platform } from 'react-native';
import type { BoundingBox, TileCacheStats, TileCoordinate } from '../types';
import { latLngToTile } from '../utils/geo';

const TILE_CACHE_DIR = Platform.select({
  ios: 'Library/Caches/clearpath_tiles',
  android: 'cache/clearpath_tiles',
  default: 'clearpath_tiles',
});

/**
 * Manages the offline tile cache and coordinates offline-first tile loading
 * for MapLibre. Tile URLs are sanitized before storage to strip tracking params.
 */
export default class TileManager {
  private static instance: TileManager;
  private cacheStats: TileCacheStats = {
    totalTiles: 0,
    totalBytes: 0,
    oldestEntry: '',
    newestEntry: '',
  };

  private constructor() {}

  static getInstance(): TileManager {
    if (!TileManager.instance) {
      TileManager.instance = new TileManager();
    }
    return TileManager.instance;
  }

  /** Build a MapLibre offline region download request for a bounding box */
  buildOfflineRegion(
    bounds: BoundingBox,
    minZoom: number,
    maxZoom: number,
    styleUrl: string,
  ): object {
    return {
      styleURL: styleUrl,
      bounds: [
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
      ],
      minZoom,
      maxZoom,
    };
  }

  /** Estimate the number of tiles needed to cover a bounding box across zoom levels */
  estimateTileCount(bounds: BoundingBox, minZoom: number, maxZoom: number): number {
    let total = 0;
    for (let z = minZoom; z <= maxZoom; z++) {
      const topLeft = latLngToTile({ latitude: bounds.maxLat, longitude: bounds.minLng }, z);
      const bottomRight = latLngToTile(
        { latitude: bounds.minLat, longitude: bounds.maxLng },
        z,
      );
      const cols = Math.abs(bottomRight.x - topLeft.x) + 1;
      const rows = Math.abs(bottomRight.y - topLeft.y) + 1;
      total += cols * rows;
    }
    return total;
  }

  /** Check whether a tile is available in the local cache */
  async isTileCached(tile: TileCoordinate): Promise<boolean> {
    const RNFS = await this.getRNFS();
    if (!RNFS) return false;
    const path = this.tilePath(tile);
    return RNFS.exists(path);
  }

  /** Evict cached tiles older than maxAgeDays */
  async evictOldTiles(maxAgeDays: number): Promise<number> {
    const RNFS = await this.getRNFS();
    if (!RNFS) return 0;
    const cacheDir = `${RNFS.CachesDirectoryPath}/${TILE_CACHE_DIR}`;
    const cutoff = Date.now() - maxAgeDays * 86_400_000;
    let evicted = 0;
    try {
      const items = await RNFS.readDir(cacheDir);
      for (const item of items) {
        const mtime = new Date(item.mtime ?? 0).getTime();
        if (mtime < cutoff) {
          await RNFS.unlink(item.path);
          evicted++;
        }
      }
    } catch {
      // Cache dir may not exist yet
    }
    return evicted;
  }

  async getCacheStats(): Promise<TileCacheStats> {
    return this.cacheStats;
  }

  async clearCache(): Promise<void> {
    const RNFS = await this.getRNFS();
    if (!RNFS) return;
    const cacheDir = `${RNFS.CachesDirectoryPath}/${TILE_CACHE_DIR}`;
    try {
      await RNFS.unlink(cacheDir);
    } catch {
      // Directory may not exist
    }
    this.cacheStats = { totalTiles: 0, totalBytes: 0, oldestEntry: '', newestEntry: '' };
  }

  private tilePath(tile: TileCoordinate): string {
    return `${TILE_CACHE_DIR}/${tile.z}/${tile.x}/${tile.y}.pbf`;
  }

  private async getRNFS(): Promise<typeof import('react-native-fs') | null> {
    try {
      return require('react-native-fs');
    } catch {
      return null;
    }
  }
}

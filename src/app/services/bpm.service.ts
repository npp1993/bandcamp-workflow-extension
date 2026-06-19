import {Logger} from '../utils/logger';
import {analyzeBpm} from '../utils/bpm/analyze-bpm';
import {BpmResult} from '../utils/bpm/types';

/**
 * Computes and caches per-track BPM. The pure detection lives in utils/bpm; this
 * service only owns caching and config, mirroring WaveformService's shape (static
 * class + in-memory Map keyed by streamId, 15-minute TTL). Beatless results
 * (bpm = null) are cached too, so an ambient track isn't re-analyzed on replay.
 */
export class BpmService {
  private static cache = new Map<string, BpmResult>();
  private static cacheTimestamps = new Map<string, number>();
  private static readonly CACHE_TTL = 1000 * 60 * 15;

  /**
   * Analyze decoded PCM for a stream and cache the result. Synchronous: the
   * caller passes a live channel view (valid for the duration of the call).
   */
  public static analyzeFromChannel(
    channel: Float32Array,
    sampleRate: number,
    streamId: string,
  ): BpmResult {
    const cached = this.getCached(streamId);
    if (cached) {
      return cached;
    }

    let result: BpmResult;
    try {
      result = analyzeBpm(channel, sampleRate);
    } catch (error) {
      Logger.error('BPM analysis failed:', error);
      result = {bpm: null, confidence: 0};
    }

    const key = this.key(streamId);
    this.cache.set(key, result);
    this.cacheTimestamps.set(key, Date.now());
    return result;
  }

  public static getCached(streamId: string): BpmResult | null {
    const key = this.key(streamId);
    const ts = this.cacheTimestamps.get(key);
    if (ts === undefined) {
      return null;
    }
    if (Date.now() - ts > this.CACHE_TTL) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }
    return this.cache.get(key) ?? null;
  }

  public static clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, ts] of this.cacheTimestamps) {
      if (now - ts > this.CACHE_TTL) {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
      }
    }
  }

  public static clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  private static key(streamId: string): string {
    return `bpm_${streamId}`;
  }
}

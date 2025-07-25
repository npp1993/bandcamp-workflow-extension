import {Logger} from '../utils/logger';
import {AudioUtils} from '../utils/audio-utils';

/**
 * Service for generating and rendering waveforms from Bandcamp audio streams
 * Integrates with existing extension architecture and provides caching
 */
export class WaveformService {
  // Cache for processed waveform data to prevent redundant processing
  private static cache = new Map<string, number[]>();
  
  // Configuration for waveform rendering
  private static readonly CONFIG = {
    datapoints: 200, // Increased from 100 for higher resolution
    canvasWidth: 600,
    canvasHeight: 60,
    color: '#333',
    cacheTTL: 1000 * 60 * 15, // 15 minutes
  };

  // Cache expiry tracking
  private static cacheTimestamps = new Map<string, number>();

  /**
   * Generate waveform for the currently playing audio
   *
   * @returns Promise resolving to the waveform canvas element or null if failed
   */
  public static async generateWaveformForCurrentAudio(): Promise<HTMLCanvasElement | null> {
    try {
      // Get the current audio element
      const audio = AudioUtils.getAudioElement();
      if (!audio || !audio.src) {
        return null;
      }

      // Extract stream ID from audio source for caching
      const streamId = this.extractStreamId(audio.src);
      if (!streamId) {
        return null;
      }

      // Check cache first
      const cachedData = this.getCachedWaveformData(streamId);
      if (cachedData) {
        return this.renderWaveformFromData(cachedData);
      }

      // Fetch audio buffer via background script using complete URL
      const audioBuffer = await this.fetchAudioBuffer(audio.src);
      if (!audioBuffer) {
        Logger.error('Failed to fetch audio buffer');
        return null;
      }

      // Process audio buffer to extract waveform data
      const waveformData = await this.processAudioBuffer(audioBuffer);
      if (!waveformData) {
        Logger.error('Failed to process audio buffer');
        return null;
      }

      // Cache the processed data
      this.cacheWaveformData(streamId, waveformData);

      // Render and return the waveform canvas
      return this.renderWaveformFromData(waveformData);
    } catch (error) {
      Logger.error('Error generating waveform:', error);
      return null;
    }
  }

  /**
   * Extract stream ID from Bandcamp audio source URL
   *
   * @param src Audio source URL
   * @returns Stream ID or null if not found
   */
  public static extractStreamId(src: string): string | null {
    // Handle different URL formats that Bandcamp uses
    const patterns = [
      /stream\/([^?]+)/,  // Standard format: .../stream/abc123
      /track_id=([^&]+)/, // Alternative format with track_id parameter
    ];

    for (const pattern of patterns) {
      const match = src.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Check if extension context is still valid
   *
   * @returns True if extension context is valid
   */
  private static isExtensionContextValid(): boolean {
    try {
      // Try to access chrome runtime
      if (!chrome?.runtime?.id) {
        return false;
      }
      
      // Check if we can access the extension ID
      return chrome.runtime.id !== undefined;
    } catch (error) {
      return false;
    }
  }

  /**
   * Fetch audio buffer from background script via CORS bypass
   *
   * @param audioUrl Complete audio URL with authentication parameters
   * @returns Promise resolving to audio buffer array or null
   */
  private static async fetchAudioBuffer(audioUrl: string): Promise<number[] | null> {
    return new Promise((resolve) => {
      try {
        // Check if extension context is still valid
        if (!this.isExtensionContextValid()) {
          Logger.warn('Extension context is no longer valid, cannot fetch audio buffer');
          resolve(null);
          return;
        }

        // Check if chrome runtime is available
        if (!chrome?.runtime?.sendMessage) {
          Logger.error('Chrome runtime not available for message sending');
          resolve(null);
          return;
        }

        // Set up a timeout to prevent hanging requests
        const timeoutId = setTimeout(() => {
          Logger.warn('Audio buffer request timed out');
          resolve(null);
        }, 30000); // 30 second timeout

        chrome.runtime.sendMessage(
          {
            contentScriptQuery: 'renderBuffer',
            url: audioUrl,
          },
          (response: {data?: number[]; error?: string;}) => {
            clearTimeout(timeoutId);

            // Check for extension context invalidation
            if (chrome.runtime.lastError) {
              Logger.warn('Extension context invalidated during request:', chrome.runtime.lastError.message);
              resolve(null);
              return;
            }

            // Double-check extension context is still valid after response
            if (!this.isExtensionContextValid()) {
              resolve(null);
              return;
            }

            if (!response || response.error) {
              Logger.error('Failed to fetch audio buffer:', response?.error || 'No response');
              resolve(null);
              return;
            }

            if (!response.data || !Array.isArray(response.data)) {
              Logger.error('Invalid audio buffer response');
              resolve(null);
              return;
            }

            resolve(response.data);
          },
        );
      } catch (error) {
        Logger.error('Error in fetchAudioBuffer:', error);
        resolve(null);
      }
    });
  }

  /**
   * Process audio buffer to extract RMS-based amplitude data
   *
   * @param audioData Raw audio buffer data
   * @returns Promise resolving to normalized amplitude array
   */
  private static async processAudioBuffer(audioData: number[]): Promise<number[] | null> {
    try {
      // Create Web Audio API context
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Convert number array back to ArrayBuffer
      const audioBuffer = new Uint8Array(audioData).buffer;
      
      // Decode audio data
      const decodedAudio = await ctx.decodeAudioData(audioBuffer);
      
      // Extract left channel data (mono or stereo left)
      const leftChannel = decodedAudio.getChannelData(0);
      
      // Calculate RMS values for amplitude visualization using reference logic
      const stepSize = Math.round(decodedAudio.length / this.CONFIG.datapoints);
      const rmsSize = Math.min(stepSize, 128); // Use 128 as in the reference code
      const subStepSize = Math.round(stepSize / rmsSize);
      
      const rmsBuffer: number[] = [];
      
      for (let i = 0; i < this.CONFIG.datapoints; i++) {
        let rms = 0.0;
        
        for (let sample = 0; sample < rmsSize; sample++) {
          const sampleIndex = i * stepSize + sample * subStepSize;
          if (sampleIndex < leftChannel.length) {
            const audioSample = leftChannel[sampleIndex];
            rms += audioSample ** 2;
          }
        }
        
        rmsBuffer.push(Math.sqrt(rms / rmsSize));
      }
      
      // Normalize the data
      const max = Math.max(...rmsBuffer);
      if (max === 0) {
        return new Array(this.CONFIG.datapoints).fill(0);
      }
      
      const normalizedData = rmsBuffer.map((value) => value / max);
      
      return normalizedData;
    } catch (error) {
      Logger.error('Error processing audio buffer:', error);
      return null;
    }
  }

  /**
   * Render waveform canvas from processed amplitude data
   *
   * @param waveformData Normalized amplitude data
   * @param progress Optional progress ratio (0-1) for rendering played/unplayed portions
   * @returns Canvas element with rendered waveform
   */
  private static renderWaveformFromData(waveformData: number[], progress = 0): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.CONFIG.canvasWidth;
    canvas.height = this.CONFIG.canvasHeight;
    canvas.className = 'bandcamp-waveform';

    const canvasCtx = canvas.getContext('2d')!;
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate progress point
    const progressPoint = progress * waveformData.length;

    // Render waveform bars with different colors for played/unplayed
    for (let i = 0; i < waveformData.length; i++) {
      const amplitude = waveformData[i];
      const isPlayed = i < progressPoint;
      const color = isPlayed ? '#666' : this.CONFIG.color; // Darker color for played portion
      this.fillBar(canvas, amplitude, i, waveformData.length, color);
    }

    return canvas;
  }

  /**
   * Update existing waveform canvas with new progress
   *
   * @param canvas Existing canvas element
   * @param waveformData Normalized amplitude data  
   * @param progress Progress ratio (0-1)
   */
  public static updateWaveformProgress(canvas: HTMLCanvasElement, waveformData: number[], progress: number): void {
    // Skip update if progress hasn't changed significantly (reduce unnecessary renders)
    const progressPoint = progress * waveformData.length;
    const lastProgressPoint = (canvas as any)._lastProgressPoint || 0;
    
    if (Math.abs(progressPoint - lastProgressPoint) < 0.5) {
      return; // Skip update if less than 0.5 bars difference
    }
    
    const canvasCtx = canvas.getContext('2d')!;
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    // Cache the progress point to avoid recalculation
    (canvas as any)._lastProgressPoint = progressPoint;

    // Render waveform bars with different colors for played/unplayed
    for (let i = 0; i < waveformData.length; i++) {
      const amplitude = waveformData[i];
      const isPlayed = i < progressPoint;
      const color = isPlayed ? '#666' : this.CONFIG.color; // Darker color for played portion
      this.fillBar(canvas, amplitude, i, waveformData.length, color);
    }
  }

  /**
   * Fill individual waveform bar following reference implementation
   *
   * @param canvas Target canvas element
   * @param amplitude Normalized amplitude (0-1)
   * @param index Bar index
   * @param numElements Total number of elements
   * @param colour Bar color
   */
  private static fillBar(
    canvas: HTMLCanvasElement,
    amplitude: number,
    index: number,
    numElements: number,
    colour = '#333',
  ): void {
    const ctx = canvas.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = colour;
    
    const graphHeight = canvas.height * amplitude;
    const barWidth = canvas.width / numElements;
    const position = index * barWidth;
    
    ctx.fillRect(position, canvas.height, barWidth, -graphHeight);
  }

  /**
   * Generate cache key for stream ID
   *
   * @param streamId Stream identifier
   * @returns Cache key string
   */
  private static getCacheKey(streamId: string): string {
    return `waveform_${streamId}`;
  }

  /**
   * Get cached waveform data if available and not expired
   *
   * @param streamId Stream identifier
   * @returns Cached waveform data or null
   */
  private static getCachedWaveformData(streamId: string): number[] | null {
    const cacheKey = this.getCacheKey(streamId);
    const timestamp = this.cacheTimestamps.get(cacheKey);
    
    if (!timestamp || (Date.now() - timestamp) > this.CONFIG.cacheTTL) {
      // Cache expired or doesn't exist
      this.cache.delete(cacheKey);
      this.cacheTimestamps.delete(cacheKey);
      return null;
    }
    
    return this.cache.get(cacheKey) || null;
  }

  /**
   * Get cached waveform data for external use
   *
   * @param streamId Stream identifier  
   * @returns Cached waveform data or null if not available
   */
  public static getWaveformDataForStream(streamId: string): number[] | null {
    return this.getCachedWaveformData(streamId);
  }

  /**
   * Cache waveform data with timestamp
   *
   * @param streamId Stream identifier
   * @param data Waveform data to cache
   */
  private static cacheWaveformData(streamId: string, data: number[]): void {
    const cacheKey = this.getCacheKey(streamId);
    this.cache.set(cacheKey, data);
    this.cacheTimestamps.set(cacheKey, Date.now());
  }

  /**
   * Clear expired cache entries to prevent memory leaks
   */
  public static clearExpiredCache(): void {
    const now = Date.now();
    
    for (const [cacheKey, timestamp] of this.cacheTimestamps.entries()) {
      if ((now - timestamp) > this.CONFIG.cacheTTL) {
        this.cache.delete(cacheKey);
        this.cacheTimestamps.delete(cacheKey);
      }
    }
  }

  /**
   * Clear all cached waveform data
   */
  public static clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Get cache statistics for debugging
   *
   * @returns Object with cache statistics
   */
  public static getCacheStats(): {size: number; entries: string[];} {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

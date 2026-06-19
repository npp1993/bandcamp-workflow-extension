/**
 * Shared types for the BPM-detection engine.
 *
 * This module (and everything else under utils/bpm) is intentionally PURE: no
 * DOM, no chrome.*, no Web Audio types. That is what lets the exact same code
 * run inside the extension (fed by the waveform pipeline's decoded AudioBuffer)
 * and inside the Node validation harness (fed by node-web-audio-api), so the
 * algorithm validated offline against rekordbox is byte-for-byte the shipped one.
 */

export interface BpmResult {
  /** Detected tempo folded into the target range, or null when gated out (beatless/low confidence). */
  bpm: number | null;
  /** Beat-strength score in 0..1 (autocorrelation peak prominence). Drives the ambient gate. */
  confidence: number;
  /** Pre-fold detected tempo, for the harness / debugging. */
  raw?: number;
}

export interface BpmAnalysisOptions {
  /** Lower bound of the dance-music fold range. */
  minBpm?: number;
  /** Upper bound of the dance-music fold range. */
  maxBpm?: number;
  /** Widest plausible true tempo to search for before octave-folding. */
  searchMinBpm?: number;
  /** Narrowest plausible true tempo to search for before octave-folding. */
  searchMaxBpm?: number;
  /** Onset-envelope frames per second (sets the analysis hop). */
  frameRate?: number;
  /** FFT window size (power of two) for the spectral-flux onset envelope. */
  fftSize?: number;
  /** Length (seconds) of the stationary middle slice analyzed. */
  windowSeconds?: number;
  /** Below this confidence the track is treated as beatless (bpm = null). */
  confidenceThreshold?: number;
  /** Experimental: add a harmonic comb to peak-picking (causes 4/3 locking; default off). */
  useComb?: boolean;
  /** Center of the perceptual tempo prior (BPM) that biases peak-picking toward dance tempi. */
  prefBpm?: number;
  /** Width of the tempo prior, in octaves (log2). Smaller = stronger pull toward prefBpm. */
  priorSigma?: number;
}

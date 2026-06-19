import {BpmAnalysisOptions, BpmResult} from './types';
import {foldToRange} from './fold-tempo';
import {fftInPlace} from './fft';

/**
 * Pure BPM detector. Takes mono PCM + sample rate and returns a tempo folded
 * into the dance-music range, plus a confidence score that gates beatless
 * (ambient) tracks to bpm = null.
 *
 * Pipeline: stationary middle window -> FFT spectral-flux onset envelope ->
 * variance-normalized autocorrelation over the plausible-tempo lag window ->
 * perceptual tempo prior -> parabolic peak interpolation -> octave fold. No
 * platform dependencies, so the extension and Node harness run identical code.
 */

const DEFAULTS: Required<BpmAnalysisOptions> = {
  minBpm: 100,
  maxBpm: 150,
  searchMinBpm: 60,
  searchMaxBpm: 200,
  frameRate: 172,
  fftSize: 1024,
  windowSeconds: 60,
  // Validated against 300 rekordbox-analyzed tracks: real beats score >= ~0.24,
  // beatless/weak tracks <= ~0.13, so 0.18 sits in the gap -- nulling ambient
  // without dropping confident detections.
  confidenceThreshold: 0.18,
  useComb: false,
  prefBpm: 128,
  priorSigma: 0.5,
};

export function analyzeBpm(
  channelData: Float32Array,
  sampleRate: number,
  options: BpmAnalysisOptions = {},
): BpmResult {
  const cfg = {...DEFAULTS, ...options};

  if (!channelData || channelData.length === 0 || sampleRate <= 0) {
    return {bpm: null, confidence: 0};
  }

  // 1. Analyze a stationary middle slice; dance tempo is constant, so a window
  //    is as good as the whole track and ~4x cheaper.
  const windowLen = Math.min(channelData.length, Math.floor(cfg.windowSeconds * sampleRate));
  const start = Math.max(0, Math.floor((channelData.length - windowLen) / 2));
  const slice = channelData.subarray(start, start + windowLen);

  // 2. Onset envelope via spectral flux: sum of positive bin-to-bin magnitude
  //    increases per frame. This marks percussive onsets far more cleanly than
  //    broadband energy flux, which is what determines whether the beat period
  //    (vs a 2/3 or 4/3 metrical level) wins the autocorrelation.
  const fftSize = cfg.fftSize;
  const hop = Math.max(1, Math.round(sampleRate / cfg.frameRate));
  const frameRate = sampleRate / hop;
  const nBins = fftSize >> 1;
  const nFrames = Math.floor((slice.length - fftSize) / hop) + 1;
  if (nFrames < 16) {
    return {bpm: null, confidence: 0};
  }

  // Hann window (reduces spectral leakage).
  const hann = new Float64Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1));
  }

  const re = new Float64Array(fftSize);
  const im = new Float64Array(fftSize);
  const prevMag = new Float32Array(nBins);
  const novelty = new Float32Array(nFrames);

  for (let f = 0; f < nFrames; f++) {
    const base = f * hop;
    for (let i = 0; i < fftSize; i++) {
      re[i] = slice[base + i] * hann[i];
      im[i] = 0;
    }
    fftInPlace(re, im);

    let flux = 0;
    for (let b = 0; b < nBins; b++) {
      const mag = Math.sqrt(re[b] * re[b] + im[b] * im[b]);
      const d = mag - prevMag[b];
      if (d > 0) {
        flux += d;
      }
      prevMag[b] = mag;
    }
    novelty[f] = flux;
  }

  // 3. Autocorrelation over the lag window for the search BPM range.
  const lagMin = Math.max(2, Math.floor((60 * frameRate) / cfg.searchMaxBpm));
  const lagMax = Math.min(nFrames - 1, Math.ceil((60 * frameRate) / cfg.searchMinBpm));
  if (lagMax <= lagMin) {
    return {bpm: null, confidence: 0};
  }

  // Mean-remove the novelty so the autocorrelation is a proper correlation
  // coefficient: ~1 at the beat period for a strong groove, ~0 for ambient.
  let mean = 0;
  for (let i = 0; i < nFrames; i++) {
    mean += novelty[i];
  }
  mean /= nFrames;

  const centered = new Float32Array(nFrames);
  let variance = 0;
  for (let i = 0; i < nFrames; i++) {
    const v = novelty[i] - mean;
    centered[i] = v;
    variance += v * v;
  }
  variance /= nFrames;
  if (variance <= 0) {
    return {bpm: null, confidence: 0};
  }

  // Overlap-averaged + variance-normalized autocorrelation. Averaging by the
  // overlap count removes the short-lag bias of a raw sum; the 60s window keeps
  // even the longest lag well-populated, so long lags aren't noisy.
  const ac = new Float32Array(lagMax + 1);
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let s = 0;
    const limit = nFrames - lag;
    for (let i = 0; i < limit; i++) {
      s += centered[i] * centered[i + lag];
    }
    ac[lag] = s / limit / variance;
  }

  // 4. Pick the beat period. A bare autocorrelation peak is deliberately used
  //    rather than a harmonic comb: a comb rewards a candidate at 3/4 of the true
  //    period (its 4th harmonic lands on a true multiple), causing systematic
  //    4/3 "triplet" tempo locking. Octave (2x) ambiguity is instead resolved by
  //    foldToRange. An optional comb is kept behind a flag for experimentation.
  // Perceptual tempo prior: a log-Gaussian over BPM centered on prefBpm. Dance
  // tempi cluster around ~128, so this down-weights the 4/3 "triplet" and the
  // half/double metrical levels that pure autocorrelation otherwise locks onto.
  const invTwoSigmaSq = 1 / (2 * cfg.priorSigma * cfg.priorSigma);
  const log2 = Math.log(2);
  let peakLag = lagMin;
  let bestScore = -Infinity;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let score = ac[lag];
    if (cfg.useComb) {
      // Sum autocorrelation at integer multiples of the candidate period. The
      // true tempo gets support at every multiple (2L, 3L, 4L are all real beat
      // multiples); a 4/3 "triplet" candidate only coincides at one harmonic, so
      // the comb suppresses it. Octave (L vs 2L) stays ambiguous -> foldToRange.
      for (let h = 2; h <= 4; h++) {
        const hl = h * lag;
        if (hl <= lagMax) {
          score += ac[hl] / h;
        }
      }
    }
    const bpm = (60 * frameRate) / lag;
    const octaves = Math.log(bpm / cfg.prefBpm) / log2;
    score *= Math.exp(-(octaves * octaves) * invTwoSigmaSq);
    if (score > bestScore) {
      bestScore = score;
      peakLag = lag;
    }
  }
  const confidence = Math.max(0, Math.min(1, ac[peakLag]));
  const coarseRaw = (60 * frameRate) / peakLag;

  if (confidence < cfg.confidenceThreshold) {
    return {bpm: null, confidence, raw: coarseRaw};
  }

  // 5. Parabolic interpolation around the peak for sub-frame lag precision.
  let refinedLag = peakLag;
  if (peakLag > lagMin && peakLag < lagMax) {
    const a = ac[peakLag - 1];
    const b = ac[peakLag];
    const c = ac[peakLag + 1];
    const denom = a - 2 * b + c;
    if (denom !== 0) {
      refinedLag = peakLag + (0.5 * (a - c)) / denom;
    }
  }

  const raw = (60 * frameRate) / refinedLag;
  const bpm = round2(foldToRange(raw, cfg.minBpm, cfg.maxBpm));

  return {bpm, confidence, raw};
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

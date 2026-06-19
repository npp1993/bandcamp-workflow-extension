/**
 * Octave-fold a detected tempo toward the dance-music range.
 *
 * Beat trackers routinely report a tempo at the wrong octave (half or double the
 * true value) because the autocorrelation of a 4/4 groove peaks at the beat
 * period AND its multiples. Folding by x2 / /2 collapses those octave errors
 * onto a single canonical value in [minBpm, maxBpm].
 *
 * Note: [100, 150] is NARROWER than a full octave (which would be [100, 200)),
 * so some genuine tempos (e.g. a true 84) have no image inside the window. For
 * those we return the octave multiple closest to the range rather than
 * oscillating — accepting that genuine half-time/downtempo tracks may read
 * "wrong" (this is an explicit, accepted limitation).
 */
export function foldToRange(bpm: number, minBpm = 100, maxBpm = 150): number {
  if (!isFinite(bpm) || bpm <= 0) {
    return bpm;
  }

  let folded = bpm;
  let guard = 0;
  while (folded < minBpm && guard < 16) {
    folded *= 2;
    guard++;
  }
  guard = 0;
  while (folded > maxBpm && guard < 16) {
    folded /= 2;
    guard++;
  }

  // If the value still can't sit inside the (sub-octave) window, pick the octave
  // multiple of the ORIGINAL tempo that lands closest to the range.
  if (folded < minBpm || folded > maxBpm) {
    const center = Math.sqrt(minBpm * maxBpm);
    let best = folded;
    let bestScore = Infinity;
    for (let k = -4; k <= 4; k++) {
      const candidate = bpm * Math.pow(2, k);
      if (candidate <= 0) {
        continue;
      }
      // Distance to the range (0 when inside), tie-broken toward the centre.
      const distance = candidate < minBpm
        ? minBpm - candidate
        : candidate > maxBpm
          ? candidate - maxBpm
          : 0;
      const tieBreak = Math.abs(Math.log(candidate / center)) * 1e-4;
      const score = distance + tieBreak;
      if (score < bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    folded = best;
  }

  return folded;
}

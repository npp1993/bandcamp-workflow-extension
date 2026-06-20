import {analyzeBpm} from '../utils/bpm/analyze-bpm';
import {BpmResult} from '../utils/bpm/types';

/**
 * Dedicated Web Worker that runs the (heavy) BPM analysis off the main thread, so
 * the ~hundreds-of-ms FFT/autocorrelation pass on each track decode never janks
 * the page. It runs the SAME pure analyzeBpm() the extension and harness use.
 */

interface BpmRequest {
  token: number;
  streamId: string;
  sampleRate: number;
  channel: Float32Array;
}

interface BpmResponse {
  token: number;
  streamId: string;
  result: BpmResult;
}

// In a dedicated worker `self` is the worker global scope; the project's tsconfig
// only pulls in the DOM lib (not WebWorker), so type just the bits we use here.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<BpmRequest>) => void) | null;
  postMessage: (message: BpmResponse) => void;
};

ctx.onmessage = (e): void => {
  const {token, streamId, sampleRate, channel} = e.data;
  let result: BpmResult;
  try {
    result = analyzeBpm(channel, sampleRate);
  } catch {
    result = {bpm: null, confidence: 0};
  }
  ctx.postMessage({token, streamId, result});
};

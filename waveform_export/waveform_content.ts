// Minimal content script for Bandcamp waveform extraction and rendering (TypeScript)
// Usage: inject this on Bandcamp track/album pages

// 1. Find the audio element
const audio = document.querySelector("audio") as HTMLAudioElement | null;
if (!audio) throw new Error("No audio element found");

// 2. Extract stream ID from audio.src
const match = audio.src.match(/stream\/(.+)$/);
if (!match) throw new Error("Could not extract stream ID from audio src");
const streamId = match[1];

// 3. Request audio buffer from background script
chrome.runtime.sendMessage(
  {
    contentScriptQuery: "renderBuffer",
    url: streamId
  },
  (response: { data?: number[]; error?: string }) => {
    if (!response || response.error) {
      console.error("Failed to fetch audio buffer", response && response.error);
      return;
    }
    // 4. Decode and render waveform
    renderWaveformFromBuffer(response.data!);
  }
);

// 5. Render waveform on a canvas
function renderWaveformFromBuffer(uint8ArrayData: number[], datapoints = 100) {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 60;
  canvas.style.display = "block";
  canvas.style.margin = "1em auto";
  document.body.prepend(canvas);

  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = new Uint8Array(uint8ArrayData).buffer;
  ctx.decodeAudioData(audioBuffer).then((decodedAudio: AudioBuffer) => {
    const leftChannel = decodedAudio.getChannelData(0);
    const stepSize = Math.round(decodedAudio.length / datapoints);
    const rmsSize = Math.min(stepSize, 128);
    const subStepSize = Math.round(stepSize / rmsSize);
    let rmsBuffer: number[] = [];
    for (let i = 0; i < datapoints; i++) {
      let rms = 0.0;
      for (let sample = 0; sample < rmsSize; sample++) {
        const sampleIndex = i * stepSize + sample * subStepSize;
        let audioSample = leftChannel[sampleIndex];
        rms += audioSample ** 2;
      }
      rmsBuffer.push(Math.sqrt(rms / rmsSize));
    }
    const max = Math.max(...rmsBuffer);
    const canvasCtx = canvas.getContext("2d")!;
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < rmsBuffer.length; i++) {
      let amplitude = rmsBuffer[i] / max;
      fillBar(canvas, amplitude, i, datapoints, "#333");
    }
  });
}

function fillBar(
  canvas: HTMLCanvasElement,
  amplitude: number,
  index: number,
  numElements: number,
  colour = "#333"
) {
  const ctx = canvas.getContext("2d")!;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = colour;
  const graphHeight = canvas.height * amplitude;
  const barWidth = canvas.width / numElements;
  const position = index * barWidth;
  ctx.fillRect(position, canvas.height, barWidth, -graphHeight);
}

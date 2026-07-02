const SAMPLE_RATE = 44100;
const DURATION_SECONDS = 8;
const CHANNELS = 1;
const BYTES_PER_SAMPLE = 2;
const SAMPLE_COUNT = SAMPLE_RATE * DURATION_SECONDS;
const WAV_HEADER_BYTES = 44;

function writeAscii(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function createPreviewWav() {
  const dataBytes = SAMPLE_COUNT * CHANNELS * BYTES_PER_SAMPLE;
  const bytes = new Uint8Array(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(bytes.buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(32, CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < SAMPLE_COUNT; i += 1) {
    const t = i / SAMPLE_RATE;
    const beat = t % 0.5;
    const bar = Math.floor(t / 2) % 2;

    const kickEnvelope = beat < 0.12 ? Math.exp(-beat * 28) : 0;
    const kick = Math.sin(2 * Math.PI * (58 - beat * 110) * t) * kickEnvelope * 0.85;

    const snareBeat = (t + 0.5) % 1;
    const snareEnvelope = snareBeat < 0.09 ? Math.exp(-snareBeat * 34) : 0;
    const snareNoise = Math.sin(2 * Math.PI * 1730 * t) * Math.sin(2 * Math.PI * 2917 * t);
    const snare = snareNoise * snareEnvelope * 0.22;

    const hatBeat = t % 0.25;
    const hatEnvelope = hatBeat < 0.025 ? Math.exp(-hatBeat * 120) : 0;
    const hat = Math.sin(2 * Math.PI * 8200 * t) * hatEnvelope * 0.08;

    const bassNote = bar === 0 ? 73.42 : 65.41;
    const bass = Math.sin(2 * Math.PI * bassNote * t) * 0.18;
    const pad = Math.sin(2 * Math.PI * 146.83 * t) * 0.08
      + Math.sin(2 * Math.PI * 220 * t) * 0.05;

    const fadeIn = Math.min(1, t / 0.08);
    const fadeOut = Math.min(1, (DURATION_SECONDS - t) / 0.12);
    const sample = Math.max(-1, Math.min(1, (kick + snare + hat + bass + pad) * 0.62 * fadeIn * fadeOut));
    view.setInt16(WAV_HEADER_BYTES + i * BYTES_PER_SAMPLE, sample * 32767, true);
  }

  return bytes;
}

const previewAudio = createPreviewWav();

export function GET() {
  return new Response(previewAudio, {
    headers: {
      'Content-Type': 'audio/wav',
      'Content-Length': String(previewAudio.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

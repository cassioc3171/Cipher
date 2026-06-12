/**
 * Audio LSB Steganography
 *
 * Encodes binary data into the least-significant bit of 16-bit PCM audio
 * samples. The carrier must be lossless (WAV). Lossy formats (MP3, AAC, Opus)
 * will destroy the embedded data.
 *
 * Layout: [32-bit length] [32-bit CRC-32] [payload bytes]
 * Each bit replaces the LSB of one sample in channel 0.
 *
 * Implementation notes:
 *  - Float-to-int16 conversion is done through ONE helper used by encode,
 *    decode, and the WAV writer. Previously encode used `* 32767` while
 *    `audioBufferToWav` used `* 32768` for negative samples — that
 *    asymmetry corrupted LSBs of negative samples on save/reload.
 *  - The bit stream is materialised on the fly rather than into a
 *    `number[]` of every-bit-in-the-audio, which would OOM on long clips.
 *  - For stereo input the WAV writer now preserves both channels
 *    (interleaved). Previously the right channel was silently dropped.
 *    The payload still lives in channel 0 only — channel 1 is untouched.
 */

import { crc32 } from './crc32';

const HEADER_BITS = 32;
const CRC_BITS = 32;
const META_BITS = HEADER_BITS + CRC_BITS;

/* ===== Float ↔ int16 (consistent across encode / decode / WAV write) ===== */

/**
 * Convert a normalized float sample to a 16-bit PCM integer.
 * Uses a single divisor (32768) for both positive and negative, with
 * saturation at the int16 boundaries. Inverse is `int16ToFloat`.
 */
function floatToInt16(s: number): number {
  const scaled = Math.round(s * 32768);
  if (scaled > 32767) return 32767;
  if (scaled < -32768) return -32768;
  return scaled;
}

function int16ToFloat(s16: number): number {
  return s16 / 32768;
}

/* ===== Capacity ===== */

/** Maximum payload bytes for a given number of PCM samples (one channel). */
export function audioCapacity(totalSamples: number): number {
  return Math.max(0, Math.floor((totalSamples - META_BITS) / 8));
}

/* ===== File decode ===== */

/**
 * Decode an audio file into raw PCM float samples using the Web Audio API.
 * Returns the AudioBuffer so we can reconstruct a WAV later.
 */
/** Read the sample rate from a WAV `fmt ` chunk, or null if not a WAV. */
function readWavSampleRate(buf: ArrayBuffer): number | null {
  try {
    const view = new DataView(buf);
    const tag = (o: number) =>
      String.fromCharCode(view.getUint8(o), view.getUint8(o + 1), view.getUint8(o + 2), view.getUint8(o + 3));
    if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
    let off = 12;
    while (off + 8 <= view.byteLength) {
      const id = tag(off);
      const size = view.getUint32(off + 4, true);
      if (id === 'fmt ') return view.getUint32(off + 12, true); // sampleRate field
      off += 8 + size + (size % 2);
    }
    return null;
  } catch {
    return null;
  }
}

export async function decodeAudioFile(file: Blob): Promise<AudioBuffer> {
  const arrayBuf = await file.arrayBuffer();
  // Decode at the carrier's NATIVE rate. decodeAudioData resamples to the
  // context's sampleRate, and resampling rewrites every sample — destroying
  // the embedded LSB bits for any non-44.1kHz WAV. Reading the WAV's own rate
  // (the carrier is required to be lossless WAV) avoids that.
  const rate = readWavSampleRate(arrayBuf) ?? 44100;
  const ctx = new OfflineAudioContext(1, 1, rate);
  return ctx.decodeAudioData(arrayBuf);
}

/* ===== Encode / Decode ===== */

/**
 * Encode payload into audio samples (mutates the Float32Array in place).
 * Operates on the first channel only. Throws if the payload exceeds capacity.
 */
export function encodeIntoAudio(samples: Float32Array, payload: Uint8Array): void {
  const cap = audioCapacity(samples.length);
  if (payload.length > cap) {
    throw new Error(`Payload (${payload.length} B) exceeds audio capacity (${cap} B)`);
  }

  const check = crc32(payload) >>> 0;
  const totalBits = META_BITS + payload.length * 8;

  const bitAt = (idx: number): number => {
    if (idx < HEADER_BITS) {
      return (payload.length >>> (HEADER_BITS - 1 - idx)) & 1;
    }
    if (idx < META_BITS) {
      return (check >>> (META_BITS - 1 - idx)) & 1;
    }
    const offset = idx - META_BITS;
    const byteIdx = offset >>> 3;
    const bitInByte = 7 - (offset & 7);
    return (payload[byteIdx] >>> bitInByte) & 1;
  };

  for (let i = 0; i < totalBits; i++) {
    const s16 = floatToInt16(samples[i]);
    const modified = (s16 & ~1) | bitAt(i);
    samples[i] = int16ToFloat(modified);
  }
}

/**
 * Decode payload from audio samples. Returns null on CRC mismatch
 * or implausible length.
 */
export function decodeFromAudio(samples: Float32Array): Uint8Array | null {
  if (samples.length < META_BITS) return null;

  const readBit = (idx: number): number => floatToInt16(samples[idx]) & 1;

  let len = 0;
  for (let i = 0; i < HEADER_BITS; i++) len = (len << 1) | readBit(i);
  if (len <= 0 || len > audioCapacity(samples.length)) return null;

  let storedCrc = 0;
  for (let i = HEADER_BITS; i < META_BITS; i++) storedCrc = (storedCrc << 1) | readBit(i);

  const needed = META_BITS + len * 8;
  if (needed > samples.length) return null;

  const payload = new Uint8Array(len);
  let bitIdx = META_BITS;
  for (let i = 0; i < len; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | readBit(bitIdx++);
    payload[i] = byte;
  }

  if ((crc32(payload) >>> 0) !== (storedCrc >>> 0)) return null;
  return payload;
}

/* ===== WAV writer ===== */

/**
 * Encode an AudioBuffer into a 16-bit PCM WAV Blob. Preserves stereo if
 * the source is stereo (interleaved), so right-channel audio is no longer
 * silently dropped. Uses the same float↔int16 conversion as encode/decode
 * so embedded LSBs survive the save→reload round-trip.
 */
/**
 * Build a 16-bit PCM WAV (44-byte header + interleaved LE int16 samples) from
 * one or two channels of float samples. Pure (no DOM/AudioBuffer) so it is unit-
 * testable in Node and shared by `audioBufferToWav`. The byte layout is the
 * cross-platform contract proven by `shared/steg-audio-vectors.json`.
 */
export function pcmToWav(channelData: Float32Array[], sampleRate: number): ArrayBuffer {
  const numChannels = channelData.length;
  const frameCount = channelData[0].length;
  const bytesPerSample = 2;
  const dataLength = frameCount * numChannels * bytesPerSample;
  const headerLength = 44;
  const buf = new ArrayBuffer(headerLength + dataLength);
  const view = new DataView(buf);

  // RIFF header
  writeStr(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeStr(view, 8, 'WAVE');
  // fmt chunk
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true); // block align
  view.setUint16(34, bytesPerSample * 8, true); // bits per sample
  // data chunk
  writeStr(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < frameCount; i++) {
    for (let c = 0; c < numChannels; c++) {
      view.setInt16(offset, floatToInt16(channelData[c][i]), true);
      offset += 2;
    }
  }

  return buf;
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const channelData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channelData.push(buffer.getChannelData(c));
  return new Blob([pcmToWav(channelData, buffer.sampleRate)], { type: 'audio/wav' });
}

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

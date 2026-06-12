/**
 * Raw encoding: package encrypted CT2/CT4 strings as binary files.
 * - Noise WAV: encrypted bytes as 16-bit PCM samples → sounds like static
 * - Snow PNG:  encrypted bytes as RGB pixels → looks like TV snow
 *
 * Format: [4-byte LE length] [payload bytes] [zero-padding to alignment]
 */

import { isCipherEnvelope } from './crypto';

const WAV_SAMPLE_RATE = 8000; // low quality is fine — it's just a container

/* ========== WAV (noise) ========== */

export function encryptedToWav(ct2: string): Blob {
  const payload = new TextEncoder().encode(ct2);
  const len = payload.length;

  // Pad to even (16-bit samples need pairs of bytes)
  const padded = len % 2 === 0 ? len : len + 1;
  const totalDataBytes = 4 + padded; // 4-byte length header + payload

  // WAV: 44-byte header + data
  const buf = new ArrayBuffer(44 + totalDataBytes);
  const view = new DataView(buf);

  // RIFF header
  writeStr(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalDataBytes, true);
  writeStr(view, 8, 'WAVE');

  // fmt chunk
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);         // chunk size
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // mono
  view.setUint32(24, WAV_SAMPLE_RATE, true);
  view.setUint32(28, WAV_SAMPLE_RATE * 2, true); // byte rate (16-bit mono)
  view.setUint16(32, 2, true);          // block align
  view.setUint16(34, 16, true);         // bits per sample

  // data chunk
  writeStr(view, 36, 'data');
  view.setUint32(40, totalDataBytes, true);

  // Write length header (LE 32-bit)
  view.setUint32(44, len, true);

  // Write payload
  const dst = new Uint8Array(buf);
  dst.set(payload, 48);

  return new Blob([buf], { type: 'audio/wav' });
}

export function wavToEncrypted(data: ArrayBuffer): string | null {
  try {
    const view = new DataView(data);

    // Validate RIFF/WAVE
    if (readStr(view, 0, 4) !== 'RIFF' || readStr(view, 8, 4) !== 'WAVE') return null;

    // Find data chunk
    let offset = 12;
    while (offset < data.byteLength - 8) {
      const id = readStr(view, offset, 4);
      const size = view.getUint32(offset + 4, true);
      if (id === 'data') {
        const dataStart = offset + 8;
        const payloadLen = view.getUint32(dataStart, true);
        if (payloadLen > size - 4 || payloadLen > 10_000_000) return null; // sanity
        const payload = new Uint8Array(data, dataStart + 4, payloadLen);
        const text = new TextDecoder().decode(payload);
        return isCipherEnvelope(text) ? text : null;
      }
      offset += 8 + size;
      if (size % 2 !== 0) offset++; // WAV chunks are 2-byte aligned
    }
    return null;
  } catch {
    return null;
  }
}

/* ========== PNG (snow) ========== */

/**
 * Pure RGBA packing for the snow-PNG carrier (no canvas) — testable in Node and
 * the cross-platform contract proven by `shared/raw-encode-vectors.json`. Layout:
 * [4-byte big-endian length] [payload] packed 3 bytes per RGB pixel (alpha=255).
 */
export function encryptedToPngPixels(ct2: string): { data: Uint8ClampedArray; width: number; height: number } {
  const payload = new TextEncoder().encode(ct2);
  const len = payload.length;
  const totalBytes = 4 + len;
  const pixelCount = Math.ceil(totalBytes / 3);
  const side = Math.ceil(Math.sqrt(pixelCount));
  const w = side;
  const h = Math.ceil(pixelCount / w);

  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, len, false); // big-endian
  const all = new Uint8Array(4 + len);
  all.set(header, 0);
  all.set(payload, 4);

  const data = new Uint8ClampedArray(w * h * 4);
  let bi = 0;
  for (let pi = 0; pi < w * h; pi++) {
    const base = pi * 4;
    data[base] = bi < all.length ? all[bi++] : 0; // R
    data[base + 1] = bi < all.length ? all[bi++] : 0; // G
    data[base + 2] = bi < all.length ? all[bi++] : 0; // B
    data[base + 3] = 255; // A — always opaque
  }
  return { data, width: w, height: h };
}

function encryptedToPng(ct2: string): HTMLCanvasElement {
  const { data, width, height } = encryptedToPngPixels(ct2);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(width, height);
  imgData.data.set(data);
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

export async function encryptedToPngBlob(ct2: string): Promise<Blob> {
  const canvas = encryptedToPng(ct2);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}

export function pngToEncrypted(imageData: ImageData): string | null {
  try {
    const d = imageData.data;
    const w = imageData.width;
    const h = imageData.height;

    // Read length header from first 2 pixels (4 bytes from R,G,B channels)
    if (w * h < 2) return null;
    const headerBytes = new Uint8Array(4);
    // Pixel 0: R=byte0, G=byte1, B=byte2; Pixel 1: R=byte3 (only need byte 0-3)
    let bi = 0;
    for (let pi = 0; pi < 2 && bi < 4; pi++) {
      const base = pi * 4;
      if (bi < 4) headerBytes[bi++] = d[base];
      if (bi < 4) headerBytes[bi++] = d[base + 1];
      if (bi < 4) headerBytes[bi++] = d[base + 2];
    }

    const len = new DataView(headerBytes.buffer).getUint32(0, false); // big-endian
    // Max payload = total RGB channels minus the 4-byte length header.
    if (len > w * h * 3 - 4 || len > 10_000_000) return null; // sanity check

    // Read payload bytes
    const payload = new Uint8Array(len);
    bi = 0;
    let written = 0;
    const skip = 4; // skip 4 header bytes first
    for (let pi = 0; pi < w * h && written < len; pi++) {
      const base = pi * 4;
      for (let c = 0; c < 3 && written < len; c++) {
        if (bi >= skip) {
          payload[written++] = d[base + c];
        }
        bi++;
      }
    }

    const text = new TextDecoder().decode(payload);
    return isCipherEnvelope(text) ? text : null;
  } catch {
    return null;
  }
}

/* ========== Helpers ========== */

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function readStr(view: DataView, offset: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

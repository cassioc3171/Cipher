/**
 * Image LSB Steganography
 *
 * Encodes arbitrary binary data into the least-significant bits of an image's
 * RGBA pixel data. Uses 2 LSBs per colour channel (R, G, B — alpha untouched)
 * giving 6 bits per pixel. A 32-bit length header is written first, followed
 * by a CRC-32 integrity check, then the payload.
 *
 * Carrier format: PNG (lossless) — JPEG will destroy LSB data.
 *
 * Implementation notes:
 *  - Uses a regular HTMLCanvasElement instead of OffscreenCanvas for broad
 *    compatibility (OffscreenCanvas needs iOS Safari 16.4+, Mar 2023).
 *  - Avoids materialising a JS number[] of every bit in the image — the bits
 *    are computed on the fly from the payload bytes. A 4K image carries
 *    24M bits, and a `number[]` of that size can OOM on a 2 GB phone.
 */

import { crc32 } from './crc32';

const BITS_PER_CHANNEL = 2;
const CHANNELS_USED = 3; // R, G, B (skip A)
const BITS_PER_PIXEL = BITS_PER_CHANNEL * CHANNELS_USED; // 6
const HEADER_BITS = 32; // payload length in bytes
const CRC_BITS = 32;
const META_BITS = HEADER_BITS + CRC_BITS;

/** Returns the maximum number of payload bytes this canvas can carry. */
export function imageCapacity(width: number, height: number): number {
  const totalBits = width * height * BITS_PER_PIXEL;
  return Math.max(0, Math.floor((totalBits - META_BITS) / 8));
}

/** Load an image file (or blob) into a Canvas and return its ImageData. */
export async function loadImageData(
  source: Blob | File,
): Promise<{ imageData: ImageData; width: number; height: number }> {
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.src = url;
    // `decode()` resolves once the image is fully ready to draw — supported
    // on iOS Safari since v11 and every desktop browser since 2017.
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return { imageData, width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Encode `payload` into the pixel data of the given ImageData (mutates in place).
 * Throws if the payload exceeds capacity.
 */
export function encodeIntoImage(imageData: ImageData, payload: Uint8Array): void {
  const cap = imageCapacity(imageData.width, imageData.height);
  if (payload.length > cap) {
    throw new Error(`Payload (${payload.length} B) exceeds image capacity (${cap} B)`);
  }

  const check = crc32(payload) >>> 0;
  const totalBits = META_BITS + payload.length * 8;

  // Bit `idx` of the logical [length32 | crc32 | payload] stream, computed
  // on the fly (no intermediate array).
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

  const d = imageData.data;
  const mask = (1 << BITS_PER_CHANNEL) - 1; // 0b11
  let bitIdx = 0;
  const totalPixels = d.length >>> 2;

  for (let px = 0; px < totalPixels && bitIdx < totalBits; px++) {
    const base = px * 4;
    for (let ch = 0; ch < CHANNELS_USED && bitIdx < totalBits; ch++) {
      let val = 0;
      for (let k = 0; k < BITS_PER_CHANNEL; k++) {
        val = (val << 1) | (bitIdx < totalBits ? bitAt(bitIdx++) : 0);
      }
      d[base + ch] = (d[base + ch] & ~mask) | val;
    }
  }
}

/**
 * Decode a payload from the pixel data. Returns `null` if CRC mismatch
 * or if the embedded length is implausible.
 */
export function decodeFromImage(imageData: ImageData): Uint8Array | null {
  const d = imageData.data;
  const totalPixels = d.length >>> 2;
  const totalAvailableBits = totalPixels * BITS_PER_PIXEL;
  if (totalAvailableBits < META_BITS) return null;

  // Read a single logical bit `idx` from the image's LSB stream, on the fly.
  const readBit = (idx: number): number => {
    const channelIdx = (idx / BITS_PER_CHANNEL) | 0;
    const bitInChannel = (BITS_PER_CHANNEL - 1) - (idx % BITS_PER_CHANNEL);
    const pxIdx = (channelIdx / CHANNELS_USED) | 0;
    const ch = channelIdx - pxIdx * CHANNELS_USED;
    return (d[pxIdx * 4 + ch] >>> bitInChannel) & 1;
  };

  // 32-bit length
  let len = 0;
  for (let i = 0; i < HEADER_BITS; i++) len = (len << 1) | readBit(i);
  const cap = imageCapacity(imageData.width, imageData.height);
  if (len <= 0 || len > cap) return null;

  // 32-bit CRC
  let storedCrc = 0;
  for (let i = HEADER_BITS; i < META_BITS; i++) storedCrc = (storedCrc << 1) | readBit(i);

  const needed = META_BITS + len * 8;
  if (needed > totalAvailableBits) return null;

  // Payload
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

/** Export the modified ImageData as a PNG Blob. */
export async function imageDataToPng(imageData: ImageData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.putImageData(imageData, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob() returned null'));
    }, 'image/png');
  });
}

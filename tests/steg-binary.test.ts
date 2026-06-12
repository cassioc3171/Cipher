import { describe, it, expect } from 'vitest';
import { imageCapacity, encodeIntoImage, decodeFromImage } from '../src/lib/stegImage';
import { audioCapacity, encodeIntoAudio, decodeFromAudio } from '../src/lib/stegAudio';
import { encryptedToWav, wavToEncrypted, pngToEncrypted } from '../src/lib/rawEncode';

// A representative ciphertext envelope (what the app actually hides).
const ENVELOPE = 'CT4|T|mskJe/HGSXbFUNyrHzR3IQ==|lXSNK2I5GdUlMg2b|CbxndKWAuqMZkA7Ql99sndVlFAUn294TU7Fu';
const bytes = (s: string) => new TextEncoder().encode(s);
const text = (u: Uint8Array) => new TextDecoder().decode(u);

function fakeImageData(w: number, h: number, fill = 128): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i++) data[i] = i % 4 === 3 ? 255 : fill;
  return { data, width: w, height: h, colorSpace: 'srgb' } as ImageData;
}

describe('image LSB steg (stegImage.ts)', () => {
  it('round-trips a payload through synthetic ImageData', () => {
    const img = fakeImageData(64, 64);
    const payload = bytes(ENVELOPE);
    expect(payload.length).toBeLessThanOrEqual(imageCapacity(64, 64));
    encodeIntoImage(img, payload);
    const out = decodeFromImage(img);
    expect(out).not.toBeNull();
    expect(text(out!)).toBe(ENVELOPE);
  });

  it('throws when the payload exceeds capacity', () => {
    const img = fakeImageData(8, 8);
    expect(() => encodeIntoImage(img, new Uint8Array(imageCapacity(8, 8) + 1))).toThrow(/capacity/);
  });

  it('returns null for an image with no embedded data', () => {
    expect(decodeFromImage(fakeImageData(32, 32, 0))).toBeNull();
  });

  it('returns null when an embedded payload is corrupted (CRC catches it)', () => {
    const img = fakeImageData(64, 64);
    encodeIntoImage(img, bytes(ENVELOPE));
    img.data[4 * 20] ^= 0b11; // flip 2 LSBs of a pixel well inside the payload
    expect(decodeFromImage(img)).toBeNull();
  });
});

describe('audio LSB steg (stegAudio.ts)', () => {
  it('round-trips a payload through synthetic PCM samples (survives float<->int16)', () => {
    const n = 4000;
    const samples = new Float32Array(n);
    for (let i = 0; i < n; i++) samples[i] = Math.sin(i * 0.05) * 0.6;
    const payload = bytes(ENVELOPE);
    expect(payload.length).toBeLessThanOrEqual(audioCapacity(n));
    encodeIntoAudio(samples, payload);
    const out = decodeFromAudio(samples);
    expect(out).not.toBeNull();
    expect(text(out!)).toBe(ENVELOPE);
  });

  it('round-trips even when samples sit at the ±1.0 clipping boundary', () => {
    const n = 2000;
    const samples = new Float32Array(n);
    for (let i = 0; i < n; i++) samples[i] = i % 2 === 0 ? 1.0 : -1.0;
    const payload = bytes('CT4|short|payload|here|==');
    encodeIntoAudio(samples, payload);
    expect(text(decodeFromAudio(samples)!)).toBe('CT4|short|payload|here|==');
  });

  it('throws when the payload exceeds capacity', () => {
    const samples = new Float32Array(200);
    expect(() => encodeIntoAudio(samples, new Uint8Array(audioCapacity(200) + 1))).toThrow(/capacity/);
  });
});

describe('rawEncode noise-WAV container (rawEncode.ts)', () => {
  it('round-trips a ciphertext envelope through a noise WAV', async () => {
    const buf = await encryptedToWav(ENVELOPE).arrayBuffer();
    expect(wavToEncrypted(buf)).toBe(ENVELOPE);
  });

  it('round-trips an odd-length payload (tests the pad-to-even path)', async () => {
    const odd = 'CT4|odd-length-envelope-xyz'; // odd byte count
    const buf = await encryptedToWav(odd).arrayBuffer();
    expect(wavToEncrypted(buf)).toBe(odd);
  });

  it('returns null for a non-WAV buffer', () => {
    expect(wavToEncrypted(bytes('this is not a wav file at all').buffer as ArrayBuffer)).toBeNull();
  });
});

describe('rawEncode snow-PNG container (rawEncode.ts)', () => {
  // Build the ImageData encryptedToPng would produce (4-byte BE length header +
  // payload packed into RGB channels) so the decoder can be tested without a canvas.
  function fakeSnowPng(payloadStr: string): ImageData {
    const payload = bytes(payloadStr);
    const len = payload.length;
    const pixelCount = Math.ceil((4 + len) / 3);
    const w = Math.ceil(Math.sqrt(pixelCount));
    const h = Math.ceil(pixelCount / w);
    const all = new Uint8Array(4 + len);
    all[0] = (len >>> 24) & 0xff; // 4-byte big-endian length header
    all[1] = (len >>> 16) & 0xff;
    all[2] = (len >>> 8) & 0xff;
    all[3] = len & 0xff;
    all.set(payload, 4);
    const data = new Uint8ClampedArray(w * h * 4);
    let bi = 0;
    for (let pi = 0; pi < w * h; pi++) {
      const base = pi * 4;
      data[base] = bi < all.length ? all[bi++] : 0;
      data[base + 1] = bi < all.length ? all[bi++] : 0;
      data[base + 2] = bi < all.length ? all[bi++] : 0;
      data[base + 3] = 255;
    }
    return { data, width: w, height: h, colorSpace: 'srgb' } as ImageData;
  }

  it('round-trips a ciphertext envelope through a snow PNG', () => {
    expect(pngToEncrypted(fakeSnowPng(ENVELOPE))).toBe(ENVELOPE);
  });

  it('returns null for an image with no valid envelope', () => {
    const blank = { data: new Uint8ClampedArray(8 * 8 * 4), width: 8, height: 8, colorSpace: 'srgb' } as ImageData;
    expect(pngToEncrypted(blank)).toBeNull();
  });
});

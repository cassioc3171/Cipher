// tests/steg-image-vectors.test.ts
//
// Canonical RGBA pixel-array vectors for steg-image (§6 item 2.1). Web = source of truth.
// PNG container bytes never match across encoders, so the contract is defined at the
// RGBA-pixel level: fixed synthetic carrier (the fakeImageData pattern) + fixed payload
// → byte-exact embedded pixel array + [len32 | crc32 | payload] bit layout.
//
// CODEGEN_WRITE=1 npx vitest run tests/steg-image-vectors.test.ts  → (re)writes shared/steg-image-vectors.json
// npm test                                                         → web round-trip + drift-check
//
// The Kotlin :core StegImageVectorsTest reads the committed file and MUST produce a
// byte-identical embed (and decode it back). Container-level cross-decode (real PNGs)
// is proven in the Phase-5 live loop (§9.1).

import { describe, it, expect } from 'vitest';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { imageCapacity, encodeIntoImage, decodeFromImage } from '../src/lib/stegImage';
import { crc32 } from '../src/lib/crc32';

const WRITE = process.env.CODEGEN_WRITE === '1';
const VECTORS = resolve(process.cwd(), 'shared/steg-image-vectors.json');
const ENVELOPE = 'CT4|T|mskJe/HGSXbFUNyrHzR3IQ==|lXSNK2I5GdUlMg2b|CbxndKWAuqMZkA7Ql99sndVlFAUn294TU7Fu';

function fakeImageData(w: number, h: number, fill: number): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i++) data[i] = i % 4 === 3 ? 255 : fill; // alpha=255, RGB=fill
  return { data, width: w, height: h, colorSpace: 'srgb' } as ImageData;
}
const b64 = (u: Uint8Array): string => Buffer.from(u).toString('base64');

interface Case {
  id: string;
  width: number;
  height: number;
  fill: number;
  payloadB64: string;
  length: number;
  crc32: number;
  embeddedB64: string;
}

function buildCase(id: string, w: number, h: number, fill: number, payload: Uint8Array): Case {
  const img = fakeImageData(w, h, fill);
  encodeIntoImage(img, payload);
  return {
    id,
    width: w,
    height: h,
    fill,
    payloadB64: b64(payload),
    length: payload.length,
    crc32: crc32(payload) >>> 0,
    embeddedB64: b64(Uint8Array.from(img.data)),
  };
}

describe('steg-image canonical vectors (shared/steg-image-vectors.json)', () => {
  const payload = new TextEncoder().encode(ENVELOPE);
  const cases: Case[] = [
    buildCase('env-32x32-fill128', 32, 32, 128, payload), // LSBs start 00
    buildCase('env-32x32-fill255', 32, 32, 255, payload), // LSBs start 11 (mask path)
    buildCase('env-48x16-fill0', 48, 16, 0, payload), // non-square, LSBs start 00
  ];
  const built = {
    spec: 'steg-image RGBA pixel-array vectors; 2 LSB/RGB alpha-untouched; [len32|crc32|payload] MSB-first; CRC32 zlib',
    cases,
  };

  it('web decodes each vector back to its payload (algorithm self-check)', () => {
    for (const c of cases) {
      const img = fakeImageData(c.width, c.height, c.fill);
      img.data.set(Buffer.from(c.embeddedB64, 'base64'));
      const out = decodeFromImage(img);
      expect(out, c.id).not.toBeNull();
      expect(b64(out!), c.id).toBe(c.payloadB64);
    }
  });

  it('writes or drift-checks shared/steg-image-vectors.json', () => {
    if (WRITE) {
      mkdirSync(dirname(VECTORS), { recursive: true });
      writeFileSync(VECTORS, JSON.stringify(built, null, 2) + '\n', 'utf8');
    }
    expect(existsSync(VECTORS)).toBe(true);
    expect(JSON.parse(readFileSync(VECTORS, 'utf8'))).toEqual(built);
  });

  it('capacity formula + CRC corruption behave as specified', () => {
    expect(imageCapacity(32, 32)).toBe(Math.floor((32 * 32 * 6 - 64) / 8));
    const img = fakeImageData(32, 32, 128);
    encodeIntoImage(img, payload);
    img.data[4 * 20] ^= 0b11; // flip 2 LSBs inside the payload region
    expect(decodeFromImage(img)).toBeNull();
  });
});

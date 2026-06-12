// tests/raw-encode-vectors.test.ts
//
// Canonical vectors for rawEncode (§6 item 2.3): noise-WAV (byte-exact) + snow-PNG
// (pixel-array exact; PNG container bytes are not portable, same rule as steg-image).
// Web = source of truth.
//
// CODEGEN_WRITE=1 npx vitest run tests/raw-encode-vectors.test.ts → writes shared/raw-encode-vectors.json
// npm test                                                        → round-trip + drift

import { describe, it, expect } from 'vitest';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { encryptedToWav, wavToEncrypted, encryptedToPngPixels, pngToEncrypted } from '../src/lib/rawEncode';

const WRITE = process.env.CODEGEN_WRITE === '1';
const VECTORS = resolve(process.cwd(), 'shared/raw-encode-vectors.json');
const ENVELOPE = 'CT4|T|mskJe/HGSXbFUNyrHzR3IQ==|lXSNK2I5GdUlMg2b|CbxndKWAuqMZkA7Ql99sndVlFAUn294TU7Fu';
const ODD = 'CT4|odd-length-envelope-xyz'; // odd byte count → exercises the pad-to-even path

const b64 = (u: Uint8Array): string => Buffer.from(u).toString('base64');
const toBuf = (b64s: string): Uint8Array => Uint8Array.from(Buffer.from(b64s, 'base64'));

async function wavB64(text: string): Promise<string> {
  return b64(new Uint8Array(await encryptedToWav(text).arrayBuffer()));
}
function snowCase(id: string, text: string) {
  const p = encryptedToPngPixels(text);
  return { id, text, width: p.width, height: p.height, pixelsB64: b64(Uint8Array.from(p.data)) };
}

const built = {
  spec: 'rawEncode: noise WAV byte-exact (8000Hz mono, [4B LE len][payload][pad-even]); snow PNG pixel-array ([4B BE len][payload] in RGB, alpha=255)',
  noise: [
    { id: 'env', text: ENVELOPE, wavB64: await wavB64(ENVELOPE) },
    { id: 'odd', text: ODD, wavB64: await wavB64(ODD) },
  ],
  snow: [snowCase('env', ENVELOPE)],
};

describe('rawEncode canonical vectors (shared/raw-encode-vectors.json)', () => {
  it('web round-trips noise + snow', () => {
    for (const c of built.noise) {
      expect(wavToEncrypted(toBuf(c.wavB64).buffer as ArrayBuffer), c.id).toBe(c.text);
    }
    for (const c of built.snow) {
      const data = new Uint8ClampedArray(toBuf(c.pixelsB64));
      const img = { data, width: c.width, height: c.height, colorSpace: 'srgb' } as ImageData;
      expect(pngToEncrypted(img), c.id).toBe(c.text);
    }
  });

  it('writes or drift-checks shared/raw-encode-vectors.json', () => {
    if (WRITE) {
      mkdirSync(dirname(VECTORS), { recursive: true });
      writeFileSync(VECTORS, JSON.stringify(built, null, 2) + '\n', 'utf8');
    }
    expect(existsSync(VECTORS)).toBe(true);
    expect(JSON.parse(readFileSync(VECTORS, 'utf8'))).toEqual(built);
  });
});

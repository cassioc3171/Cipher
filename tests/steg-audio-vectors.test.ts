// tests/steg-audio-vectors.test.ts
//
// Canonical int16-PCM vectors for steg-audio (§6 item 2.2). Web = source of truth.
// The portable contract is the stored 16-bit PCM (what a WAV holds): float carriers
// would risk libm last-ULP drift, so the carrier is a fixed int16 array (stored
// verbatim) and the embed is a pure integer LSB op. We also lock the byte-exact
// 44-byte mono WAV output.
//
// CODEGEN_WRITE=1 npx vitest run tests/steg-audio-vectors.test.ts → writes shared/steg-audio-vectors.json
// npm test                                                        → round-trip + drift

import { describe, it, expect } from 'vitest';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { audioCapacity, encodeIntoAudio, decodeFromAudio, pcmToWav } from '../src/lib/stegAudio';
import { crc32 } from '../src/lib/crc32';

const WRITE = process.env.CODEGEN_WRITE === '1';
const VECTORS = resolve(process.cwd(), 'shared/steg-audio-vectors.json');
const ENVELOPE = 'CT4|T|mskJe/HGSXbFUNyrHzR3IQ==|lXSNK2I5GdUlMg2b|CbxndKWAuqMZkA7Ql99sndVlFAUn294TU7Fu';
const N = 2048;
const RATE = 8000;

const b64 = (u: Uint8Array): string => Buffer.from(u).toString('base64');
function i16ToLeB64(s: Int16Array): string {
  const b = new Uint8Array(s.length * 2);
  const dv = new DataView(b.buffer);
  for (let i = 0; i < s.length; i++) dv.setInt16(i * 2, s[i], true);
  return b64(b);
}
function fromInt16ExactFloat(s: Int16Array): Float32Array {
  const f = new Float32Array(s.length);
  for (let i = 0; i < s.length; i++) f[i] = s[i] / 32768; // exact in float32 (≤16 sig bits)
  return f;
}
function int16(s: number): number {
  const v = Math.round(s * 32768);
  return v > 32767 ? 32767 : v < -32768 ? -32768 : v;
}

const payload = new TextEncoder().encode(ENVELOPE);
const carrier = new Int16Array(N);
for (let i = 0; i < N; i++) carrier[i] = ((i * 97 + 13) % 65536) - 32768; // deterministic; stored verbatim

const fc = fromInt16ExactFloat(carrier);
encodeIntoAudio(fc, payload); // mutates fc (LSB of ch0 samples)
const embedded = new Int16Array(N);
for (let i = 0; i < N; i++) embedded[i] = int16(fc[i]);
const wav = new Uint8Array(pcmToWav([fc], RATE));

const built = {
  spec: 'steg-audio int16-PCM LSB vectors; 1 LSB/sample ch0; [len32|crc32|payload] MSB-first; mono 44-byte LE WAV',
  id: 'env-2048-8000-mono',
  sampleRate: RATE,
  numChannels: 1,
  samples: N,
  payloadB64: b64(payload),
  length: payload.length,
  crc32: crc32(payload) >>> 0,
  carrierSamplesB64: i16ToLeB64(carrier),
  embeddedSamplesB64: i16ToLeB64(embedded),
  embeddedWavB64: b64(wav),
};

describe('steg-audio canonical vectors (shared/steg-audio-vectors.json)', () => {
  it('web decodes the embedded samples back to the payload', () => {
    const out = decodeFromAudio(fromInt16ExactFloat(embedded));
    expect(out).not.toBeNull();
    expect(b64(out!)).toBe(built.payloadB64);
  });

  it('the embedded samples are exactly the WAV data section', () => {
    expect(b64(wav.slice(44))).toBe(built.embeddedSamplesB64);
  });

  it('writes or drift-checks shared/steg-audio-vectors.json', () => {
    if (WRITE) {
      mkdirSync(dirname(VECTORS), { recursive: true });
      writeFileSync(VECTORS, JSON.stringify(built, null, 2) + '\n', 'utf8');
    }
    expect(existsSync(VECTORS)).toBe(true);
    expect(JSON.parse(readFileSync(VECTORS, 'utf8'))).toEqual(built);
  });

  it('capacity formula', () => {
    expect(audioCapacity(N)).toBe(Math.floor((N - 64) / 8));
  });
});

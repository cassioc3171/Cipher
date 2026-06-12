// Web side of the cross-platform interop lock. Reads the canonical vectors
// (shared/test-vectors.json, generated from the PWA) and asserts the web can
// decrypt + de-obfuscate every one. The Android :core InteropVectorsTest reads
// the SAME file and must agree. See shared/SPEC.md.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { decryptData } from '../src/lib/crypto';
import { decodeFromEmoji } from '../src/lib/emoji';
import { decodeFromPersian } from '../src/lib/persian';
import { decodeSteg } from '../src/lib/steg';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vectors: any[] = JSON.parse(readFileSync('shared/test-vectors.json', 'utf8')).vectors;

describe('interop vectors — web side', () => {
  it('has vectors', () => expect(vectors.length).toBeGreaterThan(0));

  for (const v of vectors) {
    it(`web decrypts: ${v.id}`, async () => {
      if (v.mode === 'password') {
        const { data } = await decryptData(v.envelope, v.password);
        expect(data).toBe(v.plaintext);
        return;
      }
      // obfuscation: de-obfuscate to the underlying envelope, then decrypt
      let env: string;
      if (v.obfuscation === 'emoji') env = decodeFromEmoji(v.obfuscated);
      else if (v.obfuscation === 'persian') env = decodeFromPersian(v.obfuscated);
      else env = decodeSteg(v.obfuscated);
      expect(env).toBe(v.underlying);
      const { data } = await decryptData(env, v.password);
      expect(data).toBe(v.plaintext);
    });
  }
});

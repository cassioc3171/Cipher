// tests/ecc-vectors.test.ts
//
// Canonical P-256 ECDH paired-mode vectors (§6 item 2.4). Web = source of truth.
// Locks the deterministic mnemonic→keypair derivation and the ECDH→HKDF session
// secret so the Kotlin :core port (Phase 2.4 cont.) can be proven byte-exact.
//
// Scheme (src/lib/ecc.ts):
//   mnemonic → SHA-256(phrase) → HKDF-SHA256(salt="Cipher-Mnemonic", info="ECDH-P256", 256b)
//            → scalar = (BE(bits) mod (n-1)) + 1 → d·G uncompressed (04||x||y) → base64 pubkey
//   shared  = HKDF-SHA256(ECDH_sharedX, salt=SHA-256(sort(pubA,pubB))[:16], info="Cipher-ECC-Session", 256b)
//
// CODEGEN_WRITE=1 npx vitest run tests/ecc-vectors.test.ts → writes shared/ecc-vectors.json
// npm test                                                 → symmetry + drift

import { describe, it, expect } from 'vitest';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { deriveKeyPairFromMnemonic, deriveSharedSessionSecret, fingerprintPublicKey } from '../src/lib/ecc';

const WRITE = process.env.CODEGEN_WRITE === '1';
const VECTORS = resolve(process.cwd(), 'shared/ecc-vectors.json');

// Two fixed 12-word mnemonics (words drawn from ecc.ts MNEMONIC_WORDS).
const A_WORDS = ['abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse', 'access', 'accident'];
const B_WORDS = ['zebra', 'zero', 'zone', 'zoo', 'youth', 'young', 'you', 'yellow', 'year', 'yard', 'wrong', 'write'];

const fromB64 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'base64'));

const a = await deriveKeyPairFromMnemonic(A_WORDS);
const b = await deriveKeyPairFromMnemonic(B_WORDS);
const sAB = await deriveSharedSessionSecret(a.keyPair.privateKey, b.publicKeyB64, a.publicKeyB64);
const sBA = await deriveSharedSessionSecret(b.keyPair.privateKey, a.publicKeyB64, b.publicKeyB64);

const built = {
  spec: 'P-256 ECDH paired-mode. mnemonic→SHA256→HKDF(salt=Cipher-Mnemonic,info=ECDH-P256)→scalar=(BE mod n-1)+1→d·G uncompressed→base64. shared=HKDF-SHA256(ECDH_X, salt=SHA256(sort(pubA,pubB))[:16], info=Cipher-ECC-Session).',
  parties: {
    A: { mnemonic: A_WORDS, publicKeyB64: a.publicKeyB64 },
    B: { mnemonic: B_WORDS, publicKeyB64: b.publicKeyB64 },
  },
  shared: { secret: sAB.secret, saltB64: sAB.saltB64 },
};

describe('ecc P-256 paired vectors (shared/ecc-vectors.json)', () => {
  it('ECDH shared secret is symmetric (A×B == B×A)', () => {
    expect(sBA.secret).toBe(sAB.secret);
    expect(sBA.saltB64).toBe(sAB.saltB64);
  });

  it('mnemonic→pubkey is a 65-byte uncompressed point (0x04 prefix)', () => {
    const pk = fromB64(a.publicKeyB64);
    expect(pk.length).toBe(65);
    expect(pk[0]).toBe(0x04);
    expect(a.publicKeyB64).not.toBe(b.publicKeyB64);
  });

  it('fingerprint = first10…last10 of the base64', () => {
    expect(fingerprintPublicKey(a.publicKeyB64)).toBe(`${a.publicKeyB64.slice(0, 10)}...${a.publicKeyB64.slice(-10)}`);
  });

  it('writes or drift-checks shared/ecc-vectors.json', () => {
    if (WRITE) {
      mkdirSync(dirname(VECTORS), { recursive: true });
      writeFileSync(VECTORS, JSON.stringify(built, null, 2) + '\n', 'utf8');
    }
    expect(existsSync(VECTORS)).toBe(true);
    expect(JSON.parse(readFileSync(VECTORS, 'utf8'))).toEqual(built);
  });
});

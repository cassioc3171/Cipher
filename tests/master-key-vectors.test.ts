// tests/master-key-vectors.test.ts
//
// Master-vault vectors (§6 item 2.5, INT-mk). Web = source of truth.
// Locks the web masterKey.ts scheme so the Kotlin :core MasterVault can be proven
// byte-exact: KEK = PBKDF2-SHA256 600k over a 32-byte salt → AES-256-GCM; wrap =
// "mk1:<ivB64>:<cipherB64>"; verify hash = PBKDF2-SHA256 100k (separate salt) → b64.
//
// The wrap blob has a random IV, so it is GENERATED ONCE (write mode) and kept
// stable thereafter (read from the committed file) — only the deterministic verify
// hash + the round-trip of the committed blob are drift-checked.
//
// CODEGEN_WRITE=1 npx vitest run tests/master-key-vectors.test.ts → writes shared/master-key-vectors.json
// npm test                                                        → round-trip + drift

import { describe, it, expect } from 'vitest';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import {
  deriveKEK,
  wrapSecret,
  unwrapSecret,
  hashMasterPassword,
  isWrappedSecret,
} from '../src/lib/masterKey';

const WRITE = process.env.CODEGEN_WRITE === '1';
const VECTORS = resolve(process.cwd(), 'shared/master-key-vectors.json');
const PASSWORD = 'master-vault-pw-2026';
const PLAINTEXT = 'chat-secret::سلام::ABCDEF0123456789';

const b64 = (u: Uint8Array): string => Buffer.from(u).toString('base64');
const fromB64 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'base64'));

// Fixed 32-byte salts so the verify hash + KEK are reproducible.
const SALT = new Uint8Array(32).map((_, i) => (i * 7 + 1) & 0xff);
const VERIFY_SALT = new Uint8Array(32).map((_, i) => (i * 13 + 5) & 0xff);

const committed: { kek?: { wrappedMk1?: string } } | null = existsSync(VECTORS)
  ? JSON.parse(readFileSync(VECTORS, 'utf8'))
  : null;

const kek = await deriveKEK(PASSWORD, SALT);
const hashB64 = await hashMasterPassword(PASSWORD, VERIFY_SALT);
// Keep the random-IV wrap blob stable across runs: only (re)generate when writing or absent.
const wrappedMk1 = WRITE || !committed?.kek?.wrappedMk1 ? await wrapSecret(kek, PLAINTEXT) : committed.kek.wrappedMk1;

const built = {
  spec: 'master-vault (web masterKey.ts): KEK=PBKDF2-SHA256 600k / 32B salt -> AES-256-GCM; wrap "mk1:<ivB64>:<cipherB64>"; verify=PBKDF2-SHA256 100k.',
  kek: { password: PASSWORD, saltB64: b64(SALT), plaintext: PLAINTEXT, wrappedMk1 },
  verify: { password: PASSWORD, verifySaltB64: b64(VERIFY_SALT), hashB64 },
};

describe('master-vault vectors (shared/master-key-vectors.json)', () => {
  it('web unwraps the committed wrap blob (KEK 600k/32B-salt round-trip)', async () => {
    const k = await deriveKEK(built.kek.password, fromB64(built.kek.saltB64));
    expect(await unwrapSecret(k, built.kek.wrappedMk1)).toBe(built.kek.plaintext);
    expect(isWrappedSecret(built.kek.wrappedMk1)).toBe(true);
  });

  it('verify hash is deterministic (PBKDF2 100k)', async () => {
    expect(await hashMasterPassword(built.verify.password, fromB64(built.verify.verifySaltB64))).toBe(built.verify.hashB64);
  });

  it('writes or drift-checks the deterministic fields', () => {
    if (WRITE) {
      mkdirSync(dirname(VECTORS), { recursive: true });
      writeFileSync(VECTORS, JSON.stringify(built, null, 2) + '\n', 'utf8');
    }
    expect(existsSync(VECTORS)).toBe(true);
    expect(JSON.parse(readFileSync(VECTORS, 'utf8'))).toEqual(built);
  });
});

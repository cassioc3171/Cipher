// tests/file-envelope-vectors.test.ts
//
// File-envelope vectors (§6 item 2.6, INT-file). Web = source of truth.
// The PWA encodes a file as a normal CTn envelope with type 'F' whose plaintext is
// "<fileName>::<dataURL>" (the dataURL carries mime + bytes); the ".ctx" download is
// just that envelope text. Files are NOT gzipped (web encryptData only compresses
// type 'T'), so a file envelope is always CT3|F|... . This replaces the Android
// bespoke "CT4F|" format (FileEnvelope.kt is kept only for decoding old local msgs).
//
// Random salt/iv → the envelope is generated once (write mode) and kept stable.
// CODEGEN_WRITE=1 npx vitest run tests/file-envelope-vectors.test.ts → writes shared/file-envelope-vectors.json
// npm test → round-trip + drift

import { describe, it, expect } from 'vitest';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { encryptData, decryptData } from '../src/lib/crypto';

const WRITE = process.env.CODEGEN_WRITE === '1';
const VECTORS = resolve(process.cwd(), 'shared/file-envelope-vectors.json');
const PASSWORD = 'file-envelope-pw-2026';

const INPUTS = [
  { id: 'png', payload: 'photo.png::data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC' },
  { id: 'bin', payload: 'note.bin::data:application/octet-stream;base64,SGVsbG8gd29ybGQh' },
];

const committed: { cases?: Array<{ id: string; envelope: string }> } | null = existsSync(VECTORS)
  ? JSON.parse(readFileSync(VECTORS, 'utf8'))
  : null;

const cases = [];
for (const c of INPUTS) {
  const prev = committed?.cases?.find((x) => x.id === c.id);
  const envelope = WRITE || !prev ? await encryptData(c.payload, PASSWORD, 'F') : prev.envelope;
  cases.push({ id: c.id, password: PASSWORD, payload: c.payload, envelope });
}
const built = {
  spec: "file envelope = CTn|F|... (type 'F'); plaintext '<name>::<dataURL>'; files are NOT gzipped (CT3) — web encryptData compresses only type 'T'. Replaces Android bespoke CT4F.",
  cases,
};

describe('file-envelope vectors (shared/file-envelope-vectors.json)', () => {
  it('web decrypts each committed F-envelope to its payload (type F, CT3)', async () => {
    for (const c of built.cases) {
      const r = await decryptData(c.envelope, c.password);
      expect(r.type, c.id).toBe('F');
      expect(r.data, c.id).toBe(c.payload);
      expect(c.envelope.startsWith('CT3|F|'), c.id).toBe(true);
    }
  });

  it('writes or drift-checks shared/file-envelope-vectors.json', () => {
    if (WRITE) {
      mkdirSync(dirname(VECTORS), { recursive: true });
      writeFileSync(VECTORS, JSON.stringify(built, null, 2) + '\n', 'utf8');
    }
    expect(existsSync(VECTORS)).toBe(true);
    expect(JSON.parse(readFileSync(VECTORS, 'utf8'))).toEqual(built);
  });
});

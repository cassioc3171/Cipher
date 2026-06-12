import { describe, it, expect } from 'vitest';
import { encryptData, decryptData, isCipherEnvelope, type DataType } from '../src/lib/crypto';

const PW = 'CorrectHorseBatteryStaple-۱۲۳!';

describe('crypto round-trip (PWA envelope)', () => {
  it('text round-trips with unicode (emoji + Persian + whitespace)', async () => {
    const msg = 'Hello Cipher ✅ سلام دنیا 123\n\ttrailing';
    const env = await encryptData(msg, PW, 'T');
    expect(env.split('|').length).toBe(5);
    expect(env.startsWith('CT4|') || env.startsWith('CT3|')).toBe(true);
    const { data, type } = await decryptData(env, PW);
    expect(data).toBe(msg);
    expect(type).toBe('T');
  });

  it('text with compression disabled emits CT3 (uncompressed)', async () => {
    const env = await encryptData('plaintext here', PW, 'T', { compressionEnabled: false });
    expect(env.startsWith('CT3|')).toBe(true);
    expect((await decryptData(env, PW)).data).toBe('plaintext here');
  });

  it('text with compression enabled emits CT4 (compressed)', async () => {
    const env = await encryptData('compress me '.repeat(20), PW, 'T', { compressionEnabled: true });
    expect(env.startsWith('CT4|')).toBe(true);
    expect((await decryptData(env, PW)).data).toBe('compress me '.repeat(20));
  });

  it('non-text data types are never compressed (CT3) and round-trip with their type tag', async () => {
    for (const t of ['A', 'F', 'I', 'M'] as DataType[]) {
      const env = await encryptData('payload-' + t, PW, t);
      expect(env.startsWith('CT3|')).toBe(true);
      const r = await decryptData(env, PW);
      expect(r.data).toBe('payload-' + t);
      expect(r.type).toBe(t);
    }
  });

  it('empty string round-trips', async () => {
    const env = await encryptData('', PW, 'T');
    expect((await decryptData(env, PW)).data).toBe('');
  });

  it('large payload (100k chars) round-trips', async () => {
    const big = 'x'.repeat(100_000);
    expect((await decryptData(await encryptData(big, PW, 'T'), PW)).data).toBe(big);
  });

  it('every encryption uses a fresh salt + iv', async () => {
    const a = await encryptData('same', PW, 'T');
    const b = await encryptData('same', PW, 'T');
    const [, , saltA, ivA] = a.split('|');
    const [, , saltB, ivB] = b.split('|');
    expect(saltA).not.toBe(saltB);
    expect(ivA).not.toBe(ivB);
  });

  it('wrong password is rejected (GCM tag)', async () => {
    const env = await encryptData('secret', PW, 'T');
    await expect(decryptData(env, 'wrong-password')).rejects.toBeTruthy();
  });

  it('tampered ciphertext is rejected (GCM tag)', async () => {
    const env = await encryptData('secret', PW, 'T');
    const parts = env.split('|');
    parts[4] = (parts[4][0] === 'A' ? 'B' : 'A') + parts[4].slice(1);
    await expect(decryptData(parts.join('|'), PW)).rejects.toBeTruthy();
  });

  it('malformed envelopes throw "Invalid format"', async () => {
    await expect(decryptData('CT4|T|onlythreefields', PW)).rejects.toThrow(/Invalid format/);
    await expect(decryptData('NOTCT|T|a|b|c', PW)).rejects.toThrow(/Invalid format/);
  });

  it('malformed base64 in a field throws a clean error, not a raw atob DOMException', async () => {
    // '@@@@' is not valid base64 -> atob throws InvalidCharacterError. The user
    // should see the controlled "Invalid format", not "Failed to execute 'atob'…".
    const err = await decryptData('CT3|T|@@@@|YWJj|YWJj', PW).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/Invalid format/);
    expect((err as Error).message).not.toMatch(/atob/i);
  });

  it('legacy CT1 (PBKDF2 100k, uncompressed) still decrypts', async () => {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const km = await crypto.subtle.importKey('raw', enc.encode(PW), { name: 'PBKDF2' }, false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      km, { name: 'AES-GCM', length: 256 }, false, ['encrypt'],
    );
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode('legacy-msg'));
    const b64 = (u: Uint8Array | ArrayBuffer) =>
      Buffer.from(u instanceof Uint8Array ? u : new Uint8Array(u)).toString('base64');
    const env = `CT1|T|${b64(salt)}|${b64(iv)}|${b64(ct)}`;
    expect((await decryptData(env, PW)).data).toBe('legacy-msg');
  });

  it('isCipherEnvelope recognizes CT1..CT4 and rejects plain text', () => {
    expect(isCipherEnvelope('CT4|T|a|b|c')).toBe(true);
    expect(isCipherEnvelope('CT1|T|a|b|c')).toBe(true);
    expect(isCipherEnvelope('just a message')).toBe(false);
  });
});

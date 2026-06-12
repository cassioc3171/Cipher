/**
 * Master Password → KEK (Key-Encryption Key) utilities.
 *
 * KEK is derived via PBKDF2-SHA256 and used to wrap/unwrap secrets with AES-256-GCM.
 * A separate hash (double-PBKDF2 with a different salt) is stored for password
 * verification so we never need to decrypt anything just to check the password.
 */

const KEK_ITERATIONS = 600_000;
const VERIFY_ITERATIONS = 100_000;
const SALT_BYTES = 32;
const IV_BYTES = 12;
const WRAPPED_SECRET_PREFIX = 'mk1:';
const BYTE_CHUNK_SIZE = 0x8000;

const enc = new TextEncoder();
const dec = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += BYTE_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(index, index + BYTE_CHUNK_SIZE));
  }
  return btoa(binary);
}

function tryBase64ToBytes(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

function parseWrappedSecret(wrapped: string): { iv: Uint8Array; cipher: Uint8Array } | null {
  if (wrapped.startsWith(WRAPPED_SECRET_PREFIX)) {
    const body = wrapped.slice(WRAPPED_SECRET_PREFIX.length);
    const separatorIndex = body.indexOf(':');
    if (separatorIndex <= 0) return null;
    const iv = tryBase64ToBytes(body.slice(0, separatorIndex));
    const cipher = tryBase64ToBytes(body.slice(separatorIndex + 1));
    if (!iv || !cipher || iv.length !== IV_BYTES || cipher.length === 0) return null;
    return { iv, cipher };
  }

  const parts = wrapped.split('|');
  if (parts.length !== 2) return null;
  const iv = tryBase64ToBytes(parts[0]);
  const cipher = tryBase64ToBytes(parts[1]);
  if (!iv || !cipher || iv.length !== IV_BYTES || cipher.length === 0) return null;
  return { iv, cipher };
}

export function isWrappedSecret(value: string): boolean {
  return parseWrappedSecret(value) !== null;
}

/* ===== Salt ===== */

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/* ===== KEK derivation ===== */

export async function deriveKEK(
  masterPassword: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KEK_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/* ===== Wrap / Unwrap ===== */

/** Encrypt a plaintext string with KEK. Returns a versioned wrapped payload. */
export async function wrapSecret(
  kek: CryptoKey,
  plaintext: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    kek,
    enc.encode(plaintext),
  );
  return `${WRAPPED_SECRET_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipher))}`;
}

/** Decrypt a wrapped string with KEK. Supports both current and legacy payloads. */
export async function unwrapSecret(
  kek: CryptoKey,
  wrapped: string,
): Promise<string> {
  const parsed = parseWrappedSecret(wrapped);
  if (!parsed) throw new Error('Invalid wrapped secret.');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: parsed.iv },
    kek,
    parsed.cipher,
  );
  return dec.decode(plain);
}

/* ===== Password Verification Hash ===== */

/**
 * Produce a verification hash from the master password.
 * Uses a DIFFERENT salt + fewer iterations than KEK derivation so no
 * mathematical relationship between the hash and KEK can be exploited.
 */
export async function hashMasterPassword(
  masterPassword: string,
  verifySalt: Uint8Array,
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: verifySalt, iterations: VERIFY_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

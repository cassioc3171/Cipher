import { compressSync, decompressSync, strToU8, strFromU8 } from 'fflate';

/**
 * Envelope format:
 *   CT1|<type>|<saltB64>|<ivB64>|<cipherB64>   PBKDF2 100k, uncompressed (legacy)
 *   CT2|<type>|<saltB64>|<ivB64>|<cipherB64>   PBKDF2 100k, compressed   (legacy)
 *   CT3|<type>|<saltB64>|<ivB64>|<cipherB64>   PBKDF2 600k, uncompressed (current)
 *   CT4|<type>|<saltB64>|<ivB64>|<cipherB64>   PBKDF2 600k, compressed   (current)
 *
 * New encryptions always use CT3/CT4 (current OWASP minimum for PBKDF2-SHA256).
 * Old CT1/CT2 envelopes still decrypt for backward compatibility.
 */
const ITERATIONS_LEGACY = 100_000; // CT1, CT2 — kept ONLY for decrypting old messages
const ITERATIONS = 600_000;        // CT3, CT4 — current OWASP minimum

const SALT_LEN = 16;
const IV_LEN = 12;

export type DataType = 'T' | 'A' | 'F' | 'I' | 'M';
export type CompressionLevel = 'low' | 'balanced' | 'high';

interface EncryptOptions {
  compressionEnabled?: boolean;
  compressionLevel?: CompressionLevel;
}

const LEVEL_MAP = {
  low: 2,
  balanced: 6,
  high: 9,
} as const;

const CIPHER_PREFIXES = ['CT1|', 'CT2|', 'CT3|', 'CT4|'] as const;

/** True if `text` starts with any supported ciphertext envelope prefix. */
export function isCipherEnvelope(text: string): boolean {
  for (let i = 0; i < CIPHER_PREFIXES.length; i++) {
    if (text.startsWith(CIPHER_PREFIXES[i])) return true;
  }
  return false;
}

function iterationsForPrefix(prefix: string): number {
  return prefix === 'CT3' || prefix === 'CT4' ? ITERATIONS : ITERATIONS_LEGACY;
}

function isCompressedPrefix(prefix: string): boolean {
  return prefix === 'CT2' || prefix === 'CT4';
}

function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferView): string {
  let binary = '';
  const bytes = buffer instanceof ArrayBuffer
    ? new Uint8Array(buffer)
    : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function estimateEnvelopeSize(
  inputSizeBytes: number,
  type: DataType,
  compressionEnabled: boolean,
  compressionLevel: CompressionLevel
): number {
  const textLike = type === 'T';
  const useCompress = compressionEnabled && textLike;
  const compressRatio = useCompress
    ? (compressionLevel === 'low' ? 0.72 : compressionLevel === 'balanced' ? 0.58 : 0.5)
    : 1;

  const compressedEstimate = Math.max(16, Math.floor(inputSizeBytes * compressRatio));
  const cipherBytesEstimate = compressedEstimate + 16;
  const b64CipherEstimate = Math.ceil(cipherBytesEstimate / 3) * 4;
  const b64SaltLen = 24;
  const b64IvLen = 16;
  // CT3 (uncompressed) and CT4 (compressed) — same width as CT1/CT2.
  const header = useCompress ? 'CT4' : 'CT3';

  // Format: CT4|T|<salt>|<iv>|<cipher> — header includes 2 pipes already,
  // the 2 remaining pipes (salt→iv, iv→cipher) add +2.
  return `${header}|${type}|`.length + b64SaltLen + b64IvLen + b64CipherEstimate + 2;
}

export async function encryptData(
  data: string,
  password: string,
  type: DataType,
  options: EncryptOptions = {}
): Promise<string> {
  const compressionEnabled = options.compressionEnabled ?? true;
  const compressionLevel = options.compressionLevel ?? 'balanced';
  const useCompress = compressionEnabled && type === 'T';
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt, ITERATIONS);
  const payload = useCompress
    ? compressSync(strToU8(data), { level: LEVEL_MAP[compressionLevel] })
    : strToU8(data);

  try {
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      payload
    );

    const saltB64 = arrayBufferToBase64(salt);
    const ivB64 = arrayBufferToBase64(iv);
    const cipherB64 = arrayBufferToBase64(ciphertext);

    // CT3 = uncompressed, 600k iterations; CT4 = compressed, 600k iterations.
    const header = useCompress ? 'CT4' : 'CT3';
    return `${header}|${type}|${saltB64}|${ivB64}|${cipherB64}`;
  } finally {
    payload.fill(0);
  }
}

export async function decryptData(encryptedStr: string, password: string): Promise<{data: string, type: DataType}> {
  const parts = encryptedStr.split('|');
  const prefix = parts[0];
  const knownPrefix = prefix === 'CT1' || prefix === 'CT2' || prefix === 'CT3' || prefix === 'CT4';
  if (parts.length !== 5 || !knownPrefix) {
    throw new Error("Invalid format");
  }

  const isCompressed = isCompressedPrefix(prefix);
  const iterations = iterationsForPrefix(prefix);
  const VALID_TYPES: readonly string[] = ['T', 'A', 'F', 'I', 'M'];
  if (!VALID_TYPES.includes(parts[1])) throw new Error('Invalid data type');
  const type = parts[1] as DataType;
  let salt: Uint8Array;
  let iv: Uint8Array;
  let ciphertext: ArrayBuffer;
  try {
    salt = new Uint8Array(base64ToArrayBuffer(parts[2]));
    iv = new Uint8Array(base64ToArrayBuffer(parts[3]));
    ciphertext = base64ToArrayBuffer(parts[4]);
  } catch {
    // Malformed base64 (atob throws InvalidCharacterError) — surface the same
    // clean error as a structurally-invalid envelope instead of a raw DOMException.
    throw new Error('Invalid format');
  }

  const key = await deriveKey(password, salt, iterations);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertext
  );

  const decryptedBytes = new Uint8Array(decryptedBuffer);
  let data: string;
  try {
    if (isCompressed) {
      const decompressed = decompressSync(decryptedBytes);
      try {
        data = strFromU8(decompressed);
      } finally {
        decompressed.fill(0);
      }
    } else {
      const dec = new TextDecoder();
      data = dec.decode(decryptedBuffer);
    }
  } finally {
    decryptedBytes.fill(0);
  }

  return { data, type };
}

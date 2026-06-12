/**
 * IndexedDB key-value store for Cipher.
 *
 * Stores:
 *   eccSecrets   — chatId → wrapped/plain sharedSecret (ECC paired chats)
 *   chatSecrets  — chatId → wrapped/plain password (personal chats)
 *   largeData    — id → string (large message payloads — legacy, phasing out)
 *   messages     — auto-increment → { chatId, msgId, payload, inputPreview, outputPreview, type, dataType, fileName, timestamp }
 */

import { isWrappedSecret, wrapSecret, unwrapSecret } from './masterKey';

const DB_NAME = 'CipherDB';
const DB_VERSION = 6;
const STORE_ECC = 'eccSecrets';
const STORE_CHAT_SECRETS = 'chatSecrets';
const STORE_LARGE = 'largeData';
const STORE_MESSAGES = 'messages';
const STORE_APP_RUNTIME = 'appRuntime';
const APP_UNLOCK_SESSION_KEY = 'appUnlockSession';

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // v1 had "history" store — remove it
      if (db.objectStoreNames.contains('history')) db.deleteObjectStore('history');
      if (!db.objectStoreNames.contains(STORE_ECC)) db.createObjectStore(STORE_ECC);
      if (!db.objectStoreNames.contains(STORE_LARGE)) db.createObjectStore(STORE_LARGE);
      // v3+: messages store (chatId-indexed)
      let ms: IDBObjectStore;
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        ms = db.createObjectStore(STORE_MESSAGES, { autoIncrement: true });
      } else {
        ms = req.transaction!.objectStore(STORE_MESSAGES);
      }
      if (!ms.indexNames.contains('chatId')) {
        ms.createIndex('chatId', 'chatId', { unique: false });
      }
      if (!ms.indexNames.contains('chatId_ts')) {
        ms.createIndex('chatId_ts', ['chatId', 'timestamp'], { unique: false });
      }
      if (!ms.indexNames.contains('chatId_ts_msgId')) {
        ms.createIndex('chatId_ts_msgId', ['chatId', 'timestamp', 'msgId'], { unique: false });
      }
      // v4: chatSecrets store (password-mode chat passwords)
      if (!db.objectStoreNames.contains(STORE_CHAT_SECRETS)) {
        db.createObjectStore(STORE_CHAT_SECRETS);
      }
      // v5: short-lived runtime session data
      if (!db.objectStoreNames.contains(STORE_APP_RUNTIME)) {
        db.createObjectStore(STORE_APP_RUNTIME);
      }
    };
    req.onsuccess = () => { dbInstance = req.result; resolve(dbInstance); };
    req.onerror = () => reject(req.error);
  });
}

/* ===== ECC Secrets (KEK-aware) ===== */

export async function saveEccSecret(chatId: string, secret: string, kek?: CryptoKey | null): Promise<void> {
  const db = await openDB();
  const value = kek ? await wrapSecret(kek, secret) : secret;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ECC, 'readwrite');
    tx.objectStore(STORE_ECC).put(value, chatId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getEccSecret(chatId: string, kek?: CryptoKey | null): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ECC, 'readonly');
    const req = tx.objectStore(STORE_ECC).get(chatId);
    req.onsuccess = async () => {
      const raw = req.result as string | undefined;
      if (!raw) { resolve(null); return; }
      if (kek && isWrappedSecret(raw)) {
        try { resolve(await unwrapSecret(kek, raw)); } catch { resolve(null); }
      } else {
        resolve(raw);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteEccSecret(chatId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ECC, 'readwrite');
    tx.objectStore(STORE_ECC).delete(chatId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ===== Chat Secrets — password-mode chat passwords (KEK-aware) ===== */

export async function saveChatSecret(chatId: string, secret: string, kek?: CryptoKey | null): Promise<void> {
  const db = await openDB();
  const value = kek ? await wrapSecret(kek, secret) : secret;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CHAT_SECRETS, 'readwrite');
    tx.objectStore(STORE_CHAT_SECRETS).put(value, chatId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getChatSecret(chatId: string, kek?: CryptoKey | null): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CHAT_SECRETS, 'readonly');
    const req = tx.objectStore(STORE_CHAT_SECRETS).get(chatId);
    req.onsuccess = async () => {
      const raw = req.result as string | undefined;
      if (!raw) { resolve(null); return; }
      if (kek && isWrappedSecret(raw)) {
        try { resolve(await unwrapSecret(kek, raw)); } catch { resolve(null); }
      } else {
        resolve(raw);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteChatSecret(chatId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CHAT_SECRETS, 'readwrite');
    tx.objectStore(STORE_CHAT_SECRETS).delete(chatId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export type AppUnlockSession = {
  kek: CryptoKey;
  expiresAt: number;
  lastActivityAt: number;
};

export async function saveAppUnlockSession(session: AppUnlockSession): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_APP_RUNTIME, 'readwrite');
    tx.objectStore(STORE_APP_RUNTIME).put(session, APP_UNLOCK_SESSION_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAppUnlockSession(): Promise<AppUnlockSession | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_APP_RUNTIME, 'readonly');
    const req = tx.objectStore(STORE_APP_RUNTIME).get(APP_UNLOCK_SESSION_KEY);
    req.onsuccess = () => resolve((req.result as AppUnlockSession | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function clearAppUnlockSession(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_APP_RUNTIME, 'readwrite');
    tx.objectStore(STORE_APP_RUNTIME).delete(APP_UNLOCK_SESSION_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Re-wrap ALL secrets (eccSecrets + chatSecrets + message payloads) from oldKek to newKek.
 * If oldKek is null, values are assumed plaintext → wrap with newKek.
 * If newKek is null, values are unwrapped → saved as plaintext.
 */
export async function rewrapAllSecrets(
  oldKek: CryptoKey | null,
  newKek: CryptoKey | null,
): Promise<void> {
  const db = await openDB();

  // Helper: re-wrap a single value
  async function rewrap(val: string): Promise<string> {
    let plain = val;
    if (oldKek && isWrappedSecret(val)) {
      plain = await unwrapSecret(oldKek, val);
    }
    if (newKek) {
      return wrapSecret(newKek, plain);
    }
    return plain;
  }

  // Helper: read all entries from a key-value store
  function readAllKV(storeName: string): Promise<Array<{ key: IDBValidKey; value: string }>> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const entries: Array<{ key: IDBValidKey; value: string }> = [];
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) { resolve(entries); return; }
        entries.push({ key: cursor.key, value: cursor.value as string });
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  }

  // Helper: write all entries back to a key-value store
  function writeAllKV(storeName: string, entries: Array<{ key: IDBValidKey; value: string }>): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const e of entries) store.put(e.value, e.key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  const readAllMessages = (): Promise<Array<{ key: IDBValidKey; value: IDBMessage }>> => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, 'readonly');
    const store = tx.objectStore(STORE_MESSAGES);
    const entries: Array<{ key: IDBValidKey; value: IDBMessage }> = [];
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) { resolve(entries); return; }
      entries.push({ key: cursor.key, value: cursor.value as IDBMessage });
      cursor.continue();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });

  const [eccEntries, chatEntries, allMsgs] = await Promise.all([
    readAllKV(STORE_ECC),
    readAllKV(STORE_CHAT_SECRETS),
    readAllMessages(),
  ]);

  const [rewrappedEcc, rewrappedChat, rewrappedMsgs] = await Promise.all([
    Promise.all(eccEntries.map(async (entry) => ({
      key: entry.key,
      value: await rewrap(entry.value),
    }))),
    Promise.all(chatEntries.map(async (entry) => ({
      key: entry.key,
      value: await rewrap(entry.value),
    }))),
    Promise.all(allMsgs.map(async (entry) => ({
      key: entry.key,
      value: { ...entry.value, payload: await rewrap(entry.value.payload) },
    }))),
  ]);

  await writeAllKV(STORE_ECC, rewrappedEcc);
  await writeAllKV(STORE_CHAT_SECRETS, rewrappedChat);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    const store = tx.objectStore(STORE_MESSAGES);
    for (const e of rewrappedMsgs) store.put(e.value, e.key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ===== Large Data ===== */

export async function saveLargeData(id: string, data: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LARGE, 'readwrite');
    tx.objectStore(STORE_LARGE).put(data, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLargeData(id: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LARGE, 'readonly');
    const req = tx.objectStore(STORE_LARGE).get(id);
    req.onsuccess = () => resolve((req.result as string) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLargeDataBatch(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_LARGE, 'readwrite');
    const store = tx.objectStore(STORE_LARGE);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ===== Messages Store (KEK-aware) ===== */

export type IDBMessage = {
  chatId: string;
  msgId: string;
  /** AES-GCM wrapped outputFull (or plaintext if no KEK) */
  payload: string;
  inputPreview: string;
  outputPreview: string;
  type: 'encrypt' | 'decrypt';
  dataType: string;
  fileName?: string;
  thumbUrl?: string;
  timestamp: number;
};

/** Save a message. `outputFull` is wrapped with KEK if provided. */
export async function saveMessage(msg: IDBMessage, kek?: CryptoKey | null): Promise<void> {
  const db = await openDB();
  // Wrap the payload AND the plaintext previews with the KEK — previews are
  // the first 120 chars of the real message, so storing them in clear partially
  // defeated the at-rest protection.
  const stored = kek
    ? {
        ...msg,
        payload: await wrapSecret(kek, msg.payload),
        inputPreview: msg.inputPreview ? await wrapSecret(kek, msg.inputPreview) : msg.inputPreview,
        outputPreview: msg.outputPreview ? await wrapSecret(kek, msg.outputPreview) : msg.outputPreview,
      }
    : msg;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    tx.objectStore(STORE_MESSAGES).add(stored);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Load messages for a chat (newest first by default).
 * Pass `limit` for pagination and `before` for cursor-based paging.
 */
export async function getMessages(
  chatId: string,
  kek?: CryptoKey | null,
  limit = 20,
  before?: { timestamp: number; msgId: string },
): Promise<IDBMessage[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, 'readonly');
    const index = tx.objectStore(STORE_MESSAGES).index('chatId_ts_msgId');

    const upperKey = before
      ? [chatId, before.timestamp, before.msgId]
      : [chatId, Number.MAX_SAFE_INTEGER, '\uffff'];
    const range = IDBKeyRange.bound([chatId, 0, ''], upperKey, false, !!before);
    const results: IDBMessage[] = [];

    // Walk backwards (newest first)
    const cursorReq = index.openCursor(range, 'prev');
    cursorReq.onsuccess = async () => {
      const cursor = cursorReq.result;
      if (!cursor || results.length >= limit) {
        // Unwrap all at once
        if (kek) {
          const unwrapped = await Promise.all(
            results.map(async (m) => {
              if (!isWrappedSecret(m.payload)) return m;
              try {
                return {
                  ...m,
                  payload: await unwrapSecret(kek, m.payload),
                  inputPreview: isWrappedSecret(m.inputPreview) ? await unwrapSecret(kek, m.inputPreview) : m.inputPreview,
                  outputPreview: isWrappedSecret(m.outputPreview) ? await unwrapSecret(kek, m.outputPreview) : m.outputPreview,
                };
              } catch { return { ...m, payload: '⚠ Could not decrypt this message (wrong key or corrupted).' }; }
            }),
          );
          resolve(unwrapped);
        } else {
          resolve(results);
        }
        return;
      }
      results.push(cursor.value as IDBMessage);
      cursor.continue();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

/** Count total messages for a chat. */
export async function countMessages(chatId: string): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, 'readonly');
    const index = tx.objectStore(STORE_MESSAGES).index('chatId');
    const req = index.count(IDBKeyRange.only(chatId));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Delete all messages for a chat. */
export async function deleteMessagesForChat(chatId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, 'readwrite');
    const index = tx.objectStore(STORE_MESSAGES).index('chatId');
    const cursorReq = index.openCursor(IDBKeyRange.only(chatId));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Re-wrap all ECC secrets from plaintext to KEK-wrapped (migration). */
export async function migrateEccSecretsToKEK(kek: CryptoKey): Promise<void> {
  const db = await openDB();
  // Two-pass: read all → wrap in memory → write back
  const entries = await new Promise<Array<{ key: IDBValidKey; value: string }>>((resolve, reject) => {
    const tx = db.transaction(STORE_ECC, 'readonly');
    const store = tx.objectStore(STORE_ECC);
    const items: Array<{ key: IDBValidKey; value: string }> = [];
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) { resolve(items); return; }
      items.push({ key: cursor.key, value: cursor.value as string });
      cursor.continue();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
  const wrapped = await Promise.all(entries.map(async (e) => {
    if (!isWrappedSecret(e.value)) {
      return { key: e.key, value: await wrapSecret(kek, e.value) };
    }
    return e;
  }));
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ECC, 'readwrite');
    const store = tx.objectStore(STORE_ECC);
    for (const e of wrapped) store.put(e.value, e.key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ===== Nuclear Option ===== */

/** Destroy EVERYTHING — IndexedDB + localStorage. No recovery. */
export function nukeEverything(): Promise<void> {
  if (dbInstance) { dbInstance.close(); dbInstance = null; }
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => { localStorage.clear(); resolve(); };
    req.onerror = () => { localStorage.clear(); resolve(); };
    req.onblocked = () => { localStorage.clear(); resolve(); };
  });
}

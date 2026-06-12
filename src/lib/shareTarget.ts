export type PendingShareTargetFile = {
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
};

export type PendingShareTargetPayload = {
  title: string;
  text: string;
  url: string;
  files: PendingShareTargetFile[];
  receivedAt: number;
};

const DB_NAME = 'CipherShareTargetDB';
const DB_VERSION = 1;
const STORE_PENDING = 'pendingShare';
const LATEST_SHARE_KEY = 'latest';

let dbInstance: IDBDatabase | null = null;

function openShareTargetDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING);
      }
    };
    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(dbInstance);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function savePendingShare(payload: PendingShareTargetPayload): Promise<void> {
  const db = await openShareTargetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite');
    tx.objectStore(STORE_PENDING).put(payload, LATEST_SHARE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function consumePendingShare(): Promise<PendingShareTargetPayload | null> {
  const db = await openShareTargetDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite');
    const store = tx.objectStore(STORE_PENDING);
    const req = store.get(LATEST_SHARE_KEY);

    req.onsuccess = () => {
      const payload = (req.result as PendingShareTargetPayload | undefined) ?? null;
      store.delete(LATEST_SHARE_KEY);
      tx.oncomplete = () => resolve(payload);
    };
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error);
  });
}
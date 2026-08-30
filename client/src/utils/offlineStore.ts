export interface OfflineInstallation {
  code: string;
  crew_id: number;
  lat: number;
  lng: number;
  status: 'Nueva' | 'Reparada' | 'Rehabilitada' | 'Robo';
  notes: string;
  installed_at: string; // ISO String
}

export interface PendingWhatsAppMsg {
  id: string; // unique code or timestamp
  type: 'qr' | 'pole' | 'incident';
  code: string;
  date: string;
  lat: number;
  lng: number;
  status: string;
  wattage?: number;
  notes: string;
  photoBefore?: string;
  photoAfter?: string;
  operatorName?: string;
  crewName?: string;
  created_at: string;
}

const DB_NAME = 'lumqr_offline';
const DB_VERSION = 2;
const STORE_NAME = 'sync_queue';
const WA_STORE_NAME = 'whatsapp_queue';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'code' });
      }
      if (!db.objectStoreNames.contains(WA_STORE_NAME)) {
        db.createObjectStore(WA_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function addToQueue(item: OfflineInstallation): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(item);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getQueue(): Promise<OfflineInstallation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function removeFromQueue(code: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(code);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clearQueue(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// WHATSAPP OFFLINE QUEUE FUNCTIONS
export async function addPendingWhatsApp(item: PendingWhatsAppMsg): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(WA_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(WA_STORE_NAME);
    const request = store.put(item);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getPendingWhatsAppList(): Promise<PendingWhatsAppMsg[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(WA_STORE_NAME, 'readonly');
    const store = transaction.objectStore(WA_STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function removePendingWhatsApp(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(WA_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(WA_STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}


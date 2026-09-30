export interface OfflineInstallation {
  code: string;
  crew_id: number;
  operator_name?: string | null;
  lat: number;
  lng: number;
  status: 'Nueva' | 'Reparada' | 'Rehabilitada' | 'Robo' | string;
  wattage?: number | null;
  notes: string;
  photo_before?: string | null;
  photo_after?: string | null;
  installed_at: string; // ISO String
}

export interface OfflinePole {
  id: string; // unique code or timestamp
  crew_id: number;
  operator_name?: string | null;
  lat: number;
  lng: number;
  pole_type: string;
  lamp_type: string;
  zone_type: string;
  wattage?: number | null;
  operating_status: string;
  notes: string;
  photo_before?: string | null;
  photo_after?: string | null;
  created_at: string;
}

export interface OfflineIncident {
  id: string; // unique timestamp
  crew_id: number;
  operator_name?: string | null;
  incident_type: string;
  lat: number;
  lng: number;
  notes: string;
  photo_before?: string | null;
  photo_after?: string | null;
  created_at: string;
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
const DB_VERSION = 3;
const STORE_NAME = 'sync_queue';
const POLES_STORE_NAME = 'poles_sync_queue';
const INCIDENTS_STORE_NAME = 'incidents_sync_queue';
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
      if (!db.objectStoreNames.contains(POLES_STORE_NAME)) {
        db.createObjectStore(POLES_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(INCIDENTS_STORE_NAME)) {
        db.createObjectStore(INCIDENTS_STORE_NAME, { keyPath: 'id' });
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

// POLES CENSO OFFLINE QUEUE FUNCTIONS
export async function addToPolesQueue(item: OfflinePole): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(POLES_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(POLES_STORE_NAME);
    const request = store.put(item);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getPolesQueue(): Promise<OfflinePole[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(POLES_STORE_NAME, 'readonly');
    const store = transaction.objectStore(POLES_STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function removeFromPolesQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(POLES_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(POLES_STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// INCIDENTS OFFLINE QUEUE FUNCTIONS
export async function addToIncidentsQueue(item: OfflineIncident): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(INCIDENTS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(INCIDENTS_STORE_NAME);
    const request = store.put(item);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function getIncidentsQueue(): Promise<OfflineIncident[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(INCIDENTS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(INCIDENTS_STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function removeFromIncidentsQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(INCIDENTS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(INCIDENTS_STORE_NAME);
    const request = store.delete(id);

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


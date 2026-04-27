// Reticle — storage.js
// IndexedDB adapter. Async/await. Native API, no external deps.

const DB_NAME = 'reticle-db';
const DB_VERSION = 1;

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('armies')) {
        db.createObjectStore('armies', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

export async function getAllArmies() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('armies', 'readonly');
    const req = tx.objectStore('armies').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getArmy(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('armies', 'readonly');
    const req = tx.objectStore('armies').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveArmy(army) {
  const db = await openDB();
  const now = new Date().toISOString();
  army.updatedAt = now;
  if (!army.createdAt) army.createdAt = now;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('armies', 'readwrite');
    const req = tx.objectStore('armies').put(army);
    req.onsuccess = () => resolve(army);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteArmy(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('armies', 'readwrite');
    const req = tx.objectStore('armies').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getActiveArmyId() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readonly');
    const req = tx.objectStore('meta').get('activeArmyId');
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => reject(req.error);
  });
}

export async function setActiveArmyId(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite');
    const req = tx.objectStore('meta').put({ key: 'activeArmyId', value: id });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getAllUnitNames() {
  const armies = await getAllArmies();
  const names = new Set();
  for (const army of armies) {
    for (const unit of (army.units || [])) {
      if (unit.name) names.add(unit.name);
    }
  }
  return [...names].sort();
}

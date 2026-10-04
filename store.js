// On-device storage (IndexedDB): what is owned, custom coins, and small settings.
'use strict';

const Store = (() => {
  const DB_NAME = 'coin-album', DB_VERSION = 3;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('owned')) db.createObjectStore('owned');
        if (!db.objectStoreNames.contains('extras')) db.createObjectStore('extras');
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');   // v2: cropped coin photos (Blob)
        if (!db.objectStoreNames.contains('sources')) db.createObjectStore('sources'); // v3: originals {blob, params} to re-edit a crop
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const out = fn(s);
      t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  const put = (store, key, val) => tx(store, 'readwrite', s => s.put(val, key));
  const del = (store, key) => tx(store, 'readwrite', s => s.delete(key));
  const get = (store, key) => tx(store, 'readonly', s => s.get(key));

  async function all(store) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const out = new Map();
      const req = db.transaction(store, 'readonly').objectStore(store).openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { out.set(c.key, c.value); c.continue(); } else resolve(out); };
      req.onerror = () => reject(req.error);
    });
  }

  // Replace everything in one transaction (used by backup import). `photos` maps id -> Blob.
  async function replaceAll(owned, extras, photos) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(['owned', 'extras', 'photos', 'sources'], 'readwrite');
      const o = t.objectStore('owned'), x = t.objectStore('extras'), ph = t.objectStore('photos');
      o.clear(); x.clear(); ph.clear(); t.objectStore('sources').clear();   // originals aren't part of backups
      for (const [k, v] of Object.entries(owned)) o.put(v, k);
      for (const [k, v] of Object.entries(extras)) x.put(v, k);
      for (const [k, v] of Object.entries(photos || {})) ph.put(v, k);
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  async function persist() {
    try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) {}
    return false;
  }

  return { put, del, get, all, replaceAll, persist };
})();

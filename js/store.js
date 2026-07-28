/* Quant Lab Journal — local persistence (IndexedDB). No backend, private to this browser. */
const Store = (function () {
  const DB = 'quantlab_journal', VER = 1;
  let db = null;

  function open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, VER);
      r.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('trades')) d.createObjectStore('trades', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('playbooks')) d.createObjectStore('playbooks', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
      };
      r.onsuccess = () => { db = r.result; res(db); };
      r.onerror = () => rej(r.error);
    });
  }
  function tx(store, mode) { return db.transaction(store, mode).objectStore(store); }
  function all(store) {
    return new Promise((res, rej) => { const r = tx(store, 'readonly').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); });
  }
  function put(store, val) {
    return new Promise((res, rej) => { const r = tx(store, 'readwrite').put(val); r.onsuccess = () => res(val); r.onerror = () => rej(r.error); });
  }
  function del(store, key) {
    return new Promise((res, rej) => { const r = tx(store, 'readwrite').delete(key); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
  }
  function clear(store) {
    return new Promise((res, rej) => { const r = tx(store, 'readwrite').clear(); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
  }

  const uid = () => 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  return {
    async init() { await open(); },
    // trades
    getTrades: () => all('trades'),
    saveTrade: (t) => { if (!t.id) t.id = uid(); return put('trades', t); },
    deleteTrade: (id) => del('trades', id),
    clearTrades: () => clear('trades'),
    // playbooks
    getPlaybooks: () => all('playbooks'),
    savePlaybook: (p) => { if (!p.id) p.id = 'pb_' + Math.random().toString(36).slice(2, 8); return put('playbooks', p); },
    deletePlaybook: (id) => del('playbooks', id),
    // settings
    async getSetting(key, dflt) { const rows = await all('settings'); const row = rows.find(r => r.key === key); return row ? row.value : dflt; },
    setSetting: (key, value) => put('settings', { key, value }),
    uid
  };
})();

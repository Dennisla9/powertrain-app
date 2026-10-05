// Capa de datos independiente basada en IndexedDB.
// Reemplaza a base44.entities.* para que la app funcione sin infraestructura de Base44.
// Los datos viven solo en el navegador del usuario.

const DB_NAME = "powerpulse";
const DB_VERSION = 1;
const STORES = ["equipment", "capture", "reading"];

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function store(db, name, mode) {
  return db.transaction(name, mode).objectStore(name);
}

function asPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function stamp(record, isNew) {
  const now = new Date().toISOString();
  if (isNew) {
    record.id = record.id || uid();
    record.created_date = record.created_date || now;
  }
  record.updated_date = now;
  return record;
}

function matches(record, query) {
  if (!query) return true;
  for (const [k, v] of Object.entries(query)) {
    if (record[k] !== v) return false;
  }
  return true;
}

function sortBy(records, spec) {
  if (!spec) return records;
  const desc = spec.startsWith("-");
  const field = desc ? spec.slice(1) : spec;
  return [...records].sort((a, b) => {
    const av = a[field] == null ? "" : a[field];
    const bv = b[field] == null ? "" : b[field];
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

function makeStore(name) {
  return {
    async list(sort, limit) {
      const db = await openDB();
      let res = sortBy(await asPromise(store(db, name, "readonly").getAll()), sort);
      if (limit) res = res.slice(0, limit);
      return res;
    },
    async get(id) {
      const db = await openDB();
      return asPromise(store(db, name, "readonly").get(id));
    },
    async filter(query, sort, limit) {
      const db = await openDB();
      let res = sortBy(
        (await asPromise(store(db, name, "readonly").getAll())).filter((r) => matches(r, query)),
        sort
      );
      if (limit) res = res.slice(0, limit);
      return res;
    },
    async create(data) {
      const db = await openDB();
      const record = stamp({ ...data }, true);
      await asPromise(store(db, name, "readwrite").add(record));
      return record;
    },
    async bulkCreate(items) {
      const db = await openDB();
      const records = items.map((i) => stamp({ ...i }, true));
      const s = store(db, name, "readwrite");
      await Promise.all(records.map((r) => asPromise(s.add(r))));
      return records;
    },
    async update(id, data) {
      const db = await openDB();
      const existing = await asPromise(store(db, name, "readonly").get(id));
      if (!existing) throw new Error("Registro no encontrado");
      const updated = stamp({ ...existing, ...data, id }, false);
      await asPromise(store(db, name, "readwrite").put(updated));
      return updated;
    },
    async delete(id) {
      const db = await openDB();
      await asPromise(store(db, name, "readwrite").delete(id));
      return { id };
    },
  };
}

export const db = {
  Equipment: makeStore("equipment"),
  Capture: makeStore("capture"),
  Reading: makeStore("reading"),
};

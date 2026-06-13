// Cache en memoria con TTL simple (sin Redis)
const store = new Map();

function set(key, value, ttlMs = 60_000) {
    const expiresAt = Date.now() + ttlMs;
    store.set(key, { value, expiresAt });
}

function get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
    }
    return entry.value;
}

function del(key) {
    store.delete(key);
}

function clear() {
    store.clear();
}

// Limpieza periodica de entradas expiradas (cada 5 min)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
        if (now > entry.expiresAt) store.delete(key);
    }
}, 5 * 60 * 1000);

module.exports = { set, get, del, clear };

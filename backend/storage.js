// Almacenamiento de archivos subidos (documentos) en Supabase Storage, en
// vez del disco local del servidor -- Render (y la mayoría de los hosts
// gratis) tiene disco efímero: se borra en cada reinicio o despliegue, así
// que cualquier archivo guardado ahí se pierde. Supabase Storage persiste
// igual que la base de datos.
const { logger } = require('./shared');

let client = null;

function getClient() {
    if (client) return client;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    const { createClient } = require('@supabase/supabase-js');
    client = createClient(url, key, { auth: { persistSession: false } });
    return client;
}

function getBucket() {
    return process.env.SUPABASE_STORAGE_BUCKET || 'documentos';
}

function isConfigured() {
    return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Sube un archivo y devuelve la key (ruta dentro del bucket) para guardar en
// la base de datos. Lanza si Supabase no está configurado -- sin storage
// configurado, mejor que la subida falle explícitamente a que el archivo se
// pierda en disco local en silencio.
async function subirArchivo(key, buffer, mimeType) {
    const sb = getClient();
    if (!sb) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados');
    const { error } = await sb.storage.from(getBucket()).upload(key, buffer, {
        contentType: mimeType,
        upsert: false,
    });
    if (error) throw error;
    return key;
}

// Devuelve una URL firmada de corta duración para descargar el archivo
// directamente desde Supabase (el cliente descarga de ahí, no a través de
// nuestro servidor).
async function urlDescarga(key, segundosValidez = 60) {
    const sb = getClient();
    if (!sb) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados');
    const { data, error } = await sb.storage.from(getBucket()).createSignedUrl(key, segundosValidez);
    if (error) throw error;
    return data.signedUrl;
}

async function borrarArchivo(key) {
    const sb = getClient();
    if (!sb) return;
    const { error } = await sb.storage.from(getBucket()).remove([key]);
    if (error) logger.warn({ err: error, key }, 'No se pudo borrar el archivo de Supabase Storage');
}

module.exports = { isConfigured, subirArchivo, urlDescarga, borrarArchivo };

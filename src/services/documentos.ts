import { Documento, CategoriaDocumento, FiltrosDocumentos, DocumentoFallback } from '../types';

const API_BASE = 'http://localhost:3001/api';
const FALLBACK_KEY = 'documentos_fallback';
const MAX_FALLBACK_SIZE = 2 * 1024 * 1024;

function esBackendDisponible(): Promise<boolean> {
    return fetch(`${API_BASE}/health`, { method: 'GET' })
        .then(res => res.ok)
        .catch(() => false);
}

export function formatearTamano(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function obtenerIconoPorMime(mimeType: string): string {
    if (mimeType.includes('pdf')) return 'FileText';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'FileText';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('sheet')) return 'Table';
    if (mimeType.includes('image')) return 'Image';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'Archive';
    if (mimeType.includes('text')) return 'File';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'Presentation';
    return 'File';
}

export function esExtensionPermitida(nombreArchivo: string): boolean {
    const allowed = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.jpg', '.jpeg', '.png', '.gif', '.zip', '.odt', '.pptx', '.ppt', '.txt', '.csv'];
    const ext = nombreArchivo.substring(nombreArchivo.lastIndexOf('.')).toLowerCase();
    return allowed.includes(ext);
}

export function obtenerExtension(nombreArchivo: string): string {
    return nombreArchivo.substring(nombreArchivo.lastIndexOf('.') + 1).toUpperCase();
}

async function guardarFallback(doc: DocumentoFallback): Promise<void> {
    const existentes = obtenerDocumentosFallback();
    const idx = existentes.findIndex(d => d.id === doc.id);
    if (idx >= 0) existentes[idx] = doc;
    else existentes.push(doc);
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(existentes));
}

export function obtenerDocumentosFallback(): DocumentoFallback[] {
    try {
        const data = localStorage.getItem(FALLBACK_KEY);
        return data ? JSON.parse(data) : [];
    } catch { return []; }
}

export function eliminarDocumentoFallback(id: string): void {
    const existentes = obtenerDocumentosFallback().filter(d => d.id !== id);
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(existentes));
}

export function actualizarDocumentoFallback(id: string, data: Partial<DocumentoFallback>): void {
    const existentes = obtenerDocumentosFallback();
    const idx = existentes.findIndex(d => d.id === id);
    if (idx >= 0) existentes[idx] = { ...existentes[idx], ...data };
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(existentes));
}

function archivoABase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function base64ABlob(base64: string, mimeType: string): Blob {
    const base64Data = base64.split(',')[1] || base64;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

export function descargarDocumentoFallback(doc: DocumentoFallback): void {
    const blob = base64ABlob(doc.base64, doc.mimeType);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.nombre;
    a.click();
    URL.revokeObjectURL(url);
}

// ============ API CON FALLBACK ============

export async function subirDocumento(params: {
    archivo: File;
    categoria: string;
    empresaId?: string;
    trabajadorId?: string;
    asientoId?: string;
    etiquetas?: string;
    descripcion?: string;
    fechaDoc?: string;
}): Promise<Documento | DocumentoFallback> {
    const disponible = await esBackendDisponible();

    if (disponible) {
        const formData = new FormData();
        formData.append('archivo', params.archivo);
        formData.append('categoria', params.categoria);
        if (params.empresaId) formData.append('empresaId', params.empresaId);
        if (params.trabajadorId) formData.append('trabajadorId', params.trabajadorId);
        if (params.asientoId) formData.append('asientoId', params.asientoId);
        if (params.etiquetas) formData.append('etiquetas', params.etiquetas);
        if (params.descripcion) formData.append('descripcion', params.descripcion);
        if (params.fechaDoc) formData.append('fechaDoc', params.fechaDoc);

        const res = await fetch(`${API_BASE}/documentos/upload`, { method: 'POST', body: formData });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error al subir archivo');
        }
        return await res.json();
    }

    if (params.archivo.size > MAX_FALLBACK_SIZE) {
        throw new Error(`El archivo excede ${MAX_FALLBACK_SIZE / 1024 / 1024}MB. Sube el backend para archivos grandes.`);
    }

    const base64 = await archivoABase64(params.archivo);
    const doc: DocumentoFallback = {
        id: crypto.randomUUID(),
        nombre: params.archivo.name,
        categoria: params.categoria,
        tipo: obtenerExtension(params.archivo.name),
        mimeType: params.archivo.type || 'application/octet-stream',
        tamano: params.archivo.size,
        etiquetas: params.etiquetas ? params.etiquetas.split(',').map(t => t.trim()) : [],
        descripcion: params.descripcion,
        fechaDoc: params.fechaDoc,
        fechaSubida: new Date().toISOString(),
        base64,
        version: 1,
        activo: true,
    };

    await guardarFallback(doc);
    return doc;
}

export async function listarDocumentos(filtros: FiltrosDocumentos = {}): Promise<{
    documentos: (Documento | DocumentoFallback)[];
    total: number;
}> {
    const disponible = await esBackendDisponible();

    if (disponible) {
        const params = new URLSearchParams();
        if (filtros.categoria) params.append('categoria', filtros.categoria);
        if (filtros.empresaId) params.append('empresaId', filtros.empresaId);
        if (filtros.trabajadorId) params.append('trabajadorId', filtros.trabajadorId);
        if (filtros.asientoId) params.append('asientoId', filtros.asientoId);
        if (filtros.texto) params.append('texto', filtros.texto);
        if (filtros.limite) params.append('limite', String(filtros.limite));
        if (filtros.offset) params.append('offset', String(filtros.offset));

        const res = await fetch(`${API_BASE}/documentos?${params.toString()}`);
        if (!res.ok) throw new Error('Error al listar documentos');
        const data = await res.json();
        return { documentos: data.documentos, total: data.total };
    }

    let docs = obtenerDocumentosFallback().filter(d => d.activo);
    if (filtros.categoria) docs = docs.filter(d => d.categoria === filtros.categoria);
    if (filtros.empresaId) docs = docs.filter(d => d.empresaId === filtros.empresaId);
    if (filtros.trabajadorId) docs = docs.filter(d => d.trabajadorId === filtros.trabajadorId);
    if (filtros.texto) {
        const t = filtros.texto.toLowerCase();
        docs = docs.filter(d =>
            d.nombre.toLowerCase().includes(t) ||
            (d.descripcion || '').toLowerCase().includes(t) ||
            (d.etiquetas || []).some(e => e.toLowerCase().includes(t))
        );
    }
    return { documentos: docs, total: docs.length };
}

export async function obtenerDocumento(id: string): Promise<Documento | DocumentoFallback | null> {
    const disponible = await esBackendDisponible();
    if (disponible) {
        const res = await fetch(`${API_BASE}/documentos/${id}`);
        if (!res.ok) {
            if (res.status === 404) return null;
            throw new Error('Error al obtener documento');
        }
        return await res.json();
    }
    return obtenerDocumentosFallback().find(d => d.id === id) || null;
}

export async function actualizarDocumento(id: string, data: {
    categoria?: string;
    etiquetas?: string;
    descripcion?: string;
    nombre?: string;
}): Promise<Documento | DocumentoFallback> {
    const disponible = await esBackendDisponible();
    if (disponible) {
        const res = await fetch(`${API_BASE}/documentos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Error al actualizar documento');
        return await res.json();
    }
    actualizarDocumentoFallback(id, {
        ...data,
        etiquetas: data.etiquetas ? data.etiquetas.split(',').map(t => t.trim()).filter(Boolean) : undefined,
    });
    const updated = obtenerDocumentosFallback().find(d => d.id === id);
    if (!updated) throw new Error('Documento no encontrado');
    return updated;
}

export async function eliminarDocumento(id: string): Promise<void> {
    const disponible = await esBackendDisponible();
    if (disponible) {
        const res = await fetch(`${API_BASE}/documentos/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error al eliminar documento');
        return;
    }
    actualizarDocumentoFallback(id, { activo: false });
}

export function obtenerUrlDescarga(id: string): string {
    return `${API_BASE}/documentos/${id}/descargar`;
}

export async function listarCategorias(): Promise<CategoriaDocumento[]> {
    const disponible = await esBackendDisponible();
    if (!disponible) {
        return [
            { id: 1, nombre: 'Contratos', color: '#3b82f6', icono: 'FileText' },
            { id: 2, nombre: 'Facturas', color: '#10b981', icono: 'Receipt' },
            { id: 3, nombre: 'Boletas', color: '#8b5cf6', icono: 'FileCheck' },
            { id: 4, nombre: 'Liquidaciones', color: '#f59e0b', icono: 'Calculator' },
            { id: 5, nombre: 'Certificados', color: '#06b6d4', icono: 'Award' },
            { id: 6, nombre: 'Legal', color: '#ef4444', icono: 'Scale' },
            { id: 7, nombre: 'Informes', color: '#64748b', icono: 'BarChart3' },
            { id: 8, nombre: 'Otros', color: '#6b7280', icono: 'Folder' },
        ];
    }
    const res = await fetch(`${API_BASE}/categorias`);
    if (!res.ok) throw new Error('Error al listar categorias');
    return await res.json();
}

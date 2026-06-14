// src/services/apiSync.ts
// Helpers para sincronizar datos entre contextos locales y la API REST.

import { apiFetch } from './httpClient';
import { getToken } from './apiAuth';
import { Cuenta, AsientoContable, Trabajador, DocumentoTributario, Honorario } from '../types';
import type { Empresa } from '../stores/appStore';

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function getEmpresaActivaId(): string | null {
  try {
    const raw = localStorage.getItem('app-storage');
    if (raw) return JSON.parse(raw)?.state?.empresaActiva?.id || null;
  } catch { /* ignore */ }
  return null;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

async function fetchAll<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const qs = new URLSearchParams({ ...params, page: String(page), limit: '500' }).toString();
    const res = await apiFetch<PaginatedResponse<T>>(`${path}?${qs}`);
    results.push(...res.data);
    totalPages = res.totalPages ?? 1;
    page++;
    if (page > totalPages) break;
  }
  return results;
}

// ============ EMPRESAS ============

export async function fetchEmpresas(): Promise<Empresa[]> {
  const rows = await apiFetch<Record<string, unknown>[]>('/api/empresas');
  return (rows || []).map(r => ({
    id: r.id as string,
    rut: r.rut as string,
    razonSocial: r.razonSocial as string,
    nombreFantasia: (r.nombreFantasia as string) || (r.razonSocial as string) || '',
    giro: (r.giro as string) || '',
    direccion: (r.direccion as string) || '',
    comuna: (r.comuna as string) || '',
    ciudad: (r.ciudad as string) || '',
    email: (r.email as string) || '',
    telefono: (r.telefono as string) || '',
    logo: (r.logo as string) || undefined,
    activa: (r.activo as boolean) ?? true,
  }));
}

export async function saveEmpresa(e: Empresa): Promise<void> {
  await apiFetch('/api/empresas', {
    method: 'POST',
    body: JSON.stringify({
      id: e.id,
      rut: e.rut,
      razonSocial: e.razonSocial,
      nombreFantasia: e.nombreFantasia || null,
      giro: e.giro || null,
      direccion: e.direccion || null,
      comuna: e.comuna || null,
      ciudad: e.ciudad || null,
      telefono: e.telefono || null,
      email: e.email || null,
      logo: e.logo || null,
    }),
  });
}

export async function deleteEmpresa(id: string): Promise<void> {
  await apiFetch(`/api/empresas/${id}`, { method: 'DELETE' });
}

// ============ CUENTAS ============

export async function fetchCuentas(): Promise<Cuenta[]> {
  const empresaId = getEmpresaActivaId();
  const params = empresaId ? { empresaId } : {};
  const rows = await fetchAll<Record<string, unknown>>('/api/cuentas', params);
  return rows.map(r => ({
    id: r.id as string,
    codigo: r.codigo as string,
    nombre: r.nombre as string,
    tipo: r.tipo as Cuenta['tipo'],
    naturaleza: (r.naturaleza as Cuenta['naturaleza']) || 'deudora',
    permiteMovimiento: (r.permiteMovimiento as boolean) ?? true,
    nivel: (r.nivel as number) ?? 1,
    padreId: (r.padreId as string) || undefined,
    descripcion: (r.descripcion as string) || undefined,
    refSII: (r.refSII as string) || undefined,
  }));
}

export async function saveCuenta(cuenta: Cuenta): Promise<void> {
  await apiFetch('/api/cuentas', {
    method: 'POST',
    body: JSON.stringify({
      id: cuenta.id,
      codigo: cuenta.codigo,
      nombre: cuenta.nombre,
      tipo: cuenta.tipo,
      naturaleza: cuenta.naturaleza,
      permiteMovimiento: cuenta.permiteMovimiento,
      nivel: cuenta.nivel ?? 1,
      padreId: cuenta.padreId || null,
      descripcion: cuenta.descripcion || null,
      refSII: cuenta.refSII || null,
      afectaIva: false,
      empresaId: getEmpresaActivaId(),
    }),
  });
}

export async function updateCuenta(cuenta: Cuenta): Promise<void> {
  await apiFetch(`/api/cuentas/${cuenta.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      codigo: cuenta.codigo,
      nombre: cuenta.nombre,
      tipo: cuenta.tipo,
      naturaleza: cuenta.naturaleza,
      permiteMovimiento: cuenta.permiteMovimiento,
      nivel: cuenta.nivel ?? 1,
      padreId: cuenta.padreId || null,
      descripcion: cuenta.descripcion || null,
      refSII: cuenta.refSII || null,
    }),
  });
}

export async function deleteCuenta(id: string): Promise<void> {
  await apiFetch(`/api/cuentas/${id}`, { method: 'DELETE' });
}

// ============ ASIENTOS ============

const estadoToBackend: Record<string, string> = {
  aprobado: 'contabilizado',
  pendiente: 'pendiente',
  anulado: 'anulado',
};
const estadoFromBackend: Record<string, AsientoContable['estado']> = {
  contabilizado: 'aprobado',
  pendiente: 'pendiente',
  anulado: 'anulado',
};

export async function fetchAsientos(): Promise<AsientoContable[]> {
  const empresaId = getEmpresaActivaId();
  const params = empresaId ? { empresaId } : {};
  const rows = await fetchAll<Record<string, unknown>>('/api/asientos', params);
  return rows.map(r => {
    const detalles = ((r.detalles as Record<string, unknown>[]) || []).map(d => ({
      id: d.id as string,
      cuentaId: d.cuentaId as string,
      cuentaCodigo: ((d.cuenta as Record<string, unknown>)?.codigo as string) || '',
      cuentaNombre: ((d.cuenta as Record<string, unknown>)?.nombre as string) || '',
      debe: d.debe as number,
      haber: d.haber as number,
    }));
    const totalDebe = detalles.reduce((s, d) => s + d.debe, 0);
    const totalHaber = detalles.reduce((s, d) => s + d.haber, 0);
    return {
      id: r.id as string,
      numero: r.numero as number,
      fecha: (r.fecha as string).substring(0, 10),
      glosa: r.glosa as string,
      detalles,
      totalDebe,
      totalHaber,
      estado: estadoFromBackend[r.estado as string] ?? 'pendiente',
      tipo: (r.tipo as string) || undefined,
    };
  });
}

export async function saveAsiento(asiento: AsientoContable): Promise<void> {
  await apiFetch('/api/asientos', {
    method: 'POST',
    body: JSON.stringify({
      id: asiento.id,
      numero: asiento.numero,
      fecha: asiento.fecha,
      glosa: asiento.glosa,
      estado: estadoToBackend[asiento.estado] ?? 'pendiente',
      tipo: asiento.tipo || null,
      empresaId: getEmpresaActivaId(),
      detalles: asiento.detalles.map(d => ({
        cuentaId: d.cuentaId,
        debe: d.debe,
        haber: d.haber,
      })),
    }),
  });
}

export async function updateAsientoEstado(id: string, estado: string): Promise<void> {
  await apiFetch(`/api/asientos/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ estado: estadoToBackend[estado] ?? estado }),
  });
}

export async function deleteAsiento(id: string): Promise<void> {
  await apiFetch(`/api/asientos/${id}`, { method: 'DELETE' });
}

// ============ TRABAJADORES ============

const contratoToBackend: Record<string, string> = {
  plazo: 'plazo_fijo',
  indefinido: 'indefinido',
  honorarios: 'honorarios',
};
const contratoFromBackend: Record<string, Trabajador['tipoContrato']> = {
  plazo_fijo: 'plazo',
  indefinido: 'indefinido',
  honorarios: 'honorarios',
};

export async function fetchTrabajadores(): Promise<Trabajador[]> {
  const empresaId = getEmpresaActivaId();
  const params = empresaId ? { empresaId } : {};
  const rows = await fetchAll<Record<string, unknown>>('/api/trabajadores', params);
  return rows.map(r => ({
    id: r.id as string,
    rut: r.rut as string,
    nombre: r.nombres as string,
    apellidos: r.apellidos as string,
    fechaNacimiento: r.fechaNacimiento ? (r.fechaNacimiento as string).substring(0, 10) : '',
    cargo: (r.cargo as string) || '',
    departamento: (r.departamento as string) || '',
    fechaIngreso: (r.fechaIngreso as string).substring(0, 10),
    fechaTermino: r.fechaTermino ? (r.fechaTermino as string).substring(0, 10) : undefined,
    tipoContrato: contratoFromBackend[r.tipoContrato as string] ?? 'indefinido',
    sueldoBase: r.sueldoBase as number,
    colacion: (r.colacion as number) || 0,
    movilizacion: (r.movilizacion as number) || 0,
    bonificacion: (r.bonificacion as number) || 0,
    afpId: r.afp as string,
    isapreId: (r.isapre as string) || 'fonasa',
    pensionado: false,
    cargaCivil: (r.cargasFamiliares as number) || 0,
    cargaMilitar: 0,
    estado: (r.estado as Trabajador['estado']) || 'activo',
  }));
}

export async function saveTrabajador(t: Trabajador): Promise<void> {
  await apiFetch('/api/trabajadores', {
    method: 'POST',
    body: JSON.stringify({
      id: t.id,
      empresaId: getEmpresaActivaId(),
      rut: t.rut,
      nombres: t.nombre,
      apellidos: t.apellidos,
      fechaNacimiento: t.fechaNacimiento || null,
      cargo: t.cargo || null,
      departamento: t.departamento || null,
      fechaIngreso: t.fechaIngreso,
      fechaTermino: t.fechaTermino || null,
      tipoContrato: contratoToBackend[t.tipoContrato] ?? t.tipoContrato,
      sueldoBase: t.sueldoBase,
      colacion: t.colacion || 0,
      movilizacion: t.movilizacion || 0,
      bonificacion: t.bonificacion || 0,
      afp: t.afpId,
      isapre: t.isapreId && t.isapreId !== 'fonasa' ? t.isapreId : null,
      saludPactado: 7,
      afc: 0,
      cargasFamiliares: (t.cargaCivil || 0) + (t.cargaMilitar || 0),
      estado: t.estado || 'activo',
    }),
  });
}

export async function updateTrabajador(t: Trabajador): Promise<void> {
  await apiFetch(`/api/trabajadores/${t.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      rut: t.rut,
      nombres: t.nombre,
      apellidos: t.apellidos,
      fechaNacimiento: t.fechaNacimiento || null,
      cargo: t.cargo || null,
      departamento: t.departamento || null,
      fechaIngreso: t.fechaIngreso,
      fechaTermino: t.fechaTermino || null,
      tipoContrato: contratoToBackend[t.tipoContrato] ?? t.tipoContrato,
      sueldoBase: t.sueldoBase,
      colacion: t.colacion || 0,
      movilizacion: t.movilizacion || 0,
      bonificacion: t.bonificacion || 0,
      afp: t.afpId,
      isapre: t.isapreId && t.isapreId !== 'fonasa' ? t.isapreId : null,
      cargasFamiliares: (t.cargaCivil || 0) + (t.cargaMilitar || 0),
      estado: t.estado || 'activo',
    }),
  });
}

export async function deleteTrabajador(id: string): Promise<void> {
  await apiFetch(`/api/trabajadores/${id}`, { method: 'DELETE' });
}

// ============ DOCUMENTOS TRIBUTARIOS ============

const tipoDocToBackend: Record<string, string> = {
  factura: 'factura',
  factura_compra: 'compra',
  factura_exenta: 'factura_exenta',
  boleta: 'boleta',
  boleta_exenta: 'boleta',
  boleta_electronica: 'boleta',
  nota_credito: 'nota_credito',
  nota_debito: 'nota_debito',
  guia_despacho: 'guia_despacho',
};

const tipoDocFromBackend: Record<string, DocumentoTributario['tipo']> = {
  factura: 'factura',
  compra: 'factura_compra',
  factura_exenta: 'factura_exenta',
  boleta: 'boleta',
  nota_credito: 'nota_credito',
  nota_debito: 'nota_debito',
  guia_despacho: 'guia_despacho',
};

export async function fetchDocumentos(): Promise<DocumentoTributario[]> {
  const empresaId = getEmpresaActivaId();
  const params = empresaId ? { empresaId } : {};
  const rows = await fetchAll<Record<string, unknown>>('/api/documentosTributarios', params);
  return rows.map(r => ({
    id: r.id as string,
    tipo: tipoDocFromBackend[r.tipo as string] ?? (r.tipo as DocumentoTributario['tipo']),
    numero: r.folio as number,
    serie: '',
    fecha: (r.fechaEmision as string).substring(0, 10),
    receptor: {
      rut: r.rutReceptor as string,
      razonSocial: r.razonSocialReceptor as string,
      giro: (r.giroReceptor as string) || '',
      direccion: (r.direccionReceptor as string) || '',
      comuna: (r.comunaReceptor as string) || '',
      ciudad: '',
      contacto: '',
      email: '',
    },
    condicionesPago: '',
    detalles: [],
    subtotal: r.montoNeto as number,
    descuentoGlobal: 0,
    iva: r.iva as number,
    totalExento: (r.montoExento as number) || 0,
    total: r.montoTotal as number,
    neto: r.montoNeto as number,
    estado: (r.estado as DocumentoTributario['estado']) || 'emitido',
    libro: r.tipoTransaccion === 'compra' ? 'compras' : 'ventas',
  }));
}

export async function saveDocumento(doc: DocumentoTributario, rutEmisor: string): Promise<void> {
  const tipo = tipoDocToBackend[doc.tipo] ?? doc.tipo;
  await apiFetch('/api/documentosTributarios', {
    method: 'POST',
    body: JSON.stringify({
      id: doc.id,
      tipo,
      empresaId: getEmpresaActivaId(),
      folio: doc.numero,
      rutEmisor: rutEmisor || '00.000.000-0',
      rutReceptor: doc.receptor?.rut || '00.000.000-0',
      razonSocialReceptor: doc.receptor?.razonSocial || 'Sin receptor',
      giroReceptor: doc.receptor?.giro || null,
      fechaEmision: doc.fecha,
      montoNeto: doc.subtotal || doc.neto || 0,
      iva: doc.iva || 0,
      montoExento: doc.totalExento || 0,
      montoTotal: doc.total,
      estado: doc.estado === 'congelado' ? 'emitido' : (doc.estado || 'emitido'),
      tipoTransaccion: doc.libro === 'compras' ? 'compra' : 'venta',
      glosa: null,
    }),
  });
}

export async function updateDocumento(id: string, estado: string): Promise<void> {
  await apiFetch(`/api/documentosTributarios/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ estado: estado === 'congelado' ? 'emitido' : estado }),
  });
}

// ============ HONORARIOS ============

export async function fetchHonorarios(): Promise<Honorario[]> {
  const empresaId = getEmpresaActivaId();
  const params = empresaId ? { empresaId } : {};
  const rows = await fetchAll<Record<string, unknown>>('/api/honorarios', params);
  return rows.map(r => ({
    id: r.id as string,
    rut: r.rut as string,
    nombre: r.nombre as string,
    direccion: (r.direccion as string) || '',
    periodo: r.periodo as string,
    montoBruto: r.montoBruto as number,
    retencion: r.retencion as number,
    montoLiquido: r.montoLiquido as number,
    fechaPago: r.fechaPago ? (r.fechaPago as string).substring(0, 10) : '',
    estado: (r.estado as Honorario['estado']) || 'pendiente',
  }));
}

export async function saveHonorario(h: Honorario): Promise<void> {
  await apiFetch('/api/honorarios', {
    method: 'POST',
    body: JSON.stringify({
      id: h.id,
      empresaId: getEmpresaActivaId(),
      rut: h.rut,
      nombre: h.nombre,
      direccion: h.direccion || null,
      periodo: h.periodo,
      montoBruto: h.montoBruto,
      retencion: h.retencion,
      montoLiquido: h.montoLiquido,
      fechaPago: h.fechaPago || null,
      estado: h.estado || 'pendiente',
    }),
  });
}

export async function updateHonorario(h: Honorario): Promise<void> {
  await apiFetch(`/api/honorarios/${h.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      rut: h.rut,
      nombre: h.nombre,
      direccion: h.direccion || null,
      periodo: h.periodo,
      montoBruto: h.montoBruto,
      retencion: h.retencion,
      montoLiquido: h.montoLiquido,
      fechaPago: h.fechaPago || null,
      estado: h.estado || 'pendiente',
    }),
  });
}

export async function deleteHonorario(id: string): Promise<void> {
  await apiFetch(`/api/honorarios/${id}`, { method: 'DELETE' });
}

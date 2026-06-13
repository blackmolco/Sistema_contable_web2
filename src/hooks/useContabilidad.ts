// src/hooks/useContabilidad.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// apiFetchRaw: cliente central con refresh automatico de token y aviso de sesion expirada
import { apiFetchRaw as apiFetch } from '../services/httpClient';
import { handleApiResponse } from '../services/errorHandler';

// ============ CUENTAS ============
export function useCuentas(params?: { tipo?: string; busqueda?: string; page?: number }) {
  const search = new URLSearchParams();
  if (params?.tipo) search.set('tipo', params.tipo);
  if (params?.busqueda) search.set('busqueda', params.busqueda);
  if (params?.page) search.set('page', String(params.page));

  return useQuery({
    queryKey: ['cuentas', params],
    queryFn: () => apiFetch(`/api/cuentas?${search}`).then(r => handleApiResponse(r)),
  });
}

export function useCrearCuenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch('/api/cuentas', { method: 'POST', body: JSON.stringify(data) }).then(r => handleApiResponse(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cuentas'] }),
  });
}

// ============ ASIENTOS ============
export function useAsientos(params?: { empresaId?: string; estado?: string; desde?: string; hasta?: string; page?: number }) {
  const search = new URLSearchParams();
  if (params?.empresaId) search.set('empresaId', params.empresaId);
  if (params?.estado) search.set('estado', params.estado);
  if (params?.desde) search.set('desde', params.desde);
  if (params?.hasta) search.set('hasta', params.hasta);
  if (params?.page) search.set('page', String(params.page));

  return useQuery({
    queryKey: ['asientos', params],
    queryFn: () => apiFetch(`/api/asientos?${search}`).then(r => handleApiResponse(r)),
  });
}

export function useCrearAsiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch('/api/asientos', { method: 'POST', body: JSON.stringify(data) }).then(r => handleApiResponse(r)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['asientos'] }),
  });
}

// ============ TRABAJADORES ============
export function useTrabajadores(params?: { empresaId?: string; estado?: string; busqueda?: string; page?: number }) {
  const search = new URLSearchParams();
  if (params?.empresaId) search.set('empresaId', params.empresaId);
  if (params?.estado) search.set('estado', params.estado);
  if (params?.busqueda) search.set('busqueda', params.busqueda);
  if (params?.page) search.set('page', String(params.page));

  return useQuery({
    queryKey: ['trabajadores', params],
    queryFn: () => apiFetch(`/api/trabajadores?${search}`).then(r => handleApiResponse(r)),
  });
}

// ============ HONORARIOS ============
export function useHonorarios(params?: { empresaId?: string; periodo?: string; estado?: string; page?: number }) {
  const search = new URLSearchParams();
  if (params?.empresaId) search.set('empresaId', params.empresaId);
  if (params?.periodo) search.set('periodo', params.periodo);
  if (params?.estado) search.set('estado', params.estado);
  if (params?.page) search.set('page', String(params.page));

  return useQuery({
    queryKey: ['honorarios', params],
    queryFn: () => apiFetch(`/api/honorarios?${search}`).then(r => handleApiResponse(r)),
  });
}

// ============ DOCUMENTOS TRIBUTARIOS ============
export function useDocumentosTributarios(params?: { empresaId?: string; tipo?: string; estado?: string; tipoTransaccion?: string; page?: number }) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined) search.set(k, String(v)); });

  return useQuery({
    queryKey: ['documentos-tributarios', params],
    queryFn: () => apiFetch(`/api/documentos-tributarios?${search}`).then(r => handleApiResponse(r)),
  });
}

// ============ TESORERIA ============
export function useTesoreria(params?: { empresaId?: string; tipo?: string; estado?: string; page?: number }) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined) search.set(k, String(v)); });

  return useQuery({
    queryKey: ['tesoreria', params],
    queryFn: () => apiFetch(`/api/tesoreria?${search}`).then(r => handleApiResponse(r)),
  });
}

// ============ BUSQUEDA ============
export function useBusqueda(q: string) {
  return useQuery({
    queryKey: ['busqueda', q],
    queryFn: () => apiFetch(`/api/busqueda?q=${encodeURIComponent(q)}`).then(r => handleApiResponse(r)),
    enabled: q.length >= 2,
    staleTime: 1000 * 30,
  });
}

// ============ EMPRESAS ============
export function useEmpresas() {
  return useQuery({
    queryKey: ['empresas'],
    queryFn: () => apiFetch('/api/empresas').then(r => handleApiResponse(r)),
    staleTime: 1000 * 60 * 10,
  });
}

import { useEffect, useState } from 'react';
import { apiFetch } from '../services/httpClient';
import { useAppStore } from '../stores/appStore';

// Cuentas que el sistema usa por su cuenta (clientes, IVA, ventas...).
// Cada empresa puede tener su propio plan de cuentas: el servidor dice cual
// cuenta cumple cada funcion (GET /api/empresas/:id/cuentas-sistema). Los
// codigos de abajo son los del plan estandar y solo se usan mientras carga
// la respuesta o si la empresa no configuro nada.
export type ConceptoCuenta =
  | 'clientes' | 'proveedores' | 'ventas' | 'ivaDebito' | 'ivaCredito' | 'remanenteIva' | 'ivaPorPagar'
  | 'honorariosGasto' | 'honorariosPorPagar' | 'retencionHonorarios' | 'cuentaPorClasificar'
  | 'cajaBoletas' | 'utilidadesAcumuladas';

export const CODIGOS_ESTANDAR: Record<ConceptoCuenta, string> = {
  clientes: '1-02-001-0001',
  proveedores: '2-01-001-0001',
  ventas: '4-01-001-0001',
  ivaDebito: '2-01-002-0001',
  ivaCredito: '1-02-002-0001',
  remanenteIva: '1-02-002-0002',
  ivaPorPagar: '2-01-002-0003',
  honorariosGasto: '5-02-001-0004',
  honorariosPorPagar: '2-01-001-0003',
  retencionHonorarios: '2-01-002-0005',
  cuentaPorClasificar: '5-03-004-0001',
  cajaBoletas: '1-01-002-0001',
  utilidadesAcumuladas: '3-01-003-0001',
};

export interface CuentaSistemaFila {
  concepto: ConceptoCuenta;
  label: string;
  codigoDefault: string;
  cuentaId: string | null;
  cuentaCodigo: string | null;
  cuentaNombre: string | null;
  esPersonalizada: boolean;
}

const cache = new Map<string, CuentaSistemaFila[]>();

export function useCuentasSistema() {
  const empresaId = useAppStore(s => s.empresaActiva?.id ?? null);
  const [filas, setFilas] = useState<CuentaSistemaFila[] | null>(empresaId ? cache.get(empresaId) ?? null : null);

  useEffect(() => {
    if (!empresaId) { setFilas(null); return; }
    let vigente = true;
    setFilas(cache.get(empresaId) ?? null);
    apiFetch<CuentaSistemaFila[]>(`/api/empresas/${empresaId}/cuentas-sistema`)
      .then(r => { cache.set(empresaId, r); if (vigente) setFilas(r); })
      .catch(() => { /* sin acceso a la configuracion: se usan los codigos estandar */ });
    return () => { vigente = false; };
  }, [empresaId]);

  const codigos = { ...CODIGOS_ESTANDAR } as Record<ConceptoCuenta, string>;
  for (const f of filas ?? []) if (f.cuentaCodigo) codigos[f.concepto] = f.cuentaCodigo;

  return {
    /** Codigo de la cuenta de cada concepto en el plan de la empresa activa. */
    codigos,
    filas,
    listo: filas !== null,
    recargar: () => { if (empresaId) cache.delete(empresaId); },
  };
}

/** Grupo de un codigo, sea "1-02-001-0001" o "1.1.02.01". */
export const grupoDeCodigo = (codigo: string) => codigo.split(/[-.]/)[0];

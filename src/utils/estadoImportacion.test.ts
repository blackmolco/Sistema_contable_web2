import { describe, it, expect } from 'vitest';
import { normalizarEstadoImportacion } from './estadoImportacion';

const AHORA = 1_000_000_000_000;

describe('normalizarEstadoImportacion', () => {
  it('un lote en curso se deja como esta', () => {
    const e = { estado: 'procesando', hecho: 3, total: 10, actualizado: AHORA - 5_000 };
    expect(normalizarEstadoImportacion(e, AHORA)).toEqual(e);
  });

  it('procesando con todo el lote hecho (1/1) es en realidad completada', () => {
    const e = { estado: 'procesando', hecho: 1, total: 1, actualizado: AHORA - 5_000 };
    expect(normalizarEstadoImportacion(e, AHORA)?.estado).toBe('completada');
  });

  it('procesando que lleva mas de 10 minutos sin avanzar se descarta', () => {
    const e = { estado: 'procesando', hecho: 3, total: 10, actualizado: AHORA - 11 * 60 * 1000 };
    expect(normalizarEstadoImportacion(e, AHORA)).toBeNull();
  });

  it('los estados finales no se tocan, aunque sean viejos', () => {
    const e = { estado: 'con_errores', hecho: 2, total: 3, actualizado: AHORA - 24 * 3600 * 1000 };
    expect(normalizarEstadoImportacion(e, AHORA)).toEqual(e);
  });

  it('sin estado devuelve null', () => {
    expect(normalizarEstadoImportacion(null, AHORA)).toBeNull();
  });
});

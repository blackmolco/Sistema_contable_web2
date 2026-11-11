import { describe, it, expect } from 'vitest';
import { anioMesDe } from './periodo';

describe('anioMesDe', () => {
  // new Date('2026-05-01').getMonth() da abril en Chile; el texto manda.
  it('lee año y mes del texto, sin depender del huso horario', () => {
    expect(anioMesDe('2026-05-01')).toEqual({ anio: 2026, mes: 5 });
    expect(anioMesDe('2026-01-01')).toEqual({ anio: 2026, mes: 1 });
    expect(anioMesDe('2026-12-31T00:00:00.000Z')).toEqual({ anio: 2026, mes: 12 });
  });

  it('un texto que no es fecha devuelve null', () => {
    expect(anioMesDe('')).toBeNull();
    expect(anioMesDe(undefined)).toBeNull();
    expect(anioMesDe('01/05/2026')).toBeNull();
  });
});

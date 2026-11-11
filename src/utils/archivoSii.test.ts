import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { esArchivoExcel, excelATextoSII } from './archivoSii';

const CABECERA = ['Nro', 'Tipo Doc', 'Tipo Venta', 'Rut cliente', 'Razon Social', 'Folio', 'Fecha Docto', 'Fecha Recepcion', 'Monto Exento', 'Monto Neto', 'Monto IVA', 'Monto total'];

// Excel armado como el que baja el SII: fechas y montos numericos.
function excel(filas: unknown[][]): ArrayBuffer {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), 'RCV');
  const bytes = XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return bytes;
}

describe('archivoSii', () => {
  it('reconoce Excel por su contenido y no confunde un CSV', () => {
    expect(esArchivoExcel(excel([CABECERA]))).toBe(true);
    expect(esArchivoExcel(new TextEncoder().encode('Nro;Tipo Doc;Folio').buffer as ArrayBuffer)).toBe(false);
  });

  it('convierte fechas y montos al mismo texto que trae el CSV del SII', async () => {
    // 46224 = 21/07/2026 (serial de Excel); folio y montos llegan como numeros.
    const texto = await excelATextoSII(excel([
      CABECERA,
      [1, 34, 'Del Giro', '76351383-1', 'SOCIEDAD DE INVERSIONES E INMOBILIARIA BOSTON LIMITADA', 3, 46224, 46224.47138888889, 15521020, 0, 0, 15521020],
    ]));
    const [cabecera, fila] = texto.split('\n');
    expect(cabecera).toBe(CABECERA.join(';'));
    expect(fila).toBe('1;34;Del Giro;76351383-1;SOCIEDAD DE INVERSIONES E INMOBILIARIA BOSTON LIMITADA;3;21/07/2026;21/07/2026;15521020;0;0;15521020');
  });

  it('un monto grande no se vuelve texto con separadores ni notacion cientifica', async () => {
    const texto = await excelATextoSII(excel([CABECERA, [1, 33, 'Del Giro', '1-9', 'X', 10, 46224, 46224, 0, 1234567890, 234567800, 1469135690]]));
    expect(texto.split('\n')[1]).toContain(';1234567890;234567800;1469135690');
  });

  it('un punto y coma dentro de un texto no parte la fila', async () => {
    const texto = await excelATextoSII(excel([CABECERA, [1, 33, 'Del Giro', '1-9', 'Comercial; Hermanos', 10, 46224, 46224, 0, 100, 19, 119]]));
    expect(texto.split('\n')[1].split(';')).toHaveLength(CABECERA.length);
  });

  it('respeta una cabecera que no esta en la primera fila', async () => {
    const texto = await excelATextoSII(excel([
      ['Registro de ventas', '', ''],
      ['RUT', '78378856-K', ''],
      CABECERA,
      [1, 33, 'Del Giro', '1-9', 'X', 10, 46224, 46224, 0, 100, 19, 119],
    ]));
    expect(texto.split('\n')[3]).toContain(';21/07/2026;');
  });
});

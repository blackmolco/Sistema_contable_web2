// Servicio de Plantillas CSV — Importación Masiva
// Solo CSV (UTF-8). Los archivos .xlsx/.xls deben guardarse como CSV primero.

import { generateId } from '../utils/calculos';
import type { Trabajador } from '../types';

export interface DatosImportados {
  tipo: 'trabajadores' | 'asientos' | 'facturas' | 'inventario' | 'plan_cuentas';
  filas: number;
  errores: string[];
  datos: Record<string, unknown>[];
  trabajadores?: Trabajador[]; // populated when tipo === 'trabajadores'
}

export interface Plantilla {
  id: string;
  nombre: string;
  descripcion: string;
  tipo: string;
  columnas: string[];
  ejemplo: Record<string, string>[];
}

export class ImportService {
  private static readonly IMPORTACIONES_KEY = 'contable_importaciones';
  private static readonly PLANTILLAS_KEY = 'contable_plantillas';

  // Plantillas predefinidas
  private static getPlantillasPredeterminadas(): Plantilla[] {
    return [
      {
        id: 'plant_trabajadores',
        nombre: 'Trabajadores',
        descripcion: 'Importar nómina de trabajadores. Use CSV UTF-8. AFP e Isapre por nombre o ID.',
        tipo: 'trabajadores',
        // Columnas exactas que mapean al store Trabajador
        columnas: ['rut', 'nombres', 'apellidos', 'email', 'fecha_ingreso', 'tipo_contrato', 'sueldo_base', 'afp', 'isapre', 'cargas_familiares'],
        ejemplo: [
          { rut: '12.345.678-5', nombres: 'Juan Andrés', apellidos: 'Pérez González', email: 'juan.perez@email.cl', fecha_ingreso: '2026-01-01', tipo_contrato: 'indefinido', sueldo_base: '800000', afp: 'AFP Hábitat', isapre: 'FONASA', cargas_familiares: '0' },
          { rut: '9.876.543-3',  nombres: 'María',       apellidos: 'López Soto',     email: 'maria.lopez@email.cl',  fecha_ingreso: '2026-03-01', tipo_contrato: 'plazo_fijo',   sueldo_base: '600000', afp: 'AFP Modelo', isapre: 'Consalud', cargas_familiares: '2' },
        ],
      },
      {
        id: 'plant_asientos',
        nombre: 'Asientos Contables',
        descripcion: 'Importar asientos contables con fecha,.glosa, cuenta y montos',
        tipo: 'asientos',
        columnas: ['fecha', 'glosa', 'cuenta_debe', 'cuenta_haber', 'monto', 'referencia', 'tipo_documento'],
        ejemplo: [
          { fecha: '01/06/2026', glosa: 'Venta factura 1234', cuenta_debe: '1101', cuenta_haber: '4101', monto: '150000', referencia: 'FAC-1234', tipo_documento: 'venta' },
        ],
      },
      {
        id: 'plant_facturas',
        nombre: 'Facturas',
        descripcion: 'Importar facturas de compra o venta',
        tipo: 'facturas',
        columnas: ['tipo', 'folio', 'rut_emisor', 'razon_social', 'fecha', 'neto', 'iva', 'exento', 'total', 'fecha_vencimiento', 'estado'],
        ejemplo: [
          { tipo: '33', folio: '1234', rut_emisor: '76.543.210-K', razon_social: 'Mi Empresa Ltda', fecha: '01/06/2026', neto: '150000', iva: '28500', exento: '0', total: '178500', fecha_vencimiento: '30/06/2026', estado: 'pendiente' },
        ],
      },
      {
        id: 'plant_inventario',
        nombre: 'Inventario',
        descripcion: 'Importar productos del inventario con precios y stock',
        tipo: 'inventario',
        columnas: ['codigo', 'nombre', 'descripcion', 'categoria', 'unidad', 'precio_costo', 'precio_venta', 'stock', 'stock_minimo', 'proveedor'],
        ejemplo: [
          { codigo: 'PROD001', nombre: 'Producto Ejemplo', descripcion: 'Descripción del producto', categoria: 'General', unidad: 'und', precio_costo: '5000', precio_venta: '8000', stock: '100', stock_minimo: '20', proveedor: 'Proveedor ABC' },
        ],
      },
      {
        id: 'plant_plan_cuentas',
        nombre: 'Plan de Cuentas',
        descripcion: 'Importar o actualizar el plan de cuentas contables',
        tipo: 'plan_cuentas',
        columnas: ['codigo', 'nombre', 'tipo', 'nivel', 'acepta_movimiento', 'categoria', 'centro_costo'],
        ejemplo: [
          { codigo: '1101', nombre: 'Caja', tipo: 'activo', nivel: 'cuenta', acepta_movimiento: 'si', categoria: 'Activo Circulante', centro_costo: 'no' },
        ],
      },
    ];
  }

  // Obtener plantillas
  static getPlantillas(): Plantilla[] {
    const stored = localStorage.getItem(this.PLANTILLAS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    const plantillas = this.getPlantillasPredeterminadas();
    localStorage.setItem(this.PLANTILLAS_KEY, JSON.stringify(plantillas));
    return plantillas;
  }

  // Generar CSV de ejemplo
  static generarCSV(plantilla: Plantilla): string {
    const headers = plantilla.columnas.join(',');
    const filas = plantilla.ejemplo.map(row =>
      plantilla.columnas.map(col => {
        const value = row[col] || '';
        // Escapar valores con comas
        return value.includes(',') ? `"${value}"` : value;
      }).join(',')
    );
    return [headers, ...filas].join('\n');
  }

  // Generar archivo Excel (como CSV para compatibilidad)
  static generarExcelCSV(plantilla: Plantilla): Blob {
    const csv = this.generarCSV(plantilla);
    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  }

  // Descargar plantilla
  static descargarPlantilla(plantillaId: string): boolean {
    const plantillas = this.getPlantillas();
    const plantilla = plantillas.find(p => p.id === plantillaId);
    if (!plantilla) return false;

    const csv = this.generarCSV(plantilla);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plantilla_${plantilla.tipo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    return true;
  }

  // Detectar separador automáticamente (coma o punto y coma)
  static detectarSeparador(primeraLinea: string): string {
    const comas      = (primeraLinea.match(/,/g)  ?? []).length;
    const puntoyComa = (primeraLinea.match(/;/g)  ?? []).length;
    const tab        = (primeraLinea.match(/\t/g) ?? []).length;
    if (tab > comas && tab > puntoyComa) return '\t';
    if (puntoyComa > comas)             return ';';
    return ',';
  }

  // Parsear CSV — auto-detecta separador (,  ;  tab), soporta comillas
  static parsearCSV(texto: string): { headers: string[]; filas: string[][] } {
    // Normalizar saltos de línea
    const lineas = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .split('\n').filter(l => l.trim());
    if (lineas.length === 0) return { headers: [], filas: [] };

    const sep = this.detectarSeparador(lineas[0]);

    const parsearLinea = (linea: string): string[] => {
      const resultado: string[] = [];
      let actual = '';
      let enComillas = false;

      for (let i = 0; i < linea.length; i++) {
        const char = linea[i];
        if (char === '"') {
          enComillas = !enComillas;
        } else if (char === sep && !enComillas) {
          resultado.push(actual.trim());
          actual = '';
        } else {
          actual += char;
        }
      }
      resultado.push(actual.trim());
      return resultado;
    };

    const headers = parsearLinea(lineas[0]);
    const filas   = lineas.slice(1).map(parsearLinea);

    return { headers, filas };
  }

  // ── Mapeo de nombres AFP/Isapre a IDs del sistema ────────────────────────────
  // Acepta: con/sin prefijo "AFP", mayúsculas, minúsculas, con/sin tilde
  private static readonly AFP_ALIAS: Record<string, string> = {
    // Capital
    'afp capital': 'afp_capital', 'capital': 'afp_capital',
    // Cuprum
    'afp cuprum': 'afp_cuprum', 'cuprum': 'afp_cuprum',
    // Hábitat
    'afp habitat': 'afp_habitat', 'habitat': 'afp_habitat',
    'afp habita':  'afp_habitat', 'habita':  'afp_habitat',
    // Modelo
    'afp modelo': 'afp_modelo', 'modelo': 'afp_modelo',
    // PlanVital
    'afp planvital':  'afp_planvital', 'planvital':  'afp_planvital',
    'afp plan vital': 'afp_planvital', 'plan vital': 'afp_planvital',
    'afp plan_vital': 'afp_planvital', 'plan_vital': 'afp_planvital',
    // ProVida
    'afp provida': 'afp_provida', 'provida': 'afp_provida',
    'afp provida.': 'afp_provida',
    // Uno
    'afp uno': 'afp_uno', 'uno': 'afp_uno',
    // Sin afiliación
    'sin afiliacion': 'afp_ninguna', 'sin afiliación': 'afp_ninguna',
    'sin afp': 'afp_ninguna', 'no cotiza': 'afp_ninguna', 'ninguna': 'afp_ninguna',
  };

  private static readonly ISAPRE_ALIAS: Record<string, string> = {
    'fonasa': 'fonasa', 'fondo nacional de salud': 'fonasa', 'fondo nacional': 'fonasa',
    'isapre colmena':     'isapre_colmena',    'colmena':     'isapre_colmena',
    'isapre cruz blanca': 'isapre_cruz_blanca','cruz blanca': 'isapre_cruz_blanca', 'cruzblanca': 'isapre_cruz_blanca',
    'isapre banmedica':   'isapre_banmedica',  'banmedica':   'isapre_banmedica',
    'isapre vida tres':   'isapre_vidaintegra','vida tres':   'isapre_vidaintegra', 'vidaintegra': 'isapre_vidaintegra',
    'isapre consalud':    'isapre_consalud',   'consalud':    'isapre_consalud',
    'isapre fundacion':   'isapre_fundacion',  'fundacion':   'isapre_fundacion',
    'isapre futuro':      'isapre_futuro',     'futuro':      'isapre_futuro',
  };

  // Quita tildes, convierte a minúsculas y recorta espacios para comparar alias
  private static limpiarParaAlias(v: string): string {
    return v.toLowerCase().trim()
      .normalize('NFD').replace(/[̀-ͯ]/g, ''); // quita tildes
  }

  static normalizarAFP(valor: string): string {
    if (!valor) return '';
    const k = this.limpiarParaAlias(valor);
    return this.AFP_ALIAS[k] ?? `afp_${k.replace(/\s+/g, '_')}`;
  }

  static normalizarIsapre(valor: string): string {
    if (!valor) return 'fonasa';
    const k = this.limpiarParaAlias(valor);
    return this.ISAPRE_ALIAS[k] ?? k.replace(/\s+/g, '_');
  }

  // ── Convertir fila CSV → Trabajador (tipo types/index.ts) ────────────────────
  // Acepta nombres de columna con variantes: mayúsculas, sin tildes, singular/plural,
  // snake_case, camelCase, separador coma o punto y coma.
  static mapearATrabajador(fila: Record<string, string>): {
    trabajador: Trabajador | null;
    errores: string[];
    advertencias: string[];
  } {
    const errores: string[] = [];
    const advertencias: string[] = [];

    // Construir mapa normalizado: clave sin tildes, minúsculas, sin _/-/espacio → valor
    const filaLimpia: Record<string, string> = {};
    for (const [k, v] of Object.entries(fila)) {
      const kLimpia = k.toLowerCase().trim()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[\s_\-]/g, '');
      filaLimpia[kLimpia] = (v ?? '').trim();
    }

    // Busca valor por múltiples claves posibles (también normalizadas)
    const get = (...claves: string[]): string => {
      for (const c of claves) {
        const cNorm = c.toLowerCase().replace(/[\s_\-]/g, '')
          .normalize('NFD').replace(/[̀-ͯ]/g, '');
        const v = filaLimpia[cNorm];
        if (v !== undefined && v !== '') return v;
      }
      return '';
    };

    // ── RUT ──────────────────────────────────────────────────────────────────
    const rut = get('rut');
    if (!rut) {
      errores.push('Campo "rut" requerido');
    } else if (!this.validarRUT(rut)) {
      errores.push(`RUT inválido: "${rut}"`);
    }

    // ── Nombre (acepta nombre/nombres — se usa el campo "nombre" del tipo) ───
    const nombre = get('nombre', 'nombres');
    if (!nombre) errores.push('Campo "nombre" requerido');

    // ── Apellidos ────────────────────────────────────────────────────────────
    const apellidos = get('apellidos', 'apellido');
    if (!apellidos) errores.push('Campo "apellidos" requerido');

    // ── Campos opcionales del CSV ────────────────────────────────────────────
    const fechaNacimiento = get('fecha_nacimiento', 'fechanacimiento', 'nacimiento') || '';
    const cargo           = get('cargo', 'puesto', 'funcion') || '';
    const departamento    = get('departamento', 'area', 'seccion') || '';

    // ── Fecha ingreso (opcional — default hoy) ───────────────────────────────
    let fechaIngreso = get('fecha_ingreso', 'fechaingreso', 'ingreso');
    if (!fechaIngreso) {
      fechaIngreso = new Date().toISOString().slice(0, 10);
      advertencias.push('fecha_ingreso vacía — se usó la fecha de hoy como default');
    } else {
      // Normalizar dd/mm/yyyy → yyyy-mm-dd
      const partes = fechaIngreso.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (partes) {
        fechaIngreso = `${partes[3]}-${partes[2].padStart(2,'0')}-${partes[1].padStart(2,'0')}`;
      }
    }

    // ── Sueldo base ──────────────────────────────────────────────────────────
    const sueldoRaw    = get('sueldo_base', 'sueldobase', 'sueldoBase', 'sueldo');
    const sueldoLimpio = sueldoRaw.replace(/\$/g, '').replace(/\./g, '').replace(',', '.').replace(/\s/g, '');
    const sueldoBase   = parseFloat(sueldoLimpio) || 0;
    if (sueldoBase < 0)  errores.push('"sueldo_base" no puede ser negativo');
    if (sueldoBase === 0) advertencias.push('"sueldo_base" es 0 — verifique el valor');

    // ── Tipo contrato → tipo de types/index.ts: 'indefinido'|'plazo'|'honorarios' ──
    type TipoContrato = 'indefinido' | 'plazo' | 'honorarios';
    const tiposValidos: TipoContrato[] = ['indefinido', 'plazo', 'honorarios'];
    const tipoRaw = get('tipo_contrato', 'tipocontrato', 'contrato').toLowerCase();
    const tipoAliases: Record<string, TipoContrato> = {
      'plazo fijo':  'plazo',
      'plazo_fijo':  'plazo',
      'plazofijo':   'plazo',
      'obra':        'plazo',    // aproximación
      'por obra':    'plazo',
      'honorario':   'honorarios',
      'honorarios':  'honorarios',
      'practica':    'honorarios',
    };
    const tipoContrato: TipoContrato =
      (tiposValidos as string[]).includes(tipoRaw) ? tipoRaw as TipoContrato
      : tipoAliases[tipoRaw] ?? 'indefinido';
    if (tipoRaw && !(tiposValidos as string[]).includes(tipoRaw) && !tipoAliases[tipoRaw]) {
      advertencias.push(`"tipo_contrato" "${tipoRaw}" no reconocido — se usó "indefinido"`);
    }

    // ── AFP → afpId ──────────────────────────────────────────────────────────
    const afpRaw    = get('afp');
    const isapreRaw = get('isapre', 'salud', 'prevision_salud');

    // ── Cargas familiares → cargaCivil ────────────────────────────────────────
    const cargasRaw  = get('cargas_familiares', 'cargasfamiliares', 'cargas');
    const cargaCivil = parseInt(cargasRaw) || 0;

    if (errores.length > 0) return { trabajador: null, errores, advertencias };

    const trabajador: Trabajador = {
      id:             generateId(),
      rut:            rut.replace(/\s/g, ''),
      nombre,
      apellidos,
      fechaNacimiento,
      cargo,
      departamento,
      fechaIngreso,
      tipoContrato,
      sueldoBase,
      colacion:       0,
      movilizacion:   0,
      bonificacion:   0,
      afpId:          this.normalizarAFP(afpRaw),
      isapreId:       this.normalizarIsapre(isapreRaw),
      pensionado:     false,
      cargaCivil,
      cargaMilitar:   0,
      estado:         'activo',
    };

    return { trabajador, errores: [], advertencias };
  }

  // ── Validar y procesar filas según el tipo ────────────────────────────────────
  private static validarDatos(tipo: string, filas: string[][], headers: string[]): {
    validos: Record<string, unknown>[];
    errores: string[];
    trabajadores?: Trabajador[];
  } {
    const validos: Record<string, unknown>[] = [];
    const errores: string[] = [];
    const trabajadores: Trabajador[] = [];

    // Columnas requeridas mínimas por tipo
    const requeridas: Record<string, string[]> = {
      trabajadores: ['rut'],
      asientos: ['fecha', 'glosa'],
      facturas: ['tipo', 'folio', 'rut_emisor', 'fecha', 'total'],
      inventario: ['codigo', 'nombre'],
      plan_cuentas: ['codigo', 'nombre', 'tipo'],
    };

    // Verificar que estén al menos las columnas mínimas (comparación flexible)
    const headersNorm = headers.map(h => h.toLowerCase().replace(/[_\-\s]/g, ''));
    for (const col of (requeridas[tipo] ?? [])) {
      const colNorm = col.toLowerCase().replace(/[_\-\s]/g, '');
      if (!headersNorm.includes(colNorm)) {
        errores.push(`Falta columna requerida: "${col}"`);
      }
    }
    if (errores.length > 0) return { validos: [], errores };

    // Campos numéricos: key normalizado sin underscore
    const camposNumericos = ['sueldobase','monto','neto','iva','total','exento',
                             'preciocosto','precioventa','stock','stockminimo'];

    filas.forEach((fila, rowIdx) => {
      if (fila.every(c => !c.trim())) return; // saltar filas vacías

      try {
        // Construir objeto con clave = header original y valor normalizado
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          const keyNorm = h.toLowerCase().replace(/[_\-\s]/g, '');
          // Convertir numéricos al parsear
          let v = (fila[i] ?? '').trim();
          if (camposNumericos.includes(keyNorm)) {
            v = String(parseFloat(v.replace(/[$.,\s]/g, '').replace(',', '.')) || 0);
          }
          obj[h] = v;
        });

        if (tipo === 'trabajadores') {
          const { trabajador, errores: errTrab } = this.mapearATrabajador(obj);
          if (errTrab.length > 0) {
            errores.push(`Fila ${rowIdx + 2}: ${errTrab.join('; ')}`);
            return;
          }
          if (trabajador) {
            trabajadores.push(trabajador);
            validos.push(obj);
          }
        } else {
          // Para otros tipos: validación genérica mínima
          if (tipo === 'facturas' && obj['rut_emisor'] && !this.validarRUT(obj['rut_emisor'])) {
            errores.push(`Fila ${rowIdx + 2}: RUT emisor inválido - ${obj['rut_emisor']}`);
            return;
          }
          validos.push(obj);
        }
      } catch {
        errores.push(`Fila ${rowIdx + 2}: Error inesperado al procesar`);
      }
    });

    return { validos, errores, trabajadores };
  }

  // Validar RUT chileno
  static validarRUT(rut: string): boolean {
    const limpio = rut.replace(/\./g, '').replace(/-/g, '');
    if (limpio.length < 8) return false;

    const numeros = limpio.slice(0, -1);
    const dv = limpio.slice(-1).toUpperCase();

    let suma = 0;
    let multiplicador = 2;

    for (let i = numeros.length - 1; i >= 0; i--) {
      suma += parseInt(numeros[i]) * multiplicador;
      multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }

    const resto = suma % 11;
    const dvCalculado = resto === 0 ? '0' : resto === 1 ? 'K' : String(11 - resto);

    return dv === dvCalculado;
  }

  // Importar datos desde archivo CSV
  static async importarArchivo(tipo: string, archivo: File): Promise<DatosImportados> {
    // Rechazar archivos Excel binarios (solo CSV soportado)
    if (archivo.name.match(/\.(xlsx|xls)$/i)) {
      return {
        tipo: tipo as DatosImportados['tipo'],
        filas: 0,
        errores: ['Los archivos Excel (.xlsx/.xls) no están soportados. Guarde el archivo como CSV UTF-8 desde Excel (Archivo → Guardar como → CSV UTF-8) e importe nuevamente.'],
        datos: [],
      };
    }

    // Intenta UTF-8; si los bytes no son UTF-8 válido reintenta con Windows-1252
    // (archivos guardados desde Excel en Chile suelen ser Windows-1252 / Latin-1)
    const leerConEncoding = (enc: string): Promise<string> =>
      new Promise((res, rej) => {
        const r = new FileReader();
        r.onload  = (e) => res(e.target?.result as string ?? '');
        r.onerror = ()  => rej(new Error('No se pudo leer el archivo.'));
        r.readAsText(archivo, enc);
      });

    const procesarTexto = (texto: string): DatosImportados => {
      const { headers, filas } = this.parsearCSV(texto);
      if (headers.length === 0) {
        return { tipo: tipo as DatosImportados['tipo'], filas: 0, errores: ['El archivo está vacío o no tiene encabezados.'], datos: [] };
      }
      const { validos, errores, trabajadores } = this.validarDatos(tipo, filas, headers);
      return { tipo: tipo as DatosImportados['tipo'], filas: validos.length, errores, datos: validos, trabajadores };
    };

    return (async () => {
      try {
        // Primer intento: UTF-8
        const textoUtf8 = await leerConEncoding('UTF-8');
        // Detectar si hay caracteres de reemplazo (U+FFFD) típicos de Latin-1 leído como UTF-8
        if (textoUtf8.includes('�')) {
          // Reintentar con Windows-1252
          const textoLatin = await leerConEncoding('windows-1252');
          return procesarTexto(textoLatin);
        }
        return procesarTexto(textoUtf8);
      } catch (err) {
        return {
          tipo: tipo as DatosImportados['tipo'],
          filas: 0,
          errores: [err instanceof Error ? err.message : 'Error al leer el archivo.'],
          datos: [],
        };
      }
    })();
  }

  // Guardar historial de importaciones
  static guardarImportacion(importacion: DatosImportados): void {
    const historial = this.getHistorial();
    historial.unshift({
      id: generateId(),
      fecha: new Date(),
      ...importacion,
    });

    if (historial.length > 20) {
      historial.splice(20);
    }

    localStorage.setItem(this.IMPORTACIONES_KEY, JSON.stringify(historial));
  }

  // Obtener historial de importaciones
  static getHistorial(): (DatosImportados & { id: string; fecha: Date })[] {
    const stored = localStorage.getItem(this.IMPORTACIONES_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  }

  // Exportar plantillas para backup
  static exportarPlantillas(): string {
    return JSON.stringify(this.getPlantillas());
  }

  // Importar plantillas desde backup
  static importarPlantillas(json: string): boolean {
    try {
      const plantillas = JSON.parse(json);
      localStorage.setItem(this.PLANTILLAS_KEY, JSON.stringify(plantillas));
      return true;
    } catch {
      return false;
    }
  }
}

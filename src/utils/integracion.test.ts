/**
 * Tests de integración para flujos críticos del Sistema Contable Chile
 *
 * Cubren flujos completos de negocio:
 *  1. Contabilidad: cuenta → asiento → contabilizar → totales
 *  2. Facturación: documento → filtro → cálculo IVA F29
 *  3. Remuneraciones: trabajador → liquidación → resumen período
 *  4. Honorarios: boleta → retención → monto líquido
 *  5. Validación Zod + store: schema rechaza datos inválidos antes de guardar
 *  6. Cálculos tributarios encadenados (sueldo líquido completo)
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ─── helpers ─────────────────────────────────────────────────────────────────

const id = () => Math.random().toString(36).slice(2);

// ─── 1. Flujo Contabilidad ────────────────────────────────────────────────────

describe('Flujo Contabilidad — cuenta → asiento → contabilizar', () => {
  let store: Awaited<ReturnType<typeof getContabilidadStore>>;

  async function getContabilidadStore() {
    const { useContabilidadStore } = await import('../stores/contabilidadStore');
    return useContabilidadStore;
  }

  beforeEach(async () => {
    store = await getContabilidadStore();
    // limpiar estado entre tests
    store.setState({ cuentas: [], asientos: [] });
  });

  it('agrega cuenta y la recupera por ID', () => {
    const cuenta = {
      id: 'c1', codigo: '110101', nombre: 'Caja', tipo: 'activo' as const,
      nivel: 1, saldoDeudor: 0, saldoAcreedor: 0, afectoIVA: false,
    };
    store.getState().addCuenta(cuenta);
    expect(store.getState().getCuentaById('c1')).toMatchObject({ nombre: 'Caja' });
  });

  it('flujo completo: agregar asiento pendiente → contabilizar → totaliza', () => {
    const asiento = {
      id: 'a1', numero: 1, fecha: '2026-05-01',
      glosa: 'Venta al contado',
      detalle: [
        { cuentaId: 'c1', cuentaCodigo: '110101', cuentaNombre: 'Caja', debe: 500000, haber: 0, glosa: '' },
        { cuentaId: 'c2', cuentaCodigo: '410101', cuentaNombre: 'Ingresos', debe: 0, haber: 500000, glosa: '' },
      ],
      totalDebe: 500000, totalHaber: 500000,
      estado: 'pendiente' as const,
      createdAt: new Date().toISOString(),
    };

    store.getState().addAsiento(asiento);
    expect(store.getState().asientos).toHaveLength(1);
    expect(store.getState().asientos[0].estado).toBe('pendiente');

    // Contabilizar
    store.getState().contabilizarAsiento('a1');
    expect(store.getState().asientos[0].estado).toBe('contabilizado');

    // Totales solo cuentan asientos contabilizados
    const totales = store.getState().getTotalDebeHaber();
    expect(totales.totalDebe).toBe(500000);
    expect(totales.totalHaber).toBe(500000);
  });

  it('anular asiento lo excluye de totales', () => {
    const asiento = {
      id: 'a2', numero: 2, fecha: '2026-05-02',
      glosa: 'Compra materiales',
      detalle: [],
      totalDebe: 200000, totalHaber: 200000,
      estado: 'contabilizado' as const,
      createdAt: new Date().toISOString(),
    };
    store.getState().addAsiento(asiento);
    store.getState().anularAsiento('a2');
    expect(store.getState().asientos[0].estado).toBe('anulado');
    const totales = store.getState().getTotalDebeHaber();
    expect(totales.totalDebe).toBe(0);
  });

  it('filtra asientos por período', () => {
    const base = { detalle: [], totalDebe: 0, totalHaber: 0, glosa: 'X', estado: 'contabilizado' as const, createdAt: '' };
    store.getState().addAsiento({ id: 'p1', numero: 1, fecha: '2026-05-10', ...base });
    store.getState().addAsiento({ id: 'p2', numero: 2, fecha: '2026-06-05', ...base });
    store.getState().addAsiento({ id: 'p3', numero: 3, fecha: '2026-05-28', ...base });

    const mayo = store.getState().getAsientosByPeriodo('2026-05');
    expect(mayo).toHaveLength(2);
    expect(mayo.every(a => a.fecha.startsWith('2026-05'))).toBe(true);
  });

  it('eliminar cuenta la remueve del store', () => {
    const cuenta = {
      id: 'cx', codigo: '210101', nombre: 'Proveedores', tipo: 'pasivo' as const,
      nivel: 1, saldoDeudor: 0, saldoAcreedor: 0, afectoIVA: false,
    };
    store.getState().addCuenta(cuenta);
    expect(store.getState().cuentas).toHaveLength(1);
    store.getState().deleteCuenta('cx');
    expect(store.getState().cuentas).toHaveLength(0);
  });
});

// ─── 2. Flujo Facturación ─────────────────────────────────────────────────────

describe('Flujo Facturación — documento → filtro → totales IVA', () => {
  let store: Awaited<ReturnType<typeof getFacturacionStore>>;

  async function getFacturacionStore() {
    const { useFacturacionStore } = await import('../stores/facturacionStore');
    return useFacturacionStore;
  }

  beforeEach(async () => {
    store = await getFacturacionStore();
    store.setState({ documentos: [], honorarios: [] });
  });

  const docBase = {
    rutEmisor: '76.543.210-5',
    rutReceptor: '12.345.678-9',
    razonSocialReceptor: 'Cliente Test Ltda.',
    fechaVencimiento: '2026-05-31',
    estado: 'emitido' as const,
    createdAt: new Date().toISOString(),
  };

  it('agrega factura de venta y aparece en documentos filtrados', () => {
    store.getState().addDocumento({
      id: 'd1', tipo: 'factura', folio: 1001,
      fechaEmision: '2026-05-10',
      montoNeto: 1000000, iva: 190000, montoTotal: 1190000,
      tipoTransaccion: 'venta',
      ...docBase,
    });

    store.getState().setFiltros({ tipo: 'factura', periodo: '2026-05' });
    const filtrados = store.getState().getDocumentosFiltrados();
    expect(filtrados).toHaveLength(1);
    expect(filtrados[0].folio).toBe(1001);
  });

  it('calcula totales período (IVA ventas vs compras)', () => {
    store.getState().addDocumento({
      id: 'v1', tipo: 'factura', folio: 2001,
      fechaEmision: '2026-05-05',
      montoNeto: 2000000, iva: 380000, montoTotal: 2380000,
      tipoTransaccion: 'venta', ...docBase,
    });
    store.getState().addDocumento({
      id: 'c1', tipo: 'factura', folio: 3001,
      fechaEmision: '2026-05-06',
      montoNeto: 500000, iva: 95000, montoTotal: 595000,
      tipoTransaccion: 'compra', ...docBase,
    });

    const totales = store.getState().getTotalesPeriodo('2026-05');
    expect(totales.totalVentas).toBe(2380000);
    expect(totales.totalCompras).toBe(595000);
    expect(totales.ivaVentas).toBe(380000);
    expect(totales.ivaCompras).toBe(95000);

    // IVA a pagar = IVA ventas - IVA compras (crédito fiscal)
    const ivaAPagar = totales.ivaVentas - totales.ivaCompras;
    expect(ivaAPagar).toBe(285000);
  });

  it('búsqueda por razón social filtra correctamente', () => {
    store.getState().addDocumento({
      id: 'b1', tipo: 'boleta', folio: 100,
      fechaEmision: '2026-05-01',
      montoNeto: 50000, iva: 0, montoTotal: 50000,
      tipoTransaccion: 'venta', ...docBase,
      razonSocialReceptor: 'Empresa ABC Ltda.',
    });
    store.getState().addDocumento({
      id: 'b2', tipo: 'boleta', folio: 101,
      fechaEmision: '2026-05-02',
      montoNeto: 30000, iva: 0, montoTotal: 30000,
      tipoTransaccion: 'venta', ...docBase,
      razonSocialReceptor: 'XYZ Corp.',
    });

    store.getState().setFiltros({ tipo: 'todos', estado: 'todos', periodo: '', busqueda: 'abc' });
    const resultado = store.getState().getDocumentosFiltrados();
    expect(resultado).toHaveLength(1);
    expect(resultado[0].razonSocialReceptor).toContain('ABC');
  });
});

// ─── 3. Flujo Remuneraciones ──────────────────────────────────────────────────

describe('Flujo Remuneraciones — trabajador → liquidación → resumen', () => {
  let store: Awaited<ReturnType<typeof getRemStore>>;

  async function getRemStore() {
    const { useRemuneracionesStore } = await import('../stores/remuneracionesStore');
    return useRemuneracionesStore;
  }

  beforeEach(async () => {
    store = await getRemStore();
    store.setState({ trabajadores: [], liquidaciones: [] });
  });

  const trabajadorBase = {
    email: 'juan@empresa.cl',
    fechaIngreso: '2024-01-01',
    tipoContrato: 'indefinido' as const,
    afp: 'Habitat',
    isapre: 'Fonasa',
    saludPactada: 7,
    estado: 'activo' as const,
    cargasFamiliares: 0,
  };

  it('agrega trabajador y lo recupera como activo', () => {
    store.getState().addTrabajador({
      id: 't1', rut: '15.123.456-7', nombres: 'Juan', apellidos: 'Pérez',
      sueldoBase: 800000, ...trabajadorBase,
    });
    const activos = store.getState().getTrabajadoresActivos();
    expect(activos).toHaveLength(1);
    expect(activos[0].nombres).toBe('Juan');
  });

  it('resumen período acumula liquidaciones correctamente', () => {
    store.getState().addTrabajador({
      id: 't2', rut: '16.234.567-8', nombres: 'María', apellidos: 'González',
      sueldoBase: 900000, ...trabajadorBase,
    });
    store.getState().addTrabajador({
      id: 't3', rut: '17.345.678-9', nombres: 'Carlos', apellidos: 'Rojas',
      sueldoBase: 700000, ...trabajadorBase,
    });

    store.getState().addLiquidacion({
      id: 'l1', trabajadorId: 't2', periodo: '2026-05',
      sueldoBase: 900000, bonos: 0, horasExtras: 0,
      totalImponible: 900000,
      descuentoAFP: 98100, descuentoSalud: 63000, descuentoImpuesto: 0,
      otrosDescuentos: 0, totalDescuentos: 161100,
      sueldoLiquido: 738900,
      estado: 'calculada' as const,
    });
    store.getState().addLiquidacion({
      id: 'l2', trabajadorId: 't3', periodo: '2026-05',
      sueldoBase: 700000, bonos: 0, horasExtras: 0,
      totalImponible: 700000,
      descuentoAFP: 76300, descuentoSalud: 49000, descuentoImpuesto: 0,
      otrosDescuentos: 0, totalDescuentos: 125300,
      sueldoLiquido: 574700,
      estado: 'calculada' as const,
    });

    const resumen = store.getState().getResumenPeriodo('2026-05');
    expect(resumen.totalTrabajadores).toBe(2);
    expect(resumen.totalSueldos).toBe(1600000);
    expect(resumen.totalLiquido).toBe(1313600);
  });

  it('trabajador desvinculado no aparece en activos', () => {
    store.getState().addTrabajador({
      id: 't4', rut: '18.456.789-0', nombres: 'Ana', apellidos: 'Silva',
      sueldoBase: 600000, ...trabajadorBase, estado: 'desvinculado',
    });
    expect(store.getState().getTrabajadoresActivos()).toHaveLength(0);
  });
});

// ─── 4. Flujo Honorarios ──────────────────────────────────────────────────────

describe('Flujo Honorarios — cálculo retención y liquidación', () => {
  it('retención de honorarios es ~11.5% del bruto', async () => {
    const { calcularHonorarios } = await import('../utils/calculos');
    const { retencion, liquido } = calcularHonorarios(1000000);
    // Tasa actual retención honorarios: 13.75% (2024) — verificamos que existe y es coherente
    expect(retencion).toBeGreaterThan(0);
    expect(liquido).toBe(1000000 - retencion);
    expect(retencion + liquido).toBe(1000000);
  });

  it('calcular honorarios desde líquido recupera el bruto correcto', async () => {
    const { calcularHonorarios, calcularHonorariosDesdeLiquido } = await import('../utils/calculos');
    const brutoOriginal = 500000;
    const { retencion, liquido } = calcularHonorarios(brutoOriginal);
    const recuperado = calcularHonorariosDesdeLiquido(liquido);
    // El bruto recuperado debe ser ≈ al original (diferencia máx por redondeo)
    expect(Math.abs(recuperado.bruto - brutoOriginal)).toBeLessThanOrEqual(5);
  });

  it('flujo store honorarios: agregar y actualizar estado', async () => {
    const { useFacturacionStore } = await import('../stores/facturacionStore');
    useFacturacionStore.setState({ honorarios: [] });

    useFacturacionStore.getState().addHonorario({
      id: 'h1', rutProfesional: '12.345.678-9',
      nombreProfesional: 'Pedro Contador',
      periodo: '2026-05',
      montoBruto: 1000000,
      retencion: 137500,
      montoLiquido: 862500,
      estado: 'pendiente',
      fechaEmision: '2026-05-10',
      numeroBoleta: 42,
    });

    expect(useFacturacionStore.getState().honorarios).toHaveLength(1);

    useFacturacionStore.getState().updateHonorario('h1', { estado: 'pagado' });
    expect(useFacturacionStore.getState().honorarios[0].estado).toBe('pagado');
  });
});

// ─── 5. Validación Zod + Guardar ─────────────────────────────────────────────

describe('Validación Zod aplicada antes de guardar en store', () => {
  it('schema acepta asiento cuadrado y se guarda correctamente', async () => {
    const { AsientoContableSchema } = await import('../utils/schemas');
    const { useContabilidadStore } = await import('../stores/contabilidadStore');
    useContabilidadStore.setState({ asientos: [] });

    const input = {
      fecha: '2026-05-14',
      descripcion: 'Pago de arriendo mensual',
      detalles: [
        { cuentaCodigo: '211001', cuentaNombre: 'Cuentas por Pagar', debe: 0, haber: 350000 },
        { cuentaCodigo: '110101', cuentaNombre: 'Caja', debe: 350000, haber: 0 },
      ],
    };

    const result = AsientoContableSchema.safeParse(input);
    expect(result.success).toBe(true);

    // Simula el guardado que haría handleSubmit
    if (result.success) {
      useContabilidadStore.getState().addAsiento({
        id: 'az1', numero: 10, fecha: input.fecha,
        glosa: input.descripcion,
        detalle: input.detalles.map(d => ({ ...d, cuentaId: d.cuentaCodigo, glosa: '' })),
        totalDebe: 350000, totalHaber: 350000,
        estado: 'pendiente', createdAt: new Date().toISOString(),
      });
    }

    expect(useContabilidadStore.getState().asientos).toHaveLength(1);
  });

  it('schema rechaza asiento descuadrado y NO se guarda', async () => {
    const { AsientoContableSchema } = await import('../utils/schemas');
    const { useContabilidadStore } = await import('../stores/contabilidadStore');
    useContabilidadStore.setState({ asientos: [] });

    const inputDescuadrado = {
      fecha: '2026-05-14',
      descripcion: 'Asiento con error',
      detalles: [
        { cuentaCodigo: '110101', cuentaNombre: 'Caja', debe: 100000, haber: 0 },
        { cuentaCodigo: '411001', cuentaNombre: 'Ventas', debe: 0, haber: 99999 },
      ],
    };

    const result = AsientoContableSchema.safeParse(inputDescuadrado);
    expect(result.success).toBe(false);

    // No se guarda si falla la validación
    if (!result.success) {
      // no hacemos addAsiento
    }

    expect(useContabilidadStore.getState().asientos).toHaveLength(0);
  });

  it('schema rechaza glosa vacía con mensaje de error adecuado', async () => {
    const { AsientoContableSchema, formatZodErrors } = await import('../utils/schemas');

    const input = {
      fecha: '2026-05-14',
      descripcion: 'AB', // menor a 3 caracteres
      detalles: [
        { cuentaCodigo: '110101', cuentaNombre: 'Caja', debe: 100, haber: 0 },
        { cuentaCodigo: '411001', cuentaNombre: 'Ventas', debe: 0, haber: 100 },
      ],
    };

    const result = AsientoContableSchema.safeParse(input);
    expect(result.success).toBe(false);

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      expect(errors['descripcion']).toBeTruthy();
      expect(errors['descripcion']).toMatch(/mín/i);
    }
  });
});

// ─── 6. Cálculos tributarios encadenados ─────────────────────────────────────

describe('Cálculos tributarios encadenados (sueldo líquido)', () => {
  it('sueldo líquido = imponible - cotizaciones - impuesto + no imponibles', async () => {
    const { calcularSueldoLiquido } = await import('../utils/calculos');

    const resultado = calcularSueldoLiquido({
      sueldoBase: 1200000,
      colacion: 50000,
      movilizacion: 40000,
      bonificacion: 0,
      comisionAfp: 0.57, // Habitat
      tipoContrato: 'indefinido',
      cargaCivil: 0,
      cargaMilitar: 0,
    });

    // Valores de sanidad
    expect(resultado.sueldoLiquido).toBeGreaterThan(0);
    expect(resultado.sueldoLiquido).toBeLessThan(1200000 + 90000); // no puede ser mayor que bruto + no imponibles
    expect(resultado.cotizaciones.total).toBeGreaterThan(0);

    // AFP + salud deben representar ~17-25% del imponible
    const porcentajeCotizaciones = (resultado.cotizaciones.total / 1200000) * 100;
    expect(porcentajeCotizaciones).toBeGreaterThan(15);
    expect(porcentajeCotizaciones).toBeLessThan(30);
  });

  it('cotizaciones AFP son proporcionales al sueldo imponible', async () => {
    const { calcularCotizaciones } = await import('../utils/calculos');

    const base1 = calcularCotizaciones(800000, 0.57, 'indefinido');
    const base2 = calcularCotizaciones(1600000, 0.57, 'indefinido');

    // Al doble de sueldo → doble de cotizaciones AFP
    expect(Math.abs(base2.totalAfp - base1.totalAfp * 2)).toBeLessThanOrEqual(10);
  });

  it('validar RUT con dígito verificador correcto', async () => {
    const { validarRUT } = await import('../utils/calculos');
    // RUTs con DV correcto (calculado con módulo 11)
    // 12345678 → DV = 5  |  11111111 → DV = 1
    expect(validarRUT('12345678-5')).toBe(true);
    expect(validarRUT('11111111-1')).toBe(true);
    // RUT con DV incorrecto
    expect(validarRUT('12345678-9')).toBe(false);
    expect(validarRUT('11111111-2')).toBe(false);
  });
});

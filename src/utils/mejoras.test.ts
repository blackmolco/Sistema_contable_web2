import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

// Schemas para tests
const HonorarioSchema = z.object({
  rut: z.string().regex(/^\d{1,8}-[\dkK]$/),
  monto: z.number().positive(),
});

const AsientoSchema = z.object({
  glosa: z.string().min(5),
  detalle: z.array(z.object({ debe: z.number(), haber: z.number() })),
}).refine(d => {
  const td = d.detalle.reduce((s, l) => s + l.debe, 0);
  const th = d.detalle.reduce((s, l) => s + l.haber, 0);
  return Math.abs(td - th) < 0.01;
}, 'No cuadrado');

describe('HonorarioSchema', () => {
  it('valida RUT correcto', () => {
    expect(() => HonorarioSchema.parse({ rut: '12345678-5', monto: 500000 })).not.toThrow();
  });
  it('rechaza RUT inválido', () => {
    // '12345678-X' — X no es dígito ni k/K, por lo que debe fallar
    expect(() => HonorarioSchema.parse({ rut: '12345678-X', monto: 500000 })).toThrow();
    // sin dígito verificador
    expect(() => HonorarioSchema.parse({ rut: '12345678', monto: 500000 })).toThrow();
  });
  it('rechaza monto negativo', () => {
    expect(() => HonorarioSchema.parse({ rut: '12345678-5', monto: -100 })).toThrow();
  });
});

describe('AsientoSchema', () => {
  it('valida asiento cuadrado', () => {
    expect(() => AsientoSchema.parse({
      glosa: 'Compra de materiales',
      detalle: [
        { debe: 100000, haber: 0 },
        { debe: 0, haber: 100000 },
      ]
    })).not.toThrow();
  });
  it('rechaza asiento descuadrado', () => {
    expect(() => AsientoSchema.parse({
      glosa: 'Compra de materiales',
      detalle: [
        { debe: 100000, haber: 0 },
        { debe: 0, haber: 50000 },
      ]
    })).toThrow();
  });
  it('rechaza glosa corta', () => {
    expect(() => AsientoSchema.parse({
      glosa: 'ABC',
      detalle: [
        { debe: 100, haber: 0 },
        { debe: 0, haber: 100 },
      ]
    })).toThrow();
  });
});

// Zustand store tests
describe('ContabilidadStore', () => {
  it('debería actualizar periodo', async () => {
    const { useContabilidadStore } = await import('../stores/contabilidadStore');
    useContabilidadStore.getState().setPeriodo('2026-01');
    expect(useContabilidadStore.getState().periodoActual).toBe('2026-01');
  });

  it('debería agregar y eliminar cuentas', async () => {
    const { useContabilidadStore } = await import('../stores/contabilidadStore');
    const cuenta = { id: '1', codigo: '110101', nombre: 'Caja', tipo: 'activo' as const, nivel: 1, saldoDeudor: 0, saldoAcreedor: 0, afectoIVA: false };
    useContabilidadStore.getState().addCuenta(cuenta);
    expect(useContabilidadStore.getState().cuentas).toHaveLength(1);
    useContabilidadStore.getState().deleteCuenta('1');
    expect(useContabilidadStore.getState().cuentas).toHaveLength(0);
  });
});

describe('AuthStore', () => {
  it('debería iniciar con estado no autenticado', async () => {
    const { useAuthStore } = await import('../stores/authStore');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('debería hacer logout correctamente', async () => {
    const { useAuthStore } = await import('../stores/authStore');
    useAuthStore.getState().setUser({ id: '1', nombre: 'Test', email: 'test@test.cl', rut: '1-9', rol: 'admin', empresaId: 'e1' });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

// Calcs tests
describe('Calculos tributarios', () => {
  it('debería calcular retención de honorarios correctamente', async () => {
    const { calcularImpuestoMensual } = await import('../utils/calculos');
    const monto = 1000000;
    const impuesto = calcularImpuestoMensual(monto);
    expect(impuesto).toBeGreaterThan(0);
  });

  it('debería identificar tramos correctos del impuesto único', async () => {
    const { ESCALA_IMPUESTO_UNICO } = await import('../data/normativa');
    expect(ESCALA_IMPUESTO_UNICO).toBeDefined();
    const tramoAlto = ESCALA_IMPUESTO_UNICO.find(t => t.desde > 5000000);
    expect(tramoAlto?.factor).toBeGreaterThan(0.2);
  });
});

describe('AppStore Empresas', () => {
  it('debería agregar empresa via store', async () => {
    const { useAppStore } = await import('../stores/appStore');
    const store = useAppStore.getState();
    const emp = store.addEmpresa({
      rut: '76.543.210-5',
      razonSocial: 'Empresa Test Ltda',
      nombreFantasia: 'Test',
      giro: 'Servicios',
      direccion: '',
      comuna: '',
      ciudad: '',
      email: '',
      telefono: '',
      activa: true,
    });
    expect(emp.rut).toBe('76.543.210-5');
    expect(emp.activa).toBe(true);
    store.deleteEmpresa(emp.id);
  });
});

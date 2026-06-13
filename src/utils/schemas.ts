import { z } from 'zod';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const rutRegex = /^(\d{1,2}\.\d{3}\.\d{3}|\d{7,8})-[\dkK]$/;
const montoPositivo = z.number({ invalid_type_error: 'Debe ser un número' }).positive('Debe ser mayor a 0');
const montoNoNegativo = z.number({ invalid_type_error: 'Debe ser un número' }).min(0, 'No puede ser negativo');

// ─── Trabajador / Remuneraciones ─────────────────────────────────────────────

export const TrabajadorSchema = z.object({
  nombre:       z.string().min(2, 'Nombre requerido (mín. 2 caracteres)'),
  apellidos:    z.string().min(2, 'Apellidos requeridos (mín. 2 caracteres)'),
  rut:          z.string().regex(rutRegex, 'RUT inválido. Formato: 12.345.678-9'),
  cargo:        z.string().optional().default(''),        // opcional — puede venir vacío del CSV
  departamento: z.string().optional().default(''),        // opcional
  fechaIngreso: z.string().optional().default(''),        // opcional — se defaultea a hoy al importar
  sueldoBase:   montoNoNegativo,                          // permite 0 (Karen y otros sin sueldo definido)
  afp:          z.string().optional().default(''),        // opcional — puede estar sin AFP
  salud:        z.enum(['fonasa', 'isapre'], { errorMap: () => ({ message: 'Seleccione Fonasa o Isapre' }) }),
  contrato:     z.enum(['indefinido', 'plazo', 'honorarios'], {  // 'plazo' (no 'plazo_fijo') — coincide con TipoContrato
    errorMap: () => ({ message: 'Tipo de contrato inválido' }),
  }),
});

export type TrabajadorInput = z.infer<typeof TrabajadorSchema>;

// ─── Documento Tributario ─────────────────────────────────────────────────────

export const DocumentoTributarioSchema = z.object({
  tipo: z.enum(['factura', 'boleta', 'nota_credito', 'nota_debito', 'guia_despacho'], {
    errorMap: () => ({ message: 'Tipo de documento inválido' }),
  }),
  numero: z.number({ invalid_type_error: 'Número requerido' }).int().positive('Número debe ser positivo'),
  fecha: z.string().min(1, 'Fecha requerida'),
  rutReceptor: z.string().regex(rutRegex, 'RUT receptor inválido'),
  razonSocialReceptor: z.string().min(2, 'Razón social requerida'),
  subtotal: montoPositivo,
  iva: montoNoNegativo,
  total: montoPositivo,
});

export type DocumentoTributarioInput = z.infer<typeof DocumentoTributarioSchema>;

// ─── Honorario ───────────────────────────────────────────────────────────────

export const HonorarioSchema = z.object({
  nombre: z.string().min(2, 'Nombre requerido'),
  apellidos: z.string().min(2, 'Apellidos requeridos'),
  rut: z.string().regex(rutRegex, 'RUT inválido'),
  servicio: z.string().min(3, 'Descripción del servicio requerida'),
  montoHonorario: montoPositivo,
  fecha: z.string().min(1, 'Fecha requerida'),
});

export type HonorarioInput = z.infer<typeof HonorarioSchema>;

// ─── Asiento Contable ─────────────────────────────────────────────────────────

export const DetalleAsientoSchema = z.object({
  cuentaCodigo: z.string().min(1, 'Código de cuenta requerido'),
  cuentaNombre: z.string().min(1, 'Nombre de cuenta requerido'),
  debe: montoNoNegativo,
  haber: montoNoNegativo,
  descripcion: z.string().optional(),
});

export const AsientoContableSchema = z.object({
  fecha: z.string().min(1, 'Fecha requerida'),
  descripcion: z.string().min(3, 'Descripción requerida (mín. 3 caracteres)'),
  detalles: z.array(DetalleAsientoSchema).min(2, 'Se requieren al menos 2 líneas'),
}).refine((data) => {
  const totalDebe = data.detalles.reduce((s, d) => s + d.debe, 0);
  const totalHaber = data.detalles.reduce((s, d) => s + d.haber, 0);
  return Math.abs(totalDebe - totalHaber) < 0.01;
}, { message: 'El asiento no está cuadrado: Debe = Haber' });

export type AsientoContableInput = z.infer<typeof AsientoContableSchema>;

// ─── Cuenta Contable ──────────────────────────────────────────────────────────

export const CuentaSchema = z.object({
  codigo: z.string().min(1, 'Código requerido').max(10, 'Código muy largo'),
  nombre: z.string().min(2, 'Nombre requerido (mín. 2 caracteres)'),
  tipo: z.enum(['activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto', 'costo'], {
    errorMap: () => ({ message: 'Tipo de cuenta inválido' }),
  }),
  nivel: z.number().int().min(1).max(4),
});

export type CuentaInput = z.infer<typeof CuentaSchema>;

// ─── Helper: formatear errores Zod ───────────────────────────────────────────

export function formatZodErrors(error: z.ZodError): Record<string, string> {
  return error.issues.reduce((acc, issue) => {
    const key = issue.path.join('.');
    if (!acc[key]) acc[key] = issue.message;
    return acc;
  }, {} as Record<string, string>);
}

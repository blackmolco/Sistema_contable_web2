import { z } from 'zod';

export const HonorarioSchema = z.object({
  rut: z.string().regex(/^\d{1,8}-[\dkK]$/, 'RUT inválido'),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, 'Período debe ser YYYY-MM'),
  monto: z.number().positive('Monto debe ser positivo'),
});

export const EmpresaSchema = z.object({
  rut: z.string().regex(/^\d{1,8}-[\dkK]$/, 'RUT inválido'),
  razonSocial: z.string().min(3, 'Razón social muy corta'),
  giro: z.string().min(3, 'Giro muy corto'),
});

export const AsientoSchema = z.object({
  fecha: z.string().min(1, 'Fecha requerida'),
  glosa: z.string().min(5, 'Glosa muy corta'),
  detalle: z.array(z.object({
    cuentaId: z.string().min(1),
    debe: z.number().min(0),
    haber: z.number().min(0),
  })).min(2, 'Mínimo 2 líneas'),
}).refine(d => {
  const totalDebe = d.detalle.reduce((s, l) => s + l.debe, 0);
  const totalHaber = d.detalle.reduce((s, l) => s + l.haber, 0);
  return Math.abs(totalDebe - totalHaber) < 0.01;
}, 'El asiento no está cuadrado (Debe ≠ Haber)');

export const TrabajadorSchema = z.object({
  rut: z.string().regex(/^\d{1,8}-[\dkK]$/, 'RUT inválido'),
  nombres: z.string().min(3, 'Nombre muy corto'),
  sueldoBase: z.number().positive('Sueldo debe ser positivo'),
  afp: z.string().min(1, 'Seleccione AFP'),
});

export const formatZodErrors = (error: z.ZodError): string => {
  return error.errors.map(e => `• ${e.path.join('.')}: ${e.message}`).join('\n');
};

// Nuevos schemas para módulos mejorados
export const DteSchema = z.object({
  tipo: z.enum(['factura', 'boleta', 'nota_credito', 'nota_debito']),
  rutReceptor: z.string().regex(/^\d{1,8}-[\dkK]$/, 'RUT inválido'),
  montoNeto: z.number().positive(),
  montoExento: z.number().min(0).default(0),
});

export const PwaConfigSchema = z.object({
  nombre: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  descripcion: z.string().optional(),
});

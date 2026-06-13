// Tipos para el Sistema Contable Chileno

// ============ Plan de Cuentas ============
export type TipoCuenta = 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'gasto';
export type NaturalezaCuenta = 'deudora' | 'acreedora';

export interface Cuenta {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoCuenta;
  naturaleza: NaturalezaCuenta;
  permiteMovimiento: boolean;
  nivel: number;
  padreId?: string;
  descripcion?: string;
  refSII?: string;
}

// ============ Asientos Contables ============
export interface DetalleAsiento {
  id?: string;
  cuentaId: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  debe: number;
  haber: number;
}

export interface AsientoContable {
  id: string;
  fecha: string;
  numero: number;
  glosa: string;
  detalles: DetalleAsiento[];
  totalDebe: number;
  totalHaber: number;
  estado: 'pendiente' | 'aprobado' | 'anulado';
  tipo?: string;
}

// ============ Remuneraciones ============
export type TipoContrato = 'indefinido' | 'plazo' | 'honorarios';

export interface AFP {
  id: string;
  nombre: string;
  comisionMensual: number;
  comisionVariable: number;
}

export interface ISAPRE {
  id: string;
  nombre: string;
  tipo: 'abierta' | 'cerrada';
  tasa: number;
}

export type EstadoTrabajador =
  | 'activo'
  | 'finiquitado'
  | 'licencia'
  | 'permiso_sin_goce';

export interface Trabajador {
  id: string;
  rut: string;
  nombre: string;
  apellidos: string;
  fechaNacimiento: string;
  cargo: string;
  departamento: string;
  fechaIngreso: string;
  tipoContrato: TipoContrato;
  sueldoBase: number;
  colacion: number;
  movilizacion: number;
  bonificacion: number;
  afpId: string;
  isapreId: string;
  pensionado: boolean;
  cargaCivil: number;
  cargaMilitar: number;
  anticipos?: number;
  estado?: EstadoTrabajador;
  fechaTermino?: string;
  horasSemanales?: number;
}

export interface LiquidoCalculado {
  sueldoBruto: number;
  totalHaberes: number;
  afp: {
    ahorro: number;
    sis: number;
    comision: number;
    total: number;
  };
  salud: {
    cotizacion: number;
    total: number;
  };
  afc: number;
  totalCotizaciones: number;
  sueldoImponible: number;
  impuestoUnico: number;
  otrasDeducciones: number;
  sueldoLiquido: number;
  detalleImpuesto: TramoImpuesto | null;
}

export interface ResultadoSueldoLiquido {
  sueldoBruto: number;
  totalHaberes: number;
  totalHaberesNoImponibles: number;
  imponible: number;
  gratificacion: number;      // gratificación legal calculada (Art. 47 CT)
  horasExtras?: number;       // cantidad de horas extra trabajadas
  montoHorasExtras?: number;  // monto liquidado por horas extra (imponible)
  cotizaciones: {
    afpAhorro: number;
    afpSis: number;
    afpComision: number;
    totalAfp: number;
    salud: number;
    afc: number;
    total: number;
  };
  sueldoImponible: number;
  asignacionFamiliar: number;
  impuestoUnico: number;
  detalleImpuesto: TramoImpuesto | null;
  sueldoLiquido: number;
  desglose: Array<{
    concepto: string;
    monto: number;
    tipo: 'haber' | 'descuento';
  }>;
}

export interface TramoImpuesto {
  tramo: number;
  rentaImponible: number;
  tasa: number;
  deduccion: number;
  impuestoCalculado: number;
  nombre?: string;
}

// ============ Facturación SII ============
export type TipoDocumento =
  | 'factura'
  | 'factura_compra'
  | 'factura_exenta'
  | 'boleta'
  | 'boleta_exenta'
  | 'boleta_electronica'
  | 'nota_credito'
  | 'nota_debito'
  | 'guia_despacho';

export interface Receptor {
  rut: string;
  razonSocial: string;
  giro: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  contacto: string;
  email: string;
}

export interface LineaDetalle {
  id: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidadMedida: string;
  precioUnitario: number;
  descuento: number;
  montoTotal: number;
}

export interface DocumentoTributario {
  id: string;
  tipo: TipoDocumento;
  numero: number;
  serie: string;
  fecha: string;
  receptor: Receptor;
  condicionesPago: string;
  detalles: LineaDetalle[];
  subtotal: number;
  descuentoGlobal: number;
  iva: number;
  totalExento: number;
  total: number;
  estado: 'pendiente' | 'emitido' | 'anulado' | 'congelado';
  libro?: 'ventas' | 'compras';   // origen del documento (SII sync o manual)
  libroId?: string;
  neto?: number;
  rutCliente?: string;
  razonSocialCliente?: string;
}

// ============ Libros ============
export interface RegistroLibro {
  id: string;
  fecha: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  rut: string;
  razonSocial: string;
  exento: number;
  neto: number;
  iva: number;
  total: number;
}

export interface ResumenMensual {
  mes: number;
  ano: number;
  totalNeto: number;
  totalIva: number;
  totalExento: number;
  totalGeneral: number;
  cantidadDocumentos: number;
}

// ============ Liquidaciones de Remuneraciones ============

export interface LiquidacionLinea {
  trabajadorId: string;
  rut: string;
  nombre: string;
  apellidos: string;
  cargo: string;
  tipoContrato: TipoContrato;
  afpNombre: string;
  // Haberes imponibles
  sueldoBase: number;
  horasExtras: number;
  montoHorasExtras: number;
  gratificacion: number;
  totalImponible: number;
  // Haberes no imponibles
  colacion: number;
  movilizacion: number;
  bonificacion: number;
  totalHaberes: number;
  // Descuentos trabajador
  afpAhorro: number;
  afpComision: number;
  totalAfp: number;
  salud: number;
  afc: number;
  totalCotizaciones: number;
  impuestoUnico: number;
  anticipos: number;
  totalDescuentos: number;
  sueldoLiquido: number;
  // Aportes empleador
  sisEmpleador: number;
  afcEmpleador: number;
  mutual: number;
  totalAportesEmpleador: number;
  costoTotalEmpresa: number;
  // Metadata
  diasTrabajados: number;
}

export interface LiquidacionPeriodo {
  id: string;
  periodo: string;        // 'YYYY-MM'
  fechaProceso: string;   // ISO datetime del proceso
  uf: number;
  utm: number;
  lineas: LiquidacionLinea[];
}

// ============ Honorarios ============
export interface Honorario {
  id: string;
  rut: string;
  nombre: string;
  direccion: string;
  periodo: string;
  montoBruto: number;
  retencion: number;
  montoLiquido: number;
  fechaPago: string;
  estado: 'pendiente' | 'pagado';
}

// ============ Dashboard ============
export interface KPIData {
  ventasMes: number;
  ventasVariacion: number;
  comprasMes: number;
  comprasVariacion: number;
  remuneraciones: number;
  impuestosPendientes: number;
}

export interface ChartData {
  mes: string;
  ventas: number;
  compras: number;
  gastos: number;
}

// ============ Configuración ============
export interface ConfiguracionEmpresa {
  razonSocial: string;
  nombreFantasia: string;
  rut: string;
  giro: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  telefono: string;
  email: string;
  web: string;
  logo: string;
  actividadEconomica: string;
  resoluciones: {
    factura: string;
    boleta: string;
    guia: string;
  };
  representanteLegal?: string;
  rutRepresentante?: string;
}

// ============ Estados UI ============
export interface LoadingState {
  loading: boolean;
  mensaje: string;
}

export interface ToastNotification {
  id: string;
  tipo: 'success' | 'error' | 'warning' | 'info';
  titulo: string;
  mensaje: string;
}

// ============ Gestion Documental ============
export interface Documento {
  id: string;
  nombre: string;
  tipo: string;
  categoria: string;
  empresaId?: string;
  trabajadorId?: string;
  asientoId?: string;
  ruta: string;
  tamano: number;
  mimeType: string;
  etiquetas?: string[];
  descripcion?: string;
  fechaDoc?: string;
  fechaSubida: string;
  version: number;
  activo: boolean;
}

export interface CategoriaDocumento {
  id: number;
  nombre: string;
  color: string;
  icono: string;
}

export interface FiltrosDocumentos {
  categoria?: string;
  empresaId?: string;
  trabajadorId?: string;
  asientoId?: string;
  texto?: string;
  limite?: number;
  offset?: number;
}

export interface DocumentoFallback {
  id: string;
  nombre: string;
  categoria: string;
  tipo: string;
  mimeType: string;
  tamano: number;
  empresaId?: string;
  trabajadorId?: string;
  asientoId?: string;
  etiquetas?: string[];
  descripcion?: string;
  fechaDoc?: string;
  fechaSubida: string;
  base64: string;
  version: number;
  activo: boolean;
}

export interface ArchivoVersion {
  id: string;
  documentoId: string;
  ruta: string;
  version: number;
  fecha: string;
  tamano: number;
}

// ============ Clientes y Proveedores ============
export type TipoClienteProveedor = 'cliente' | 'proveedor' | 'ambos';

export interface ClienteProveedor {
  id: string;
  tipo: TipoClienteProveedor;
  rut: string;
  razonSocial: string;
  nombreFantasia?: string;
  giro?: string;
  direccion?: string;
  comuna?: string;
  ciudad?: string;
  telefono?: string;
  email?: string;
  condicionPago: number; // días: 0=contado, 30, 60, 90
  notas?: string;
  activo: boolean;
  fechaCreacion: string;
}

// ============ Cuentas por Cobrar ============
export type EstadoCxC = 'pendiente' | 'parcial' | 'pagado' | 'vencido' | 'incobrable';

export interface PagoCxC {
  id: string;
  fecha: string;
  monto: number;
  formaPago: 'transferencia' | 'cheque' | 'efectivo' | 'otro';
  referencia?: string;
}

export interface CuentaCobrar {
  id: string;
  clienteId: string;
  clienteRut: string;
  clienteNombre: string;
  tipoDocumento: string;
  numeroDocumento: string;
  fecha: string;
  fechaVencimiento: string;
  monto: number;
  montoPagado: number;
  estado: EstadoCxC;
  pagos: PagoCxC[];
  notas?: string;
}

// ============ Cuentas por Pagar ============
export type EstadoCxP = 'pendiente' | 'parcial' | 'pagado' | 'vencido';

export interface PagoCxP {
  id: string;
  fecha: string;
  monto: number;
  formaPago: 'transferencia' | 'cheque' | 'efectivo' | 'otro';
  banco?: string;
  referencia?: string;
}

export interface CuentaPagar {
  id: string;
  proveedorId: string;
  proveedorRut: string;
  proveedorNombre: string;
  tipoDocumento: string;
  numeroDocumento: string;
  fecha: string;
  fechaVencimiento: string;
  monto: number;
  montoPagado: number;
  estado: EstadoCxP;
  pagos: PagoCxP[];
  notas?: string;
}

// ============ Notas de Crédito / Débito ============
export type CodigoRefNC = '1' | '2' | '3'; // 1=Anula doc, 2=Corrige texto, 3=Corrige monto

export interface NotaCreditoDebito {
  id: string;
  tipo: 'credito' | 'debito';
  numero: number;
  fecha: string;
  rutCliente?: string;
  nombreCliente?: string;
  documentoReferenciaNumero?: string;
  documentoReferenciaTipo?: string;
  codigoReferencia: CodigoRefNC;
  razon: string;
  neto: number;
  iva: number;
  total: number;
  estado: 'emitida' | 'anulada';
}

// ============ Plantillas de Asientos ============
export interface PlantillaDetalle {
  cuentaId: string;
  cuentaCodigo: string;
  cuentaNombre: string;
  debe: number;
  haber: number;
  descripcion?: string; // campo libre por línea
}

export interface PlantillaAsiento {
  id: string;
  nombre: string;
  descripcion?: string;
  glosa: string;       // glosa por defecto
  detalles: PlantillaDetalle[];
  creadoEn: string;
  usosCount: number;
}

// ============ Multi-moneda ============
export type Moneda = 'CLP' | 'USD' | 'EUR' | 'UF' | 'UTM';

export interface TipoCambio {
  fecha: string;
  USD: number;
  EUR: number;
  UF: number;
  UTM: number;
}

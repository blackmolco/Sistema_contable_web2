// Servicio Multi-empresa
import { generateId } from '../utils/calculos';

export interface Empresa {
  id: string;
  razonSocial: string;
  nombreFantasia: string;
  rut: string;
  giro: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  telefono?: string;
  email?: string;
  actividadEconomica?: string;
  resolucionesSII?: {
    numero: string;
    fecha: string;
    tipo: string;
  }[];
  logo?: string;
  activa: boolean;
}

export interface ConfigMultiEmpresa {
  empresaActiva: string | null;
  empresas: Empresa[];
}

// Empresas de demostración
export const empresasDemo: Empresa[] = [
  {
    id: 'emp_001',
    razonSocial: 'Servicios Contables Chile Ltda.',
    nombreFantasia: 'Servicios Contables Chile',
    rut: '76.543.210-K',
    giro: 'Servicios de Contabilidad y Auditoría',
    direccion: 'Av. Providencia 1200, Of. 501',
    comuna: 'Providencia',
    ciudad: 'Santiago',
    telefono: '+56 2 2345 6789',
    email: 'contacto@servicioscontables.cl',
    actividadEconomica: '692000',
    activa: true,
  },
  {
    id: 'emp_002',
    razonSocial: 'Comercio Electrónico Nacional S.A.',
    nombreFantasia: 'ComercioElec',
    rut: '99.876.543-1',
    giro: 'Venta al por menor por correo y internet',
    direccion: 'Paseo Ahuehues 330, piso 12',
    comuna: 'Las Condes',
    ciudad: 'Santiago',
    telefono: '+56 2 2987 6543',
    email: 'ventas@comercioelec.cl',
    actividadEconomica: '479110',
    activa: true,
  },
  {
    id: 'emp_003',
    razonSocial: 'Constructora y Remodelaciones Andina E.I.R.L.',
    nombreFantasia: 'Constructora Andina',
    rut: '77.123.456-7',
    giro: 'Construcción y remodeling de edificios',
    direccion: 'Camino a Farellones 5678',
    comuna: 'Lo Barnechea',
    ciudad: 'Santiago',
    telefono: '+56 2 2123 4567',
    email: 'info@constructoraandina.cl',
    actividadEconomica: '411010',
    activa: true,
  },
];

export class MultiEmpresaService {
  private static readonly STORAGE_KEY = 'contable_empresas';
  private static readonly EMPRESA_ACTIVA_KEY = 'contable_empresa_activa';

  // Obtener todas las empresas
  static getEmpresas(): Empresa[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    // Inicializar con empresas demo
    this.setEmpresas(empresasDemo);
    return empresasDemo;
  }

  // Guardar empresas
  static setEmpresas(empresas: Empresa[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(empresas));
  }

  // Obtener empresa activa
  static getEmpresaActiva(): Empresa | null {
    const idActiva = localStorage.getItem(this.EMPRESA_ACTIVA_KEY);
    if (!idActiva) {
      const empresas = this.getEmpresas();
      return empresas.find(e => e.activa) || empresas[0] || null;
    }

    const empresas = this.getEmpresas();
    return empresas.find(e => e.id === idActiva) || empresas[0] || null;
  }

  // Establecer empresa activa
  static setEmpresaActiva(id: string): void {
    localStorage.setItem(this.EMPRESA_ACTIVA_KEY, id);
  }

  // Agregar empresa
  static agregarEmpresa(datos: Omit<Empresa, 'id'>): Empresa {
    const empresas = this.getEmpresas();
    const nuevaEmpresa: Empresa = {
      ...datos,
      id: generateId(),
    };
    empresas.push(nuevaEmpresa);
    this.setEmpresas(empresas);
    return nuevaEmpresa;
  }

  // Actualizar empresa
  static actualizarEmpresa(id: string, datos: Partial<Empresa>): Empresa | null {
    const empresas = this.getEmpresas();
    const index = empresas.findIndex(e => e.id === id);
    if (index === -1) return null;

    empresas[index] = { ...empresas[index], ...datos };
    this.setEmpresas(empresas);
    return empresas[index];
  }

  // Eliminar empresa
  static eliminarEmpresa(id: string): boolean {
    const empresas = this.getEmpresas();
    const filtered = empresas.filter(e => e.id !== id);
    if (filtered.length === empresas.length) return false;

    this.setEmpresas(filtered);

    // Si era la activa, cambiar a la primera disponible
    const activaActual = localStorage.getItem(this.EMPRESA_ACTIVA_KEY);
    if (activaActual === id) {
      localStorage.removeItem(this.EMPRESA_ACTIVA_KEY);
    }

    return true;
  }

  // Cambiar entre empresas (reinicia datos de la app)
  static cambiarEmpresa(id: string): void {
    this.setEmpresaActiva(id);
    // Limpiar datos específicos de la empresa
    localStorage.removeItem('contable_documentos');
    localStorage.removeItem('contable_asientos');
    localStorage.removeItem('contable_trabajadores');
    // Recargar la página para aplicar cambios
    window.location.reload();
  }

  // Validar RUT de empresa
  static validarRUTEmpresa(rut: string): boolean {
    const rutLimpio = rut.replace(/\./g, '').replace(/-/g, '');
    if (rutLimpio.length < 8) return false;

    const numeros = rutLimpio.slice(0, -1);
    const dv = rutLimpio.slice(-1).toUpperCase();

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

  // Verificar si es empresa simple (para simplified rules)
  static esEmpresaSimple(rut: string): boolean {
    const rutLimpio = rut.replace(/\./g, '').replace(/-/g, '');
    const numeros = rutLimpio.slice(0, -1);
    const acumulador = numeros.split('').reduce((sum, n) => sum + parseInt(n), 0);
    return acumulador <= 1000; // Empresa simple tiene ventas <= 5000 UTM al año
  }

  // Generar resumen de empresa para footer
  static getResumenEmpresa(empresa: Empresa): string {
    return `${empresa.razonSocial} | RUT: ${empresa.rut} | ${empresa.giro}`;
  }
}

// Selector de empresa componente helper
export function useEmpresaActual() {
  const empresa = MultiEmpresaService.getEmpresaActiva();
  const empresas = MultiEmpresaService.getEmpresas();

  return {
    empresa,
    empresas,
    cambiarEmpresa: MultiEmpresaService.cambiarEmpresa.bind(MultiEmpresaService),
    agregarEmpresa: MultiEmpresaService.agregarEmpresa.bind(MultiEmpresaService),
    actualizarEmpresa: MultiEmpresaService.actualizarEmpresa.bind(MultiEmpresaService),
  };
}
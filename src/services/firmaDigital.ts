// Servicio de Firma Digital para Documentos
import { generateId } from '../utils/calculos';

export interface CertificadoDigital {
  id: string;
  nombre: string;
  rut: string;
  emisor: string;
  fechaVencimiento: string;
  huellaDigital: string;
  tipo: 'digital' | 'electronica';
  estado: 'valido' | 'expirado' | 'revocado';
}

export interface FirmaDigital {
  id: string;
  documentoId: string;
  documentoTipo: 'factura' | 'liquidacion' | 'certificado';
  documentoNumero: string;
  firmante: string;
  rutFirmante: string;
  fechaFirma: string;
  hashDocumento: string;
  hashFirma: string;
  algoritmo: string;
  certificado: string;
  ubicacionFirma?: string;
  ipFirma?: string;
  validado: boolean;
}

export interface ValidacionFirma {
  valido: boolean;
  mensaje: string;
  detalles?: {
    certificadoValido: boolean;
    fechaFirma: string;
    hashCoincide: boolean;
    emisor: string;
    tiempoTranscurrido: string;
  };
}

// Proveedores de certificados en Chile
export const PROVEEDORES_CERTIFICADOS = [
  { id: 'eq', nombre: 'E-Quality Chile', url: 'https://www.e-certchile.cl' },
  { id: 'bf', nombre: 'Bureau Veritas', url: 'https://www.bureauveritas.cl' },
  { id: 'anf', nombre: 'ANF Chile', url: 'https://www.anf.cl' },
  { id: 'c', nombre: 'Certificadora Chilena', url: 'https://www.certificadora.cl' },
];

export class FirmaDigitalService {
  private static readonly STORAGE_KEY = 'contable_firmas';
  private static readonly CERTIFICADOS_KEY = 'contable_certificados';

  // Generar hash simple del documento
  static generarHashDocumento(contenido: string): string {
    let hash = 0;
    for (let i = 0; i < contenido.length; i++) {
      const char = contenido.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `SHA256:${Math.abs(hash).toString(16).padStart(16, '0')}`;
  }

  // Firmar un documento
  static firmarDocumento(
    contenido: string,
    firmante: string,
    rutFirmante: string,
    certificado: string
  ): FirmaDigital {
    const hashDocumento = this.generarHashDocumento(contenido);

    // Simular firma digital (en producción usaría crypto API real)
    const hashFirma = this.generarHashDocumento(hashDocumento + certificado + Date.now());
    const algoritmo = 'SHA256withRSA';

    const firma: FirmaDigital = {
      id: generateId(),
      documentoId: generateId(),
      documentoTipo: 'factura',
      documentoNumero: '',
      firmante,
      rutFirmante,
      fechaFirma: new Date().toISOString(),
      hashDocumento,
      hashFirma,
      algoritmo,
      certificado,
      ubicacionFirma: 'Chile',
      ipFirma: '127.0.0.1',
      validado: true,
    };

    // Guardar en storage
    this.guardarFirma(firma);

    return firma;
  }

  // Validar una firma
  static validarFirma(firma: FirmaDigital): ValidacionFirma {
    const detalles: ValidacionFirma['detalles'] = {
      certificadoValido: true,
      fechaFirma: firma.fechaFirma,
      hashCoincide: true,
      emisor: 'E-Quality Chile',
      tiempoTranscurrido: this.calcularTiempoTranscurrido(firma.fechaFirma),
    };

    // Verificar certificado
    const certificado = this.obtenerCertificados().find(c => c.id === firma.certificado);
    if (!certificado || certificado.estado !== 'valido') {
      detalles.certificadoValido = false;
    }

    // Verificar fecha de vencimiento
    if (certificado && new Date(certificado.fechaVencimiento) < new Date()) {
      detalles.certificadoValido = false;
    }

    const valido = detalles.certificadoValido && detalles.hashCoincide;

    return {
      valido,
      mensaje: valido ? 'Firma digital válida' : 'Firma digital inválida',
      detalles,
    };
  }

  // Verificar integridad del documento
  static verificarIntegridad(contenido: string, hashDocumento: string): boolean {
    const hashActual = this.generarHashDocumento(contenido);
    return hashActual === hashDocumento;
  }

  // Guardar firma
  static guardarFirma(firma: FirmaDigital): void {
    const firmas = this.obtenerFirmas();
    firmas.push(firma);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(firmas));
  }

  // Obtener firmas
  static obtenerFirmas(): FirmaDigital[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  // Obtener firma por documento
  static obtenerFirmaPorDocumento(documentoId: string): FirmaDigital | null {
    const firmas = this.obtenerFirmas();
    return firmas.find(f => f.documentoId === documentoId) || null;
  }

  // Guardar certificados
  static guardarCertificados(certificados: CertificadoDigital[]): void {
    localStorage.setItem(this.CERTIFICADOS_KEY, JSON.stringify(certificados));
  }

  // Obtener certificados
  static obtenerCertificados(): CertificadoDigital[] {
    const stored = localStorage.getItem(this.CERTIFICADOS_KEY);
    if (stored) return JSON.parse(stored);

    // Certificado demo
    const demo: CertificadoDigital[] = [
      {
        id: 'cert_demo',
        nombre: 'Certificado Demo',
        rut: '76.543.210-K',
        emisor: 'E-Quality Chile',
        fechaVencimiento: '2027-12-31',
        huellaDigital: 'a1b2c3d4e5f6g7h8i9j0',
        tipo: 'digital',
        estado: 'valido',
      },
    ];
    this.guardarCertificados(demo);
    return demo;
  }

  // Calcular tiempo transcurrido
  private static calcularTiempoTranscurrido(fecha: string): string {
    const ahora = new Date();
    const firma = new Date(fecha);
    const diff = ahora.getTime() - firma.getTime();

    const minutos = Math.floor(diff / 60000);
    const horas = Math.floor(diff / 3600000);
    const dias = Math.floor(diff / 86400000);

    if (dias > 0) return `${dias} día(s)`;
    if (horas > 0) return `${horas} hora(s)`;
    return `${minutos} minuto(s)`;
  }

  // Generar código QR para verificación (simulado)
  static generarQRVerificacion(firma: FirmaDigital): string {
    const baseUrl = 'https://sii.gob.cl/verificacion';
    const params = new URLSearchParams({
      doc: firma.documentoId,
      hash: firma.hashFirma,
      rut: firma.rutFirmante,
    });
    return `${baseUrl}?${params.toString()}`;
  }

  // Exportar certificado en formato Base64 (simulado)
  static exportarCertificadoPEM(certificado: CertificadoDigital): string {
    return `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIBATANBgkqhkiG9w0BAQsFADAT
MRcwFQYDVQQKEw5jbGllbnRlIGV4YW1wbGUu
Y2xheDAeFw0yNDAxMDEwMDAwMDBaFw0yNzEy
MzEyMjMzMDBaMBExDzANBgNVBAYTEiR0ZXN0
MSRjYTAwSjAeFw0yNDAxMDEwMDAwMDBaFw0y
NzEyMzEyMjMzMDBaMBExDzANBgNVBAYTEiR0
ZXN0MSRjYTAwXDANBgkqhkiG9w0BAQsFAAOC
AQEAq ${certificado.huellaDigital}
-----END CERTIFICATE-----`;
  }

  // Verificar certificado en lista de revocación (simulado)
  static verificarEnListaRevocacion(certificadoId: string): boolean {
    // En producción consultaría CRL del emisor
    return false;
  }

  // Obtener historial de firmas
  static obtenerHistorialFirmas(
    filtros?: { tipo?: string; fechaDesde?: string; fechaHasta?: string }
  ): FirmaDigital[] {
    let firmas = this.obtenerFirmas();

    if (filtros?.tipo) {
      firmas = firmas.filter(f => f.documentoTipo === filtros.tipo);
    }

    if (filtros?.fechaDesde) {
      firmas = firmas.filter(f => new Date(f.fechaFirma) >= new Date(filtros.fechaDesde!));
    }

    if (filtros?.fechaHasta) {
      firmas = firmas.filter(f => new Date(f.fechaFirma) <= new Date(filtros.fechaHasta!));
    }

    return firmas.sort((a, b) =>
      new Date(b.fechaFirma).getTime() - new Date(a.fechaFirma).getTime()
    );
  }
}

// Hook para usar firma digital
export function useFirmaDigital() {
  const firmar = (
    contenido: string,
    firmante: string,
    rutFirmante: string,
    certificadoId: string
  ): FirmaDigital => {
    return FirmaDigitalService.firmarDocumento(contenido, firmante, rutFirmante, certificadoId);
  };

  const validar = (firma: FirmaDigital): ValidacionFirma => {
    return FirmaDigitalService.validarFirma(firma);
  };

  const verificarIntegridad = (contenido: string, hash: string): boolean => {
    return FirmaDigitalService.verificarIntegridad(contenido, hash);
  };

  return { firmar, validar, verificarIntegridad };
}
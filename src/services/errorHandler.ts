// src/services/errorHandler.ts
// Mensajes de error amigables para el usuario

const ERROR_MESSAGES: Record<string, string> = {
  // Auth
  'Credenciales invalidas': 'Email o contrasena incorrectos',
  'Token de autenticacion requerido': 'Sesion expirada, por favor inicia sesion nuevamente',
  'Token invalido o expirado': 'Sesion expirada, por favor inicia sesion nuevamente',
  'Permiso insuficiente': 'No tienes permisos para realizar esta accion',
  // Red
  'Failed to fetch': 'No se pudo conectar con el servidor. Verifica tu conexion a internet',
  'NetworkError': 'Error de red, intenta nuevamente',
  // Generico
  'Error interno del servidor': 'Ocurrio un error en el servidor, intenta nuevamente',
  'Limite de operaciones alcanzado': 'Demasiadas operaciones, espera unos minutos e intenta nuevamente',
  'Demasiadas solicitudes, intente mas tarde': 'Demasiados intentos, espera 15 minutos',
};

const HTTP_STATUS_MESSAGES: Record<number, string> = {
  400: 'Los datos enviados no son validos',
  401: 'No autorizado, inicia sesion nuevamente',
  403: 'No tienes permisos para esta accion',
  404: 'El recurso solicitado no existe',
  409: 'Ya existe un registro con esos datos',
  413: 'El archivo es demasiado grande',
  422: 'Los datos enviados tienen errores de validacion',
  429: 'Demasiados intentos, espera unos minutos',
  500: 'Error interno del servidor, intenta nuevamente',
  502: 'Servicio no disponible temporalmente',
  503: 'El servicio esta en mantenimiento, intenta mas tarde',
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Buscar en mapa de mensajes conocidos
    for (const [key, friendly] of Object.entries(ERROR_MESSAGES)) {
      if (error.message.includes(key)) return friendly;
    }
    return error.message;
  }
  if (typeof error === 'string') {
    for (const [key, friendly] of Object.entries(ERROR_MESSAGES)) {
      if (error.includes(key)) return friendly;
    }
    return error;
  }
  return 'Ocurrio un error inesperado';
}

export function getHttpErrorMessage(status: number, serverMessage?: string): string {
  if (serverMessage) {
    for (const [key, friendly] of Object.entries(ERROR_MESSAGES)) {
      if (serverMessage.includes(key)) return friendly;
    }
  }
  return HTTP_STATUS_MESSAGES[status] || `Error ${status}`;
}

export async function handleApiResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let serverMessage: string | undefined;
    let detalles: string[] | undefined;
    try {
      const body = await res.json();
      serverMessage = body.error || body.message;
      detalles = body.detalles;
    } catch {}
    const msg = getHttpErrorMessage(res.status, serverMessage);
    throw new Error(detalles?.length ? `${msg} | ${detalles.join(' | ')}` : msg);
  }
  return res.json() as Promise<T>;
}

/**
 * AVISO DE SEGURIDAD:
 * Este módulo almacena usuarios y sesiones en localStorage, lo que expone
 * los datos a ataques XSS. Está pensado SOLO para modo offline/demo.
 * En producción, la autenticación debe delegarse completamente al backend
 * (JWT via httpOnly cookie o Authorization header), y NO se deben almacenar
 * hashes de contraseñas ni tokens de sesión en localStorage.
 */
// Sistema de Autenticación y Usuarios con localStorage
import bcrypt from 'bcryptjs';
import { generateId } from '../utils/calculos';

// ============ TIPOS DE USUARIOS ============
export type RolUsuario = 'administrador' | 'contador' | 'auxiliar' | 'visor';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: RolUsuario;
  passwordHash: string;
  activo: boolean;
  ultimoAcceso?: string;
  fechaCreacion: string;
}

export interface Sesion {
  usuarioId: string;
  token: string;
  fechaInicio: string;
  fechaExpiracion: string;
}

// ============ PERMISOS POR ROL ============
export const PERMISOS: Record<RolUsuario, string[]> = {
  administrador: [
    'dashboard.view', 'dashboard.edit',
    'cuentas.view', 'cuentas.create', 'cuentas.edit', 'cuentas.delete',
    'asientos.view', 'asientos.create', 'asientos.edit', 'asientos.delete',
    'remuneraciones.view', 'remuneraciones.create', 'remuneraciones.edit', 'remuneraciones.delete',
    'facturacion.view', 'facturacion.create', 'facturacion.edit', 'facturacion.delete', 'facturacion.export',
    'libroVentas.view', 'libroVentas.export',
    'libroCompras.view', 'libroCompras.export',
    'honorarios.view', 'honorarios.create', 'honorarios.edit', 'honorarios.delete',
    'estadosFinancieros.view', 'estadosFinancieros.export',
    'calculadora.view',
    'tesoreria.view', 'tesoreria.create', 'tesoreria.edit', 'tesoreria.delete',
    'reportes.view', 'reportes.export',
    'usuarios.view', 'usuarios.create', 'usuarios.edit', 'usuarios.delete',
    'configuracion.view', 'configuracion.edit',
  ],
  contador: [
    'dashboard.view',
    'cuentas.view', 'cuentas.create', 'cuentas.edit',
    'asientos.view', 'asientos.create', 'asientos.edit', 'asientos.delete',
    'remuneraciones.view', 'remuneraciones.create', 'remuneraciones.edit', 'remuneraciones.delete',
    'facturacion.view', 'facturacion.create', 'facturacion.edit', 'facturacion.delete', 'facturacion.export',
    'libroVentas.view', 'libroVentas.export',
    'libroCompras.view', 'libroCompras.export',
    'honorarios.view', 'honorarios.create', 'honorarios.edit', 'honorarios.delete',
    'estadosFinancieros.view', 'estadosFinancieros.export',
    'calculadora.view',
    'tesoreria.view', 'tesoreria.create', 'tesoreria.edit', 'tesoreria.delete',
    'reportes.view', 'reportes.export',
    'configuracion.view', 'configuracion.edit',
  ],
  auxiliar: [
    'dashboard.view',
    'cuentas.view',
    'asientos.view', 'asientos.create',
    'remuneraciones.view', 'remuneraciones.create',
    'facturacion.view', 'facturacion.create',
    'libroVentas.view',
    'libroCompras.view',
    'honorarios.view', 'honorarios.create',
    'estadosFinancieros.view',
    'calculadora.view',
    'tesoreria.view',
    'reportes.view',
  ],
  visor: [
    'dashboard.view',
    'cuentas.view',
    'asientos.view',
    'remuneraciones.view',
    'facturacion.view',
    'libroVentas.view',
    'libroCompras.view',
    'honorarios.view',
    'estadosFinancieros.view',
    'calculadora.view',
    'tesoreria.view',
    'reportes.view',
  ],
};

// ============ CLASE DE AUTENTICACIÓN ============
/**
 * @deprecated Usar ApiAuthService de src/services/apiAuth.ts (login contra el
 * backend real con JWT en sessionStorage). Esta clase se mantiene solo como
 * fallback offline/demo. Equivalencias:
 *   AuthService.login           → ApiAuthService.login
 *   AuthService.logout          → ApiAuthService.logout
 *   AuthService.isAuthenticated → ApiAuthService.isAuthenticated
 *   AuthService.getCurrentUser  → ApiAuthService.getUser
 */
export class AuthService {
  private static readonly USUARIOS_KEY = 'contable_usuarios';
  private static readonly SESION_KEY = 'contable_sesion';
  private static readonly SESION_EXPIRA = 8 * 60 * 60 * 1000; // 8 horas (reducido de 24h)
  private static readonly BCRYPT_ROUNDS = 12; // Aumentado de 10 a 12

  private static hashPassword(password: string): string {
    return bcrypt.hashSync(password, this.BCRYPT_ROUNDS);
  }

  private static verifyPassword(password: string, hash: string): boolean {
    // Migración transparente: hashes del formato legado (hash_XXXXXX) se re-hashearon al inicio
    if (hash.startsWith('hash_')) return false;
    return bcrypt.compareSync(password, hash);
  }

  // Detecta y migra el hash del usuario admin si fue creado con el algoritmo legado
  private static migrarHashLegado(usuario: Usuario, password: string): void {
    if (!usuario.passwordHash.startsWith('hash_')) return;
    const usuarios = this.getUsuarios();
    const index = usuarios.findIndex(u => u.id === usuario.id);
    if (index === -1) return;
    // Verificar con algoritmo viejo antes de migrar
    let hashViejo = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hashViejo = ((hashViejo << 5) - hashViejo) + char;
      hashViejo = hashViejo & hashViejo;
    }
    if (`hash_${Math.abs(hashViejo).toString(16)}` === usuario.passwordHash) {
      usuarios[index].passwordHash = this.hashPassword(password);
      localStorage.setItem(this.USUARIOS_KEY, JSON.stringify(usuarios));
    }
  }

  static inicializarUsuarios(): void {
    const usuarios = this.getUsuarios();
    if (usuarios.length === 0) {
      const admin: Usuario = {
        id: generateId(),
        email: 'admin@contable.cl',
        nombre: 'Administrador',
        rol: 'administrador',
        passwordHash: this.hashPassword('admin123'),
        activo: true,
        fechaCreacion: new Date().toISOString(),
      };
      localStorage.setItem(this.USUARIOS_KEY, JSON.stringify([admin]));
    }
  }

  static getUsuarios(): Usuario[] {
    const data = localStorage.getItem(this.USUARIOS_KEY);
    return data ? JSON.parse(data) : [];
  }

  static crearUsuario(datos: Omit<Usuario, 'id' | 'passwordHash' | 'fechaCreacion'> & { passwordInicial?: string }): Usuario {
    const usuarios = this.getUsuarios();
    if (usuarios.some(u => u.email === datos.email)) {
      throw new Error('El email ya está registrado');
    }
    const passwordInicial = datos.passwordInicial ?? `${datos.email.split('@')[0]}@Contable1`;
    const { passwordInicial: _, ...datosSinPassword } = datos;
    const nuevoUsuario: Usuario = {
      id: generateId(),
      ...datosSinPassword,
      passwordHash: this.hashPassword(passwordInicial),
      fechaCreacion: new Date().toISOString(),
    };
    usuarios.push(nuevoUsuario);
    localStorage.setItem(this.USUARIOS_KEY, JSON.stringify(usuarios));
    return nuevoUsuario;
  }

  static actualizarUsuario(id: string, datos: Partial<Usuario>): Usuario | null {
    const usuarios = this.getUsuarios();
    const index = usuarios.findIndex(u => u.id === id);
    if (index === -1) return null;
    usuarios[index] = { ...usuarios[index], ...datos };
    localStorage.setItem(this.USUARIOS_KEY, JSON.stringify(usuarios));
    return usuarios[index];
  }

  static eliminarUsuario(id: string): boolean {
    const usuarios = this.getUsuarios();
    const filtered = usuarios.filter(u => u.id !== id);
    if (filtered.length === usuarios.length) return false;
    localStorage.setItem(this.USUARIOS_KEY, JSON.stringify(filtered));
    return true;
  }

  static iniciarSesion(email: string, password: string): Sesion | null {
    const usuarios = this.getUsuarios();
    const usuario = usuarios.find(u => u.email === email && u.activo);
    if (!usuario) return null;

    // Migrar hash legado si corresponde (solo al iniciar sesión)
    this.migrarHashLegado(usuario, password);

    // Re-leer tras posible migración
    const usuariosActualizados = this.getUsuarios();
    const usuarioActual = usuariosActualizados.find(u => u.id === usuario.id);
    if (!usuarioActual || !this.verifyPassword(password, usuarioActual.passwordHash)) return null;

    // Actualizar último acceso
    const idx = usuariosActualizados.findIndex(u => u.id === usuario.id);
    usuariosActualizados[idx].ultimoAcceso = new Date().toISOString();
    localStorage.setItem(this.USUARIOS_KEY, JSON.stringify(usuariosActualizados));

    const sesion: Sesion = {
      usuarioId: usuario.id,
      token: generateId(),
      fechaInicio: new Date().toISOString(),
      fechaExpiracion: new Date(Date.now() + this.SESION_EXPIRA).toISOString(),
    };
    localStorage.setItem(this.SESION_KEY, JSON.stringify(sesion));
    return sesion;
  }

  static cerrarSesion(): void {
    localStorage.removeItem(this.SESION_KEY);
  }

  static getSesionActual(): { sesion: Sesion; usuario: Usuario } | null {
    const data = localStorage.getItem(this.SESION_KEY);
    if (!data) return null;
    const sesion: Sesion = JSON.parse(data);
    if (new Date(sesion.fechaExpiracion) < new Date()) {
      this.cerrarSesion();
      return null;
    }
    const usuario = this.getUsuarios().find(u => u.id === sesion.usuarioId);
    if (!usuario) return null;
    return { sesion, usuario };
  }

  static tienePermiso(permiso: string): boolean {
    const sesionActual = this.getSesionActual();
    if (!sesionActual) return false;
    return PERMISOS[sesionActual.usuario.rol].includes(permiso);
  }

  static cambiarPassword(usuarioId: string, passwordActual: string, passwordNuevo: string): boolean {
    const usuarios = this.getUsuarios();
    const index = usuarios.findIndex(u => u.id === usuarioId);
    if (index === -1) return false;
    if (!this.verifyPassword(passwordActual, usuarios[index].passwordHash)) return false;
    usuarios[index].passwordHash = this.hashPassword(passwordNuevo);
    localStorage.setItem(this.USUARIOS_KEY, JSON.stringify(usuarios));
    return true;
  }
}

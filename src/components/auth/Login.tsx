import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { ApiAuthService, AuthError } from '../../services/apiAuth';
import { Button, Input } from '../ui/FormElements';
import { useIndicadores } from '../../hooks/useIndicadores';
import { formatCurrency } from '../../utils/calculos';
import logoValenzuela from '../../assets/logo-valenzuela.png';

interface LoginProps {
  onLoginSuccess: () => void;
}

const FECHA_HOY = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

const FILAS_INDICADOR: Array<{ key: 'uf' | 'dolar' | 'utm' | 'euro'; label: string }> = [
  { key: 'uf', label: 'UF' },
  { key: 'dolar', label: 'Dólar observado' },
  { key: 'utm', label: 'UTM' },
  { key: 'euro', label: 'Euro' },
];

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { indicadores, loading: loadingIndicadores } = useIndicadores();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Login real contra el backend (POST /api/auth/login, token JWT en
      // sessionStorage). Antes, si el backend no respondía por CUALQUIER
      // motivo (no solo contraseña incorrecta — también un corte de red),
      // la app caía a un login local guardado en localStorage, con un
      // administrador por defecto que se recreaba solo si no existía
      // ninguno. Eso dejaba una puerta de entrada sin pasar por el servidor
      // real. Se eliminó: si el backend no responde, el login falla.
      const user = await ApiAuthService.login(email, password);
      useAuthStore.setState({
        user: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          rut: user.rut || '',
          rol: user.rol === 'administrador' ? 'admin' : (user.rol as any) || 'contador',
          empresaId: user.empresaId || '',
        },
        isAuthenticated: true,
      });

      // Señal explicita de "sesion recien iniciada" — los contextos que
      // sincronizan con el servidor (Facturacion, Contabilidad, etc.) la
      // escuchan para pedir datos frescos, ya que useAuthStore.isAuthenticated
      // puede venir precargado (persistido) de una sesion anterior y por eso
      // no sirve como disparador confiable de un useEffect.
      window.dispatchEvent(new Event('scc:login'));
      onLoginSuccess();
    } catch (err) {
      if (err instanceof AuthError) {
        setError(err.message || 'Credenciales inválidas. Verifique su email y contraseña.');
      } else {
        setError('No se pudo conectar con el servidor. Intente nuevamente.');
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── Panel de marca + indicadores del día ─────────────────────────── */}
      <div className="login-ledger-panel relative w-full md:w-[54%] lg:w-[57%] text-white flex flex-col justify-center gap-10 lg:gap-16 px-6 py-10 sm:px-12 sm:py-14 lg:px-20 lg:py-16 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div className="inline-flex items-center bg-white rounded-xl shadow-lg px-4 py-2.5">
            <img src={logoValenzuela} alt="Valenzuela & Asociados Asesorías SpA" className="h-8 sm:h-10 w-auto" />
          </div>

          <h1 className="font-display mt-5 sm:mt-10 text-2xl sm:text-4xl font-semibold leading-tight max-w-md text-balance">
            Su contabilidad, siempre al día.
          </h1>
          <p className="mt-2 sm:mt-4 text-sm sm:text-base text-white/70 max-w-sm leading-relaxed">
            Documentos, libros del SII y cierres tributarios en un solo sistema, para pymes chilenas.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
        >
          <div className="flex items-center gap-2 text-white/60 text-xs font-medium uppercase tracking-wider">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: 'var(--brand-secondary)' }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--brand-secondary)' }} />
            </span>
            <span className="truncate">Indicadores del día · {FECHA_HOY}</span>
          </div>

          <div className="mt-2 sm:mt-3 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-sm overflow-hidden">
            {loadingIndicadores ? (
              <div className="px-4 py-3 text-sm text-white/50">Obteniendo valores del día…</div>
            ) : indicadores ? (
              FILAS_INDICADOR.map(({ key, label }) => (
                <div key={key} className="login-indicador-row flex items-center justify-between px-4 py-2 sm:py-3">
                  <span className="text-sm text-white/70">{label}</span>
                  <span className="font-data text-base font-semibold text-white">
                    {formatCurrency(indicadores[key].valor)}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-4 py-4 text-sm text-white/50">Indicadores no disponibles por ahora</div>
            )}
          </div>
          <p className="mt-2 text-[11px] text-white/40">Fuente: mindicador.cl</p>
        </motion.div>
      </div>

      {/* ── Formulario ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center bg-[#F7F5F0] px-6 py-8 sm:py-12 sm:px-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          className="w-full max-w-sm"
        >
          <h2 className="font-display text-2xl font-semibold text-gray-900">Iniciar sesión</h2>
          <p className="mt-1.5 text-sm text-gray-500">Ingresa con tu cuenta para continuar.</p>

          {error && (
            <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail size={18} />}
              className="py-3"
              autoComplete="email"
              required
            />
            <Input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock size={18} />}
              className="py-3"
              autoComplete="current-password"
              required
            />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={loading}
              icon={<LogIn size={18} />}
            >
              Ingresar
            </Button>
          </form>

          <p className="mt-8 text-xs text-gray-400 text-center">
            © 2026 Sistema para Valenzuela &amp; Asociados Asesorías SpA
          </p>
        </motion.div>
      </div>
    </div>
  );
}

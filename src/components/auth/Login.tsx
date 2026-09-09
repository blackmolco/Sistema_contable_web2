import React, { useState } from 'react';
import { LogIn, Mail, Lock, AlertCircle, Shield } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { ApiAuthService, AuthError } from '../../services/apiAuth';
import { Button, Input } from '../ui/FormElements';
import logoValenzuela from '../../assets/logo-valenzuela.png';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    <div className="min-h-screen bg-gradient-to-br from-primary to-[var(--brand-dark)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-white rounded-2xl mb-4 shadow-lg px-6 py-4">
            <img src={logoValenzuela} alt="Valenzuela & Asociados Asesorías SpA" className="h-24 w-auto" />
          </div>
          <p className="text-white/70 mt-2">Sistema Contable Profesional</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-2 mb-6 text-center justify-center">
            <Shield size={20} className="text-primary" />
            <h2 className="text-xl font-semibold text-gray-900 font-display">Iniciar Sesión</h2>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                required
              />
            </div>

            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                required
              />
            </div>

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

        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-white/50 text-sm">
            © 2026 Sistema para Valenzuela & Asociados Asesorías SpA
          </p>
        </div>
      </div>
    </div>
  );
}

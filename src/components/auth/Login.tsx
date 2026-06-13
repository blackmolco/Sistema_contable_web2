import React, { useState, useEffect } from 'react';
import { LogIn, Mail, Lock, AlertCircle, Shield } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { ApiAuthService } from '../../services/apiAuth';
import { Button, Input } from '../ui/FormElements';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const inicializarUsuarios = useAuthStore((s) => s.inicializarUsuarios);

  useEffect(() => {
    inicializarUsuarios();
  }, [inicializarUsuarios]);

  const loginLocal = useAuthStore((s) => s.loginLocal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1) Login real contra el backend (POST /api/auth/login, token JWT en sessionStorage)
      let success = false;
      try {
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
        success = true;
      } catch (apiErr) {
        // Backend no disponible o credenciales rechazadas → fallback a login local (legacy)
        success = loginLocal(email, password);
      }

      if (!success) {
        setError('Credenciales inválidas. Verifique su email y contraseña.');
        setLoading(false);
        return;
      }

      onLoginSuccess();
    } catch (err) {
      setError('Error al iniciar sesión. Intente nuevamente.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E3A5F] to-[#2D5A87] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl mb-4 shadow-lg">
            <span className="text-2xl font-bold text-[#1E3A5F]">CC</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Contable Chile</h1>
          <p className="text-white/70 mt-2">Sistema Contable Profesional</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="flex items-center gap-2 mb-6 text-center justify-center">
            <Shield size={20} className="text-[#1E3A5F]" />
            <h2 className="text-xl font-semibold text-gray-900">Iniciar Sesión</h2>
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
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] transition-all"
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
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] transition-all"
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

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-2 text-center">Credenciales de prueba:</p>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Email:</strong> admin@contable.cl</p>
              <p><strong>Contraseña:</strong> admin123</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-white/50 text-sm">
            © 2024 Contable Chile - Normativas SII vigentes
          </p>
        </div>
      </div>
    </div>
  );
}

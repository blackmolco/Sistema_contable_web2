import React, { useEffect, useState } from 'react';
import { User, KeyRound, Shield, Building2 } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { Button, Input } from '../components/ui/FormElements';
import { useApp } from '../context/AppContext';
import { ApiAuthService } from '../services/apiAuth';
import { apiFetchRaw } from '../services/httpClient';
import { getErrorMessage } from '../services/errorHandler';
import { fetchEmpresas } from '../services/apiSync';

const ROL_LABEL: Record<string, string> = {
  admin: 'Administrador',
  administrador: 'Administrador',
  contador: 'Contador',
  usuario: 'Usuario',
};

export default function MiPerfil() {
  const { showToast } = useApp();
  const usuario = ApiAuthService.getCurrentUser();
  const [empresaNombre, setEmpresaNombre] = useState<string | null>(null);

  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNuevo, setPasswordNuevo] = useState('');
  const [passwordConfirmar, setPasswordConfirmar] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esAdmin = usuario?.rol === 'admin' || usuario?.rol === 'administrador';

  useEffect(() => {
    if (esAdmin || !usuario?.empresaId) return;
    fetchEmpresas()
      .then(lista => setEmpresaNombre(lista.find(e => e.id === usuario.empresaId)?.razonSocial ?? null))
      .catch(() => {});
  }, [esAdmin, usuario?.empresaId]);

  const handleCambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (passwordNuevo.length < 8) {
      setError('La contraseña nueva debe tener al menos 8 caracteres');
      return;
    }
    if (passwordNuevo !== passwordConfirmar) {
      setError('La confirmación no coincide con la contraseña nueva');
      return;
    }
    setGuardando(true);
    try {
      const res = await apiFetchRaw('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ passwordActual, passwordNuevo }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      showToast('success', 'Contraseña actualizada', 'Tu contraseña se cambió correctamente.');
      setPasswordActual('');
      setPasswordNuevo('');
      setPasswordConfirmar('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>
        <p className="text-sm text-gray-500 mt-1">Tus datos de acceso al sistema</p>
      </div>

      <Card
        title={
          <div className="flex items-center gap-2">
            <User size={20} />
            Datos de la cuenta
          </div>
        }
      >
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500">Nombre</dt>
            <dd className="font-medium text-gray-900">{usuario?.nombre || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Email</dt>
            <dd className="font-medium text-gray-900">{usuario?.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500 flex items-center gap-1"><Shield size={13} /> Rol</dt>
            <dd className="font-medium text-gray-900">{ROL_LABEL[usuario?.rol || ''] || usuario?.rol || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500 flex items-center gap-1"><Building2 size={13} /> Empresa</dt>
            <dd className="font-medium text-gray-900">{esAdmin ? 'Todas las empresas' : (empresaNombre ?? 'Sin empresa asignada')}</dd>
          </div>
        </dl>
        <p className="text-xs text-gray-400 mt-4">
          Para cambiar tu nombre, email, rol o empresa asignada, contacta a un administrador.
        </p>
      </Card>

      <Card
        title={
          <div className="flex items-center gap-2">
            <KeyRound size={20} />
            Cambiar mi contraseña
          </div>
        }
      >
        <form onSubmit={handleCambiarPassword} className="space-y-4 max-w-md">
          <Input
            label="Contraseña actual"
            type="password"
            value={passwordActual}
            onChange={e => setPasswordActual(e.target.value)}
            required
          />
          <Input
            label="Contraseña nueva (mín. 8 caracteres)"
            type="password"
            value={passwordNuevo}
            onChange={e => setPasswordNuevo(e.target.value)}
            required
          />
          <Input
            label="Confirmar contraseña nueva"
            type="password"
            value={passwordConfirmar}
            onChange={e => setPasswordConfirmar(e.target.value)}
            required
          />
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Cambiar contraseña'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, RefreshCw, Shield, User, ChevronDown } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { Button, Input } from '../components/ui/FormElements';
import { apiFetch, apiFetchRaw } from '../services/httpClient';
import { getErrorMessage } from '../services/errorHandler';

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  empresaId: string | null;
  activo: boolean;
  ultimoAcceso?: string;
}

const ROL_LABELS: Record<string, { label: string; color: string }> = {
  admin:    { label: 'Admin',    color: 'bg-purple-100 text-purple-700' },
  contador: { label: 'Contador', color: 'bg-blue-100 text-blue-700' },
  usuario:  { label: 'Usuario',  color: 'bg-gray-100 text-gray-600' },
};

const initialForm = { nombre: '', email: '', password: '', rol: 'usuario', empresaId: '' };

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  const cargarUsuarios = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Usuario[] | { data: Usuario[] }>('/api/usuarios');
      setUsuarios(Array.isArray(data) ? data : (data as { data: Usuario[] }).data ?? []);
    } catch (err) {
      setError(`No se pudo cargar la lista de usuarios: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarUsuarios(); }, [cargarUsuarios]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFormSuccess(false);
    try {
      const body: Record<string, string> = {
        nombre: form.nombre,
        email: form.email,
        password: form.password,
        rol: form.rol,
      };
      if (form.empresaId.trim()) body.empresaId = form.empresaId.trim();

      const res = await apiFetchRaw('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      setFormSuccess(true);
      setForm(initialForm);
      setShowForm(false);
      cargarUsuarios();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear usuario');
    } finally {
      setSaving(false);
    }
  };

  const rolInfo = (rol: string) => ROL_LABELS[rol] ?? { label: rol, color: 'bg-gray-100 text-gray-600' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">Administra los usuarios que tienen acceso al sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={cargarUsuarios} disabled={loading}>
            Actualizar
          </Button>
          <Button icon={<UserPlus size={16} />} onClick={() => { setShowForm(!showForm); setFormError(null); setFormSuccess(false); }}>
            Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Formulario crear usuario */}
      {showForm && (
        <Card title="Crear nuevo usuario">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Nombre completo"
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              required
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
            <Input
              label="Contraseña (mín. 8 caracteres)"
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <div className="relative">
                <select
                  value={form.rol}
                  onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="usuario">Usuario</option>
                  <option value="contador">Contador</option>
                  <option value="admin">Administrador</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="md:col-span-2">
              <Input
                label="ID Empresa (opcional)"
                value={form.empresaId}
                onChange={e => setForm(f => ({ ...f, empresaId: e.target.value }))}
                placeholder="Dejar vacío para acceso a todas las empresas"
              />
            </div>

            {formError && (
              <div className="md:col-span-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            <div className="md:col-span-2 flex gap-3 justify-end">
              <Button variant="secondary" type="button" onClick={() => { setShowForm(false); setForm(initialForm); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Creando...' : 'Crear usuario'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {formSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700">
          Usuario creado exitosamente.
        </div>
      )}

      {/* Lista de usuarios */}
      <Card title={`Usuarios (${usuarios.length})`}>
        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Cargando...</div>
        ) : error ? (
          <div className="py-12 text-center text-red-500 text-sm">{error}</div>
        ) : usuarios.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No hay usuarios registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rol</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Último acceso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {usuarios.map(u => {
                  const { label, color } = rolInfo(u.rol);
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          {u.rol === 'admin'
                            ? <Shield size={14} className="text-purple-600" />
                            : <User size={14} className="text-blue-600" />}
                        </div>
                        {u.nombre}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${u.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {u.ultimoAcceso
                          ? new Date(u.ultimoAcceso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

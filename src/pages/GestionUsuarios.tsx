import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, RefreshCw, Shield, User, ChevronDown, Pencil, X, Check, KeyRound, Dices } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { Button, Input } from '../components/ui/FormElements';
import { Modal } from '../components/ui/Modal';
import { apiFetch, apiFetchRaw } from '../services/httpClient';
import { getErrorMessage } from '../services/errorHandler';
import { fetchEmpresas } from '../services/apiSync';
import type { Empresa } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';

function generarPasswordAleatoria(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return out;
}

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
  admin:      { label: 'Admin',      color: 'bg-purple-100 text-purple-700' },
  supervisor: { label: 'Supervisor', color: 'bg-amber-100 text-amber-700' },
  contador:   { label: 'Contador',   color: 'bg-blue-100 text-blue-700' },
  usuario:    { label: 'Usuario',    color: 'bg-gray-100 text-gray-600' },
};

const initialForm = { nombre: '', email: '', password: '', rol: 'usuario', empresaId: '' };

export default function GestionUsuarios() {
  const currentUserId = useAuthStore(s => s.user?.id);
  const rolPropio = useAuthStore(s => s.user?.rol);
  const empresaIdPropia = useAuthStore(s => s.user?.empresaId);
  const esAdminGlobal = rolPropio === 'admin' || rolPropio === 'administrador';
  const esSupervisor = rolPropio === 'supervisor';
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [formEmailWarning, setFormEmailWarning] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ rol: 'usuario', empresaId: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editEmailWarning, setEditEmailWarning] = useState<string | null>(null);

  const [passwordUsuario, setPasswordUsuario] = useState<Usuario | null>(null);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordOk, setPasswordOk] = useState(false);
  const [passwordEmailWarning, setPasswordEmailWarning] = useState<string | null>(null);

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
  useEffect(() => { fetchEmpresas().then(setEmpresas).catch(() => {}); }, []);

  const nombreEmpresa = (id: string | null) => {
    if (!id) return null;
    return empresas.find(e => e.id === id)?.razonSocial ?? id;
  };

  const iniciarEdicion = (u: Usuario) => {
    setEditandoId(u.id);
    setEditForm({ rol: u.rol, empresaId: u.empresaId ?? '' });
    setEditError(null);
  };

  const guardarEdicion = async (id: string) => {
    setEditSaving(true);
    setEditError(null);
    setEditEmailWarning(null);
    try {
      const body: Record<string, string | null> = { rol: editForm.rol };
      if (editForm.rol !== 'admin') {
        body.empresaId = editForm.empresaId.trim() || null;
      }
      const res = await apiFetchRaw(`/api/usuarios/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }
      if (data.emailEnviado === false) {
        setEditEmailWarning(`Se guardó el cambio, pero no se pudo avisar por correo al usuario (${data.emailError || 'correo no configurado'}).`);
      }
      setEditandoId(null);
      cargarUsuarios();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error al actualizar usuario');
    } finally {
      setEditSaving(false);
    }
  };

  const abrirCambioPassword = (u: Usuario) => {
    setPasswordUsuario(u);
    setNuevaPassword(generarPasswordAleatoria());
    setPasswordError(null);
    setPasswordEmailWarning(null);
    setPasswordOk(false);
  };

  const guardarPassword = async () => {
    if (!passwordUsuario) return;
    setPasswordSaving(true);
    setPasswordError(null);
    try {
      const res = await apiFetchRaw(`/api/usuarios/${passwordUsuario.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: nuevaPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }
      setPasswordEmailWarning(data.emailEnviado === false ? (data.emailError || 'correo no configurado') : null);
      setPasswordOk(true);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Error al cambiar la contraseña');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFormSuccess(false);
    setFormEmailWarning(null);
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }
      if (data.emailEnviado === false) {
        setFormEmailWarning(`El usuario se creó, pero no se le pudo enviar el correo de bienvenida (${data.emailError || 'correo no configurado'}). Pásale la contraseña por otro medio.`);
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
          <Button
            icon={<UserPlus size={16} />}
            onClick={() => {
              // Un supervisor solo crea usuarios para su propia empresa —
              // se la precargamos ya que no tiene otra para elegir.
              if (!showForm && esSupervisor) setForm(f => ({ ...f, empresaId: empresaIdPropia ?? '' }));
              setShowForm(!showForm);
              setFormError(null);
              setFormSuccess(false);
            }}
          >
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
                  onChange={e => setForm(f => ({ ...f, rol: e.target.value, empresaId: e.target.value === 'admin' ? '' : f.empresaId }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm appearance-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="usuario">Usuario</option>
                  <option value="contador">Contador</option>
                  {esAdminGlobal && <option value="supervisor">Supervisor (admin de su empresa)</option>}
                  {esAdminGlobal && <option value="admin">Administrador</option>}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div className="md:col-span-2">
              {form.rol === 'admin' ? (
                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  Los administradores ven todas las empresas — no se asigna una en particular.
                </p>
              ) : esSupervisor ? (
                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  Se crea para tu misma empresa.
                </p>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Empresa que puede ver</label>
                  <div className="relative">
                    <select
                      value={form.empresaId}
                      onChange={e => setForm(f => ({ ...f, empresaId: e.target.value }))}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm appearance-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Selecciona una empresa...</option>
                      {empresas.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.razonSocial}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}
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

      {formSuccess && !formEmailWarning && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700">
          Usuario creado exitosamente.
        </div>
      )}
      {formEmailWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          {formEmailWarning}
        </div>
      )}

      {editError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {editError}
        </div>
      )}
      {editEmailWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          {editEmailWarning}
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empresa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Último acceso</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {usuarios.map(u => {
                  const { label, color } = rolInfo(u.rol);
                  const editando = editandoId === u.id;
                  const esUnoMismo = u.id === currentUserId;
                  // Un supervisor no puede tocar una fila que ya es admin o
                  // supervisor (ni la propia, por esUnoMismo) — se le ocultan
                  // los botones de acción para que no choque con un 403.
                  const puedeActuar = esAdminGlobal || (esSupervisor && (u.rol === 'contador' || u.rol === 'usuario'));
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            {u.rol === 'admin' || u.rol === 'supervisor'
                              ? <Shield size={14} className={u.rol === 'admin' ? 'text-purple-600' : 'text-amber-600'} />
                              : <User size={14} className="text-blue-600" />}
                          </div>
                          {u.nombre}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3">
                        {editando ? (
                          <select
                            value={editForm.rol}
                            onChange={e => setEditForm(f => ({ ...f, rol: e.target.value }))}
                            disabled={esUnoMismo}
                            title={esUnoMismo ? 'No puedes cambiar tu propio rol' : undefined}
                            className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
                          >
                            <option value="usuario">Usuario</option>
                            <option value="contador">Contador</option>
                            {esAdminGlobal && <option value="supervisor">Supervisor</option>}
                            {esAdminGlobal && <option value="admin">Administrador</option>}
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
                            {label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {editando ? (
                          editForm.rol === 'admin' ? (
                            <span className="text-gray-400 italic">Todas las empresas</span>
                          ) : (
                            <select
                              value={editForm.empresaId}
                              onChange={e => setEditForm(f => ({ ...f, empresaId: e.target.value }))}
                              className="border border-gray-300 rounded-lg px-2 py-1 text-xs max-w-[180px]"
                            >
                              <option value="">Sin empresa asignada</option>
                              {empresas.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.razonSocial}</option>
                              ))}
                            </select>
                          )
                        ) : u.rol === 'admin' ? (
                          <span className="text-gray-400 italic">Todas</span>
                        ) : (
                          nombreEmpresa(u.empresaId) ?? <span className="text-amber-600">Sin asignar</span>
                        )}
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
                      <td className="px-4 py-3 text-right">
                        {editando ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => guardarEdicion(u.id)}
                              disabled={editSaving || (editForm.rol !== 'admin' && !editForm.empresaId)}
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                              title="Guardar"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditandoId(null)}
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                              title="Cancelar"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ) : puedeActuar ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => abrirCambioPassword(u)}
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                              title="Cambiar contraseña"
                            >
                              <KeyRound size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => iniciarEdicion(u)}
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                              title="Editar rol y empresa"
                            >
                              <Pencil size={15} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={!!passwordUsuario}
        onClose={() => setPasswordUsuario(null)}
        title={`Cambiar contraseña — ${passwordUsuario?.nombre ?? ''}`}
        size="sm"
        closeOnBackdrop={!passwordSaving}
        footer={
          passwordOk ? (
            <Button onClick={() => setPasswordUsuario(null)}>Listo</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setPasswordUsuario(null)} disabled={passwordSaving}>
                Cancelar
              </Button>
              <Button onClick={guardarPassword} disabled={passwordSaving || nuevaPassword.length < 8}>
                {passwordSaving ? 'Guardando...' : 'Cambiar contraseña'}
              </Button>
            </>
          )
        }
      >
        {passwordOk ? (
          passwordEmailWarning ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
              La contraseña se cambió y la sesión de {passwordUsuario?.email} se cerró, pero no se le pudo avisar por
              correo ({passwordEmailWarning}). Pásale la contraseña nueva por otro medio.
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-700">
              Contraseña actualizada. Se le envió un correo a {passwordUsuario?.email} con la contraseña nueva y se cerró su sesión activa.
            </div>
          )
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Se le enviará esta contraseña a <strong>{passwordUsuario?.email}</strong> por correo y se cerrará su sesión activa.
            </p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  label="Nueva contraseña (mín. 8 caracteres)"
                  value={nuevaPassword}
                  onChange={e => setNuevaPassword(e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => setNuevaPassword(generarPasswordAleatoria())}
                title="Generar otra contraseña aleatoria"
                className="mb-0.5 p-2.5 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-700"
              >
                <Dices size={16} />
              </button>
            </div>
            {passwordError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {passwordError}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  History,
  Clock,
  HardDrive,
  Database,
  AlertTriangle,
  CheckCircle,
  Trash2,
  RefreshCw,
  Building2,
  Plus,
  LogIn,
} from 'lucide-react';
import { Card, Button } from '../components/ui/Cards';
import { useApp } from '../context/AppContext';
import { BackupService, HistorialBackup } from '../services/backupService';

// ── Multi-empresa helpers ──────────────────────────────────────────────────────
const EMPRESA_ACTIVA_KEY = 'scc_empresa_activa';
const EMPRESAS_LIST_KEY  = 'scc_empresas_list';
const STORAGE_KEYS_EMPRESA = [
  'scc_contabilidad', 'scc_remuneraciones', 'scc_facturacion',
  'scc_clientes', 'scc_app',
];

interface EmpresaRegistro {
  rut: string;
  nombre: string;
  ultimoAcceso: string;
}

function getEmpresasGuardadas(): EmpresaRegistro[] {
  try { return JSON.parse(localStorage.getItem(EMPRESAS_LIST_KEY) ?? '[]'); }
  catch { return []; }
}

function saveEmpresasList(list: EmpresaRegistro[]) {
  localStorage.setItem(EMPRESAS_LIST_KEY, JSON.stringify(list));
}

function getEmpresaActiva(): string {
  return localStorage.getItem(EMPRESA_ACTIVA_KEY) ?? 'default';
}

function switchEmpresa(rutDestino: string) {
  const actual = getEmpresaActiva();
  if (actual === rutDestino) return;
  // Guardar datos actuales bajo prefijo de empresa actual
  STORAGE_KEYS_EMPRESA.forEach(key => {
    const val = localStorage.getItem(key);
    if (val) localStorage.setItem(`${actual}__${key}`, val);
  });
  // Cargar datos del destino (si existen)
  STORAGE_KEYS_EMPRESA.forEach(key => {
    const val = localStorage.getItem(`${rutDestino}__${key}`);
    if (val) localStorage.setItem(key, val);
    else localStorage.removeItem(key);
  });
  localStorage.setItem(EMPRESA_ACTIVA_KEY, rutDestino);
  window.location.reload();
}

export default function BackupSettings() {
  const [estadisticas, setEstadisticas] = useState<{
    totalModulos: number;
    totalRegistros: number;
    tamañoAproximado: string;
    ultimoBackup: string | null;
  } | null>(null);
  const [historial, setHistorial] = useState<HistorialBackup[]>([]);
  const [backupAutomatico, setBackupAutomatico] = useState<{ habilitado: boolean; intervalo: number; proximo: string } | null>(null);
  const [restaurando, setRestaurando] = useState(false);
  const [resultadoRestauracion, setResultadoRestauracion] = useState<{
    exitoso: boolean;
    mensaje: string;
  } | null>(null);

  // Multi-empresa state
  const [empresas, setEmpresas] = useState<EmpresaRegistro[]>(getEmpresasGuardadas);
  const [empresaActiva, setEmpresaActiva] = useState(getEmpresaActiva);
  const [nuevoRut, setNuevoRut] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const { showToast } = useApp();

  useEffect(() => {
    setEstadisticas(BackupService.getEstadisticas());
    setHistorial(BackupService.getHistorial());
    setBackupAutomatico(BackupService.getEstadoBackupAutomatico());
  }, []);

  const crearBackup = () => {
    BackupService.descargarBackup();
    setEstadisticas(BackupService.getEstadisticas());
    setHistorial(BackupService.getHistorial());
    showToast('success', 'Backup creado', 'Backup creado y descargado exitosamente');
  };

  const handleRestaurar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setRestaurando(true);
    const resultado = await BackupService.restaurarBackup(archivo);
    setResultadoRestauracion(resultado);
    setRestaurando(false);

    if (resultado.exitoso) {
      setHistorial(BackupService.getHistorial());
      setEstadisticas(BackupService.getEstadisticas());
    }
  };

  const programarBackup = (dias: number) => {
    BackupService.programarBackupAutomatico(dias);
    setBackupAutomatico(BackupService.getEstadoBackupAutomatico());
    showToast('success', 'Backup automático', `Programado cada ${dias} días`);
  };

  const deshabilitarBackupAuto = () => {
    BackupService.deshabilitarBackupAutomatico();
    setBackupAutomatico(null);
    showToast('info', 'Backup automático', 'Backup automático deshabilitado');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Backup y Restauración</h1>
        <p className="text-sm text-gray-500 mt-1">
          Administra tus copias de seguridad
        </p>
      </div>

      {/* Estadísticas */}
      {estadisticas && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Database size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Módulos</p>
                <p className="text-xl font-bold text-gray-900">{estadisticas.totalModulos}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <HardDrive size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Registros</p>
                <p className="text-xl font-bold text-gray-900">{estadisticas.totalRegistros.toLocaleString()}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Clock size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Último Backup</p>
                <p className="text-sm font-medium text-gray-900">
                  {estadisticas.ultimoBackup
                    ? new Date(estadisticas.ultimoBackup).toLocaleDateString('es-CL')
                    : 'Nunca'}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <HardDrive size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Tamaño</p>
                <p className="text-xl font-bold text-gray-900">{estadisticas.tamañoAproximado}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Acciones principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Crear Backup */}
        <Card title="Crear Backup">
          <p className="text-sm text-gray-600 mb-4">
            Descarga una copia completa de todos los datos del sistema. El archivo incluye:
          </p>
          <ul className="text-sm text-gray-500 mb-6 space-y-1">
            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500" />
              Usuarios y configuraciones
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500" />
              Transacciones y asientos contables
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500" />
              Documentos y facturas
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500" />
              Trabajadores y remuneraciones
            </li>
          </ul>
          <Button onClick={crearBackup} icon={<Download size={18} />} className="w-full">
            Descargar Backup
          </Button>
        </Card>

        {/* Restaurar Backup */}
        <Card title="Restaurar Backup">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900">Advertencia</p>
                <p className="text-xs text-amber-700 mt-1">
                  Restaurar un backup reemplazará todos los datos actuales. Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
          </div>

          <input
            type="file"
            accept=".json"
            onChange={handleRestaurar}
            className="hidden"
            id="backup-restore"
          />
          <label
            htmlFor="backup-restore"
            className="block w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-blue-400 transition-colors"
          >
            {restaurando ? (
              <div className="flex items-center justify-center gap-2">
                <RefreshCw size={20} className="animate-spin text-blue-600" />
                <span className="text-blue-600">Restaurando...</span>
              </div>
            ) : (
              <>
                <Upload size={20} className="mx-auto text-gray-400 mb-2" />
                <span className="text-gray-600">Seleccionar archivo de backup (.json)</span>
              </>
            )}
          </label>

          {resultadoRestauracion && (
            <div className={`mt-4 p-4 rounded-lg border ${
              resultadoRestauracion.exitoso
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-3">
                {resultadoRestauracion.exitoso ? (
                  <CheckCircle size={20} className="text-emerald-600" />
                ) : (
                  <AlertTriangle size={20} className="text-red-600" />
                )}
                <p className={`text-sm font-medium ${
                  resultadoRestauracion.exitoso ? 'text-emerald-900' : 'text-red-900'
                }`}>
                  {resultadoRestauracion.mensaje}
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Backup automático */}
      <Card title="Backup Automático">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Programar backups automáticos</p>
            <p className="text-sm text-gray-500 mt-1">
              {backupAutomatico
                ? `Próximo backup: ${new Date(backupAutomatico.proximo).toLocaleDateString('es-CL')}`
                : 'No hay backup automático configurado'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => programarBackup(7)}
            >
              Cada 7 días
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => programarBackup(14)}
            >
              Cada 14 días
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => programarBackup(30)}
            >
              Cada 30 días
            </Button>
            {backupAutomatico && (
              <Button
                variant="ghost"
                size="sm"
                onClick={deshabilitarBackupAuto}
              >
                Deshabilitar
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Historial */}
      <Card title="Historial de Backups">
        {historial.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <History size={40} className="mx-auto mb-3 text-gray-300" />
            <p>No hay backups en el historial</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Tipo</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-600">Módulos</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-600">Tamaño</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-600">Estado</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-3 px-4">
                      {new Date(item.fecha).toLocaleString('es-CL')}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        item.tipo === 'manual' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {item.tipo}
                      </span>
                    </td>
                    <td className="py-3 px-4">{item.modulos.length}</td>
                    <td className="py-3 px-4 text-right">
                      {(item.tamaño / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.exitoso ? (
                        <span className="flex items-center justify-center gap-1 text-emerald-600">
                          <CheckCircle size={16} />
                          Exitoso
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1 text-red-600">
                          <AlertTriangle size={16} />
                          Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Multi-empresa ──────────────────────────────────────── */}
      <Card title="Gestión Multi-Empresa">
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
            <Building2 size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Cambio de empresa con datos aislados</p>
              <p className="text-xs mt-1">Cada empresa usa su propio espacio de datos en este navegador. Al cambiar de empresa la página se recargará automáticamente.</p>
            </div>
          </div>

          {/* Empresa activa */}
          <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Building2 size={15} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Empresa activa</p>
              <p className="text-sm font-semibold text-emerald-900">
                {empresas.find(e => e.rut === empresaActiva)?.nombre ?? (empresaActiva === 'default' ? 'Empresa principal' : empresaActiva)}
              </p>
            </div>
            <span className="text-xs text-emerald-600 font-mono">{empresaActiva}</span>
          </div>

          {/* Lista de otras empresas */}
          {empresas.filter(e => e.rut !== empresaActiva).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Otras empresas</p>
              {empresas.filter(e => e.rut !== empresaActiva).map(emp => (
                <div key={emp.rut} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{emp.nombre}</p>
                    <p className="text-xs text-gray-500 font-mono">{emp.rut} · último acceso {new Date(emp.ultimoAcceso).toLocaleDateString('es-CL')}</p>
                  </div>
                  <button
                    onClick={() => switchEmpresa(emp.rut)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1E3A5F] text-white text-xs font-medium rounded-lg hover:bg-[#2D5A87] active:scale-[0.97] transition-[background-color,transform]"
                  >
                    <LogIn size={13} />
                    Cambiar
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Agregar nueva empresa */}
          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Registrar nueva empresa</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="RUT (ej: 76.123.456-7)"
                value={nuevoRut}
                onChange={e => setNuevoRut(e.target.value)}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <input
                type="text"
                placeholder="Nombre empresa"
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              <button
                onClick={() => {
                  if (!nuevoRut.trim() || !nuevoNombre.trim()) return;
                  const nueva: EmpresaRegistro = { rut: nuevoRut.trim(), nombre: nuevoNombre.trim(), ultimoAcceso: new Date().toISOString() };
                  const lista = [...empresas.filter(e => e.rut !== nueva.rut), nueva];
                  saveEmpresasList(lista);
                  setEmpresas(lista);
                  setNuevoRut('');
                  setNuevoNombre('');
                }}
                className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 active:scale-[0.97] transition-[background-color,transform]"
              >
                <Plus size={15} />
                Agregar
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

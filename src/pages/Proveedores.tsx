import React, { useMemo, useState } from 'react';
import { Users, Save, Upload, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card, Badge } from '../components/ui/Cards';
import { Button, SearchSelect, Textarea } from '../components/ui/FormElements';
import { Entidad } from '../types';
import { fetchEntidades, bulkUpsertEntidades, BulkEntidadResultado } from '../services/apiSync';
import { getErrorMessage } from '../services/errorHandler';

interface FilaMasiva {
  rut: string;
  razonSocial: string;
  cuentaId: string;
}

// Acepta lo que se pegue desde Excel (separado por tab) o por coma/punto y
// coma — solo exige rut y nombre; la cuenta se elige aparte en pantalla, no
// desde el texto pegado, para no depender de que el código/nombre de la
// cuenta esté escrito exactamente igual.
function parsearFilas(texto: string): { rut: string; razonSocial: string }[] {
  return texto
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => {
      const partes = linea.includes('\t') ? linea.split('\t') : linea.split(/[,;]/);
      return { rut: (partes[0] || '').trim(), razonSocial: (partes[1] || '').trim() };
    })
    .filter((f) => f.rut && f.razonSocial);
}

export default function Proveedores() {
  const { state, dispatch, showToast } = useApp();
  const [busqueda, setBusqueda] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [textoMasivo, setTextoMasivo] = useState('');
  const [cuentaGlobalId, setCuentaGlobalId] = useState('');
  const [filas, setFilas] = useState<FilaMasiva[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [resultados, setResultados] = useState<BulkEntidadResultado[]>([]);

  const proveedores = useMemo(() => {
    const lista = (state.entidades ?? []).filter((e: Entidad) => e.tipo === 'proveedor' || e.tipo === 'ambos');
    if (!busqueda.trim()) return lista;
    const q = busqueda.trim().toLowerCase();
    return lista.filter((e) => e.rut.toLowerCase().includes(q) || e.razonSocial.toLowerCase().includes(q));
  }, [state.entidades, busqueda]);

  const cuentasOptions = useMemo(() => [
    { value: '', label: 'Sin cuenta asociada' },
    ...state.cuentas
      .filter((c) => (c.tipo === 'gasto' || c.tipo === 'activo') && c.permiteMovimiento)
      .map((c) => ({ value: c.id, label: `${c.codigo} — ${c.nombre}` })),
  ], [state.cuentas]);

  const cuentaNombre = (id?: string) => cuentasOptions.find((c) => c.value === id)?.label;

  const cambiarCuentaExistente = (entidad: Entidad, cuentaId: string) => {
    dispatch({ type: 'UPDATE_ENTIDAD', payload: { ...entidad, cuentaDefaultId: cuentaId || undefined } });
    showToast('success', 'Cuenta actualizada', `${entidad.razonSocial} ahora usa ${cuentaId ? cuentaNombre(cuentaId) : 'ninguna cuenta por defecto'}.`);
    setEditandoId(null);
  };

  const procesarTexto = () => {
    const parseadas = parsearFilas(textoMasivo);
    if (parseadas.length === 0) {
      showToast('warning', 'Nada que procesar', 'Pega al menos una fila con RUT y nombre (separados por tab o coma).');
      return;
    }
    setFilas(parseadas.map((f) => ({ ...f, cuentaId: cuentaGlobalId })));
    setResultados([]);
  };

  const aplicarCuentaATodas = (cuentaId: string) => {
    setCuentaGlobalId(cuentaId);
    setFilas((actual) => actual.map((f) => ({ ...f, cuentaId })));
  };

  const cambiarCuentaFila = (index: number, cuentaId: string) => {
    setFilas((actual) => actual.map((f, i) => (i === index ? { ...f, cuentaId } : f)));
  };

  const quitarFila = (index: number) => {
    setFilas((actual) => actual.filter((_, i) => i !== index));
  };

  const guardarMasivo = async () => {
    if (filas.length === 0) return;
    setProcesando(true);
    try {
      const resultado = await bulkUpsertEntidades(
        filas.map((f) => ({ rut: f.rut, razonSocial: f.razonSocial, cuentaId: f.cuentaId || undefined })),
        'proveedor',
      );
      setResultados(resultado);
      const ok = resultado.filter((r) => r.ok).length;
      showToast(ok === resultado.length ? 'success' : 'warning', 'Carga masiva procesada', `${ok} de ${resultado.length} proveedor(es) guardados.`);
      const entidades = await fetchEntidades();
      dispatch({ type: 'LOAD_ENTIDADES', payload: { entidades } });
      if (ok === resultado.length) {
        setFilas([]);
        setTextoMasivo('');
      }
    } catch (err) {
      showToast('error', 'No se pudo procesar', getErrorMessage(err));
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-lg">
          <Users className="text-primary" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Proveedores</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            RUT, nombre y cuenta contable de cada proveedor — la misma cuenta se precarga automáticamente la próxima vez que se le compre.
          </p>
        </div>
      </div>

      <Card title="Carga masiva">
        <div className="space-y-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pega varias filas (una por proveedor) con RUT y nombre, separados por tabulador o coma — igual que copiar desde Excel.
            No importa si el RUT lleva puntos o no, se reconoce igual. Si ya existe un proveedor con ese RUT, se actualiza en vez de duplicarse.
          </p>
          <Textarea
            rows={5}
            placeholder={'12.345.678-9\tDistribuidora Ejemplo Ltda.\n76543210-5\tRepuestos y Cía SpA'}
            value={textoMasivo}
            onChange={(e) => setTextoMasivo(e.target.value)}
          />
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-80">
              <SearchSelect
                label="Cuenta contable para todas las filas (opcional)"
                value={cuentaGlobalId}
                onChange={aplicarCuentaATodas}
                options={cuentasOptions}
                placeholder="Elegir cuenta..."
              />
            </div>
            <Button variant="secondary" icon={<Upload size={16} />} onClick={procesarTexto}>Procesar filas</Button>
          </div>

          {filas.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">RUT</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Cuenta contable</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Resultado</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filas.map((f, i) => {
                      const res = resultados.find((r) => r.rut.replace(/[.\s-]/g, '').toUpperCase() === f.rut.replace(/[.\s-]/g, '').toUpperCase());
                      return (
                        <tr key={i}>
                          <td className="px-3 py-2 font-data text-gray-700 dark:text-gray-300">{f.rut}</td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{f.razonSocial}</td>
                          <td className="px-3 py-2 min-w-[220px]">
                            <SearchSelect value={f.cuentaId} onChange={(v) => cambiarCuentaFila(i, v)} options={cuentasOptions} placeholder="Elegir cuenta..." />
                          </td>
                          <td className="px-3 py-2 text-center">
                            {res && (res.ok
                              ? <Badge variant="success">{res.actualizado ? 'Actualizado' : 'Creado'}</Badge>
                              : <Badge variant="danger">{res.error}</Badge>)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button type="button" onClick={() => quitarFila(i)} className="text-gray-400 hover:text-red-600" aria-label="Quitar fila">
                              <XCircle size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button onClick={guardarMasivo} disabled={procesando} icon={<Save size={16} />}>
                {procesando ? 'Guardando...' : `Guardar ${filas.length} proveedor(es)`}
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card title={`Proveedores registrados (${proveedores.length})`} padding="none">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por RUT o nombre..."
            className="w-full sm:w-80 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">RUT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cuenta contable asociada</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {proveedores.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-500 dark:text-gray-400">No hay proveedores registrados todavía — se crean automáticamente al ingresar una compra, o con la carga masiva de arriba.</td></tr>
              ) : (
                proveedores.map((e) => (
                  <tr key={e.id} className="odd:bg-gray-50/50 dark:odd:bg-gray-800/30">
                    <td className="px-4 py-3 font-data text-gray-600 dark:text-gray-300">{e.rut}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{e.razonSocial}</td>
                    <td className="px-4 py-3 min-w-[240px]">
                      {editandoId === e.id ? (
                        <SearchSelect
                          value={e.cuentaDefaultId || ''}
                          onChange={(v) => cambiarCuentaExistente(e, v)}
                          options={cuentasOptions}
                          placeholder="Elegir cuenta..."
                        />
                      ) : (
                        <span className={e.cuentaDefaultId ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 italic'}>
                          {e.cuentaDefaultId ? cuentaNombre(e.cuentaDefaultId) : 'Sin cuenta asociada'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editandoId === e.id ? (
                        <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)}>Listo</Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => setEditandoId(e.id)}>Cambiar cuenta</Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

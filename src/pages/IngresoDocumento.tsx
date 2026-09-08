import React, { useMemo, useState } from 'react';
import { FileCheck, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/Cards';
import { Button, Input, Select, SearchSelect, MontoInput } from '../components/ui/FormElements';
import { RETENCION_HONORARIOS } from '../data/normativa';
import { Entidad } from '../types';
import { formatCurrency } from '../utils/calculos';
import { ingresoDocumento, IngresoDocumentoPayload } from '../services/apiSync';

// Cada opción combina el tipo de documento SII con su dirección
// (venta/compra) — son dos ejes independientes en el modelo de datos, pero
// para quien ingresa un documento a mano es más natural elegirlos juntos.
type OpcionTipo = {
  value: string;
  label: string;
  tipoDocumento: IngresoDocumentoPayload['tipoDocumento'];
  tipoTransaccion?: 'venta' | 'compra';
};

const OPCIONES_TIPO: OpcionTipo[] = [
  { value: 'factura_venta', label: 'Factura de venta', tipoDocumento: 'factura', tipoTransaccion: 'venta' },
  { value: 'factura_compra', label: 'Factura de compra', tipoDocumento: 'factura', tipoTransaccion: 'compra' },
  { value: 'factura_exenta_venta', label: 'Factura exenta de venta', tipoDocumento: 'factura_exenta', tipoTransaccion: 'venta' },
  { value: 'factura_exenta_compra', label: 'Factura exenta de compra', tipoDocumento: 'factura_exenta', tipoTransaccion: 'compra' },
  { value: 'boleta', label: 'Boleta', tipoDocumento: 'boleta', tipoTransaccion: 'venta' },
  { value: 'boleta_honorarios', label: 'Boleta de honorarios', tipoDocumento: 'honorario' },
  { value: 'nota_credito_venta', label: 'Nota de crédito de venta', tipoDocumento: 'nota_credito', tipoTransaccion: 'venta' },
  { value: 'nota_credito_compra', label: 'Nota de crédito de compra', tipoDocumento: 'nota_credito', tipoTransaccion: 'compra' },
  { value: 'nota_debito_venta', label: 'Nota de débito de venta', tipoDocumento: 'nota_debito', tipoTransaccion: 'venta' },
  { value: 'nota_debito_compra', label: 'Nota de débito de compra', tipoDocumento: 'nota_debito', tipoTransaccion: 'compra' },
];

const hoy = () => new Date().toISOString().slice(0, 10);
const sumarDias = (fecha: string, dias: number) => {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

export default function IngresoDocumento() {
  const { state, dispatch, showToast } = useApp();

  const [tipoSel, setTipoSel] = useState('factura_venta');
  const opcion = OPCIONES_TIPO.find(o => o.value === tipoSel)!;
  const esHonorario = opcion.tipoDocumento === 'honorario';
  const esCompra = opcion.tipoTransaccion === 'compra';

  const [folio, setFolio] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [fechaVencimiento, setFechaVencimiento] = useState(sumarDias(hoy(), 30));
  const [periodo, setPeriodo] = useState(hoy().slice(0, 7));

  const [rutBusqueda, setRutBusqueda] = useState('');
  const [rut, setRut] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [giro, setGiro] = useState('');
  const [direccion, setDireccion] = useState('');

  const [cuentaGastoId, setCuentaGastoId] = useState('');

  const [neto, setNeto] = useState(0);
  const [exento, setExento] = useState(0);
  const [iva, setIva] = useState(0);
  const total = neto + exento + iva;

  const [montoBruto, setMontoBruto] = useState(0);
  const retencion = Math.round(montoBruto * RETENCION_HONORARIOS.TASA_NORMA) / 100;
  const montoLiquido = montoBruto - retencion;

  const [guardando, setGuardando] = useState(false);

  const entidadesOptions = useMemo(() => [
    { value: '', label: 'Buscar cliente/proveedor existente...' },
    ...(state.entidades ?? []).map((e: Entidad) => ({ value: e.id, label: `${e.rut} — ${e.razonSocial}` })),
  ], [state.entidades]);

  const cuentasGastoOptions = useMemo(() => [
    { value: '', label: 'Seleccionar cuenta...' },
    ...state.cuentas
      .filter(c => (c.tipo === 'gasto' || c.tipo === 'activo') && c.permiteMovimiento)
      .map(c => ({ value: c.id, label: `${c.codigo} - ${c.nombre}` })),
  ], [state.cuentas]);

  const seleccionarEntidad = (entidadId: string) => {
    setRutBusqueda(entidadId);
    const e = (state.entidades ?? []).find((x: Entidad) => x.id === entidadId);
    if (e) {
      setRut(e.rut);
      setRazonSocial(e.razonSocial);
      setGiro(e.giro || '');
      setDireccion(e.direccion || '');
    }
  };

  const limpiarFormulario = () => {
    setFolio('');
    setRutBusqueda('');
    setRut('');
    setRazonSocial('');
    setGiro('');
    setDireccion('');
    setCuentaGastoId('');
    setNeto(0);
    setExento(0);
    setIva(0);
    setMontoBruto(0);
  };

  const handleGuardar = async () => {
    if (!rut.trim() || !razonSocial.trim()) {
      showToast('error', 'Falta información', 'Ingresa el RUT y la razón social del cliente/proveedor.');
      return;
    }
    if (esHonorario) {
      if (montoBruto <= 0) {
        showToast('error', 'Falta información', 'Ingresa el monto bruto de la boleta de honorarios.');
        return;
      }
    } else {
      if (!folio.trim()) {
        showToast('error', 'Falta información', 'Ingresa el folio del documento.');
        return;
      }
      if (total <= 0) {
        showToast('error', 'Falta información', 'Los montos no pueden estar todos en cero.');
        return;
      }
      if (esCompra && (neto + exento) > 0 && !cuentaGastoId) {
        showToast('error', 'Falta información', 'Elige la cuenta de gasto o activo para esta compra.');
        return;
      }
    }

    setGuardando(true);
    try {
      const payload: IngresoDocumentoPayload = {
        tipoDocumento: opcion.tipoDocumento,
        tipoTransaccion: opcion.tipoTransaccion,
        fecha,
        fechaVencimiento: esHonorario ? undefined : fechaVencimiento,
        entidad: { rut: rut.trim(), razonSocial: razonSocial.trim(), giro: giro || undefined, direccion: direccion || undefined },
        ...(esHonorario
          ? { periodo, montoBruto, retencion, montoLiquido }
          : { folio: Number(folio), neto, exento, iva, total, cuentaGastoId: esCompra ? cuentaGastoId : undefined }),
      };
      const resultado = await ingresoDocumento(payload);
      // Refresca la cuenta local de la entidad (creada/actualizada por el
      // servidor) sin esperar al proximo fetch completo.
      dispatch({ type: 'ADD_ENTIDAD', payload: resultado.entidad });
      showToast('success', 'Documento ingresado',
        `Asiento N° ${resultado.asiento.numero} generado por ${formatCurrency(esHonorario ? montoLiquido + retencion : total)}.`);
      limpiarFormulario();
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error al ingresar el documento';
      showToast('error', 'No se pudo guardar', mensaje);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary/10 rounded-lg">
          <FileCheck className="text-primary" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ingreso de Documentos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Cada documento genera su asiento contable automáticamente y alimenta la cuenta corriente del cliente/proveedor.
          </p>
        </div>
      </div>

      <Card title="1. Tipo de documento">
        <Select
          value={tipoSel}
          onChange={e => setTipoSel(e.target.value)}
          options={OPCIONES_TIPO.map(o => ({ value: o.value, label: o.label }))}
        />
      </Card>

      <Card title="2. Datos del documento">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {esHonorario ? (
            <Input
              type="month"
              label="Período"
              value={periodo}
              onChange={e => setPeriodo(e.target.value)}
            />
          ) : (
            <Input
              type="number"
              label="Folio"
              placeholder="N° de documento"
              value={folio}
              onChange={e => setFolio(e.target.value)}
            />
          )}
          <Input
            type="date"
            label="Fecha"
            value={fecha}
            onChange={e => { setFecha(e.target.value); setFechaVencimiento(sumarDias(e.target.value, 30)); }}
          />
          {!esHonorario && <Input type="date" label="Fecha de vencimiento" value={fechaVencimiento} min={fecha} onChange={e => setFechaVencimiento(e.target.value)} />}
        </div>
      </Card>

      <Card title={`3. ${esCompra ? 'Proveedor' : esHonorario ? 'Prestador de servicios' : 'Cliente'}`}>
        <div className="space-y-4">
          <SearchSelect
            value={rutBusqueda}
            onChange={seleccionarEntidad}
            options={entidadesOptions}
            placeholder="Buscar existente por RUT o nombre..."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="RUT" placeholder="12.345.678-9" value={rut} onChange={e => { setRut(e.target.value); setRutBusqueda(''); }} />
            <Input label="Razón Social" placeholder="Nombre o razón social" value={razonSocial} onChange={e => { setRazonSocial(e.target.value); setRutBusqueda(''); }} />
            <Input label="Giro (opcional)" value={giro} onChange={e => setGiro(e.target.value)} />
            <Input label="Dirección (opcional)" value={direccion} onChange={e => setDireccion(e.target.value)} />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Si el RUT no existe, se crea automáticamente. Si ya existe, se actualiza con estos datos.
          </p>
        </div>
      </Card>

      {esCompra && (
        <Card title="4. Cuenta de gasto/activo">
          <SearchSelect
            value={cuentaGastoId}
            onChange={setCuentaGastoId}
            options={cuentasGastoOptions}
            placeholder="Seleccionar cuenta..."
          />
        </Card>
      )}

      <Card title={`${esCompra ? '5' : '4'}. Montos`}>
        {esHonorario ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MontoInput label="Monto Bruto" value={montoBruto} onChange={setMontoBruto} />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Retención ({RETENCION_HONORARIOS.TASA_NORMA}%)
              </label>
              <p className="font-data text-lg font-semibold text-red-600 dark:text-red-400 py-2">{formatCurrency(retencion)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Monto Líquido</label>
              <p className="font-data text-lg font-semibold text-emerald-700 dark:text-emerald-400 py-2">{formatCurrency(montoLiquido)}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MontoInput label="Neto" value={neto} onChange={setNeto} />
            <MontoInput label="Exento" value={exento} onChange={setExento} />
            <MontoInput label="IVA" value={iva} onChange={setIva} />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Total</label>
              <p className="font-data text-lg font-bold text-primary dark:text-blue-400 py-2">{formatCurrency(total)}</p>
            </div>
          </div>
        )}
      </Card>

      <Button onClick={handleGuardar} disabled={guardando} icon={guardando ? <Loader2 className="animate-spin" size={16} /> : <FileCheck size={16} />} className="w-full py-3">
        {guardando ? 'Guardando...' : 'Guardar e ingresar asiento'}
      </Button>
    </div>
  );
}

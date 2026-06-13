import React, { useState } from 'react';
import { FileText, QrCode, Shield, Download, Send, Check, AlertCircle, Building2, User } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { Button, Input, Select, Textarea } from '../components/ui/FormElements';

interface DteData {
  tipo: 'factura' | 'boleta' | 'nota_credito' | 'nota_debito';
  folio: number;
  rutEmisor: string;
  rutReceptor: string;
  razonReceptor: string;
  giroReceptor: string;
  direccion: string;
  comuna: string;
  montoNeto: number;
  iva: number;
  montoTotal: number;
  fechaEmision: string;
  fechaVencimiento: string;
  glosa: string;
}

const TIPOS_DTE = [
  { value: 'factura', label: 'Factura Electrónica (33)' },
  { value: 'boleta', label: 'Boleta Electrónica (39)' },
  { value: 'nota_credito', label: 'Nota de Crédito (61)' },
  { value: 'nota_debito', label: 'Nota de Débito (56)' },
];

export const DteGenerator: React.FC = () => {
  const [data, setData] = useState<DteData>({
    tipo: 'factura',
    folio: 0,
    rutEmisor: '76543210-5',
    rutReceptor: '',
    razonReceptor: '',
    giroReceptor: '',
    direccion: '',
    comuna: '',
    montoNeto: 0,
    iva: 0,
    montoTotal: 0,
    fechaEmision: new Date().toISOString().slice(0, 10),
    fechaVencimiento: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    glosa: '',
  });
  const [generado, setGenerado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const calcularIVA = (neto: number) => {
    const iva = Math.round(neto * 0.19);
    setData(prev => ({ ...prev, montoNeto: neto, iva, montoTotal: neto + iva }));
  };

  const generarDTE = () => {
    setGenerado(true);
    // En producción: enviar al SII real
  };

  const enviarSII = async () => {
    setEnviando(true);
    try {
      // Simular envío al SII
      await new Promise(r => setTimeout(r, 2000));
      setEnviando(false);
      alert('DTE enviado al SII exitosamente ✅');
    } catch {
      setEnviando(false);
      alert('Error al enviar al SII');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <FileText className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-xl font-bold">Generación de DTE</h2>
          <p className="text-sm text-gray-500">Documento Tributario Electrónico - SII Chile</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              Datos del Documento
            </h3>
            
            <Select
              label="Tipo DTE"
              value={data.tipo}
              onChange={e => setData(prev => ({ ...prev, tipo: e.target.value as DteData['tipo'] }))}
              options={TIPOS_DTE}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input label="Folio" type="number" value={data.folio} onChange={e => setData(prev => ({ ...prev, folio: Number(e.target.value) }))} />
              <Input label="RUT Emisor" value={data.rutEmisor} disabled />
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Datos del Receptor
              </h4>
              <div className="space-y-3">
                <Input label="RUT Receptor" value={data.rutReceptor} onChange={e => setData(prev => ({ ...prev, rutReceptor: e.target.value }))} placeholder="12.345.678-5" />
                <Input label="Razón Social" value={data.razonReceptor} onChange={e => setData(prev => ({ ...prev, razonReceptor: e.target.value }))} />
                <Input label="Giro" value={data.giroReceptor} onChange={e => setData(prev => ({ ...prev, giroReceptor: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Dirección" value={data.direccion} onChange={e => setData(prev => ({ ...prev, direccion: e.target.value }))} />
                  <Input label="Comuna" value={data.comuna} onChange={e => setData(prev => ({ ...prev, comuna: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-600" />
                Montos e Impuestos
              </h3>

              <Input label="Monto Neto" type="number" value={data.montoNeto} onChange={e => calcularIVA(Number(e.target.value))} prefix="$" />
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600">IVA 19%</p>
                  <p className="text-lg font-bold text-blue-700">${data.iva.toLocaleString('es-CL')}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-600">Total</p>
                  <p className="text-lg font-bold text-green-700">${data.montoTotal.toLocaleString('es-CL')}</p>
                </div>
              </div>

              <Input label="Glosa" value={data.glosa} onChange={e => setData(prev => ({ ...prev, glosa: e.target.value }))} placeholder="Descripción del documento..." />

              <div className="grid grid-cols-2 gap-3">
                <Input label="Fecha Emisión" type="date" value={data.fechaEmision} onChange={e => setData(prev => ({ ...prev, fechaEmision: e.target.value }))} />
                <Input label="Fecha Vencimiento" type="date" value={data.fechaVencimiento} onChange={e => setData(prev => ({ ...prev, fechaVencimiento: e.target.value }))} />
              </div>
            </div>
          </Card>

          {generado && (
            <Card>
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <Check className="w-5 h-5" />
                  <span className="font-semibold">DTE Generado Exitosamente</span>
                </div>
                <p className="text-sm text-green-600 mb-3">
                  Folio: {data.folio} · Tipo: {data.tipo} · Total: ${data.montoTotal.toLocaleString('es-CL')}
                </p>
                <div className="flex gap-2">
                  <Button variant="primary" onClick={enviarSII} disabled={enviando}>
                    {enviando ? 'Enviando...' : <><Send className="w-3 h-3 mr-1" />Enviar al SII</>}
                  </Button>
                  <Button variant="secondary"><Download className="w-3 h-3 mr-1" />PDF</Button>
                  <Button variant="secondary"><QrCode className="w-3 h-3" /></Button>
                </div>
              </div>
            </Card>
          )}

          {!generado && (
            <Button variant="primary" onClick={generarDTE} className="w-full py-3">
              <FileText className="w-4 h-4 mr-2" />
              Generar DTE
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

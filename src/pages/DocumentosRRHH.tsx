import React, { useState } from 'react';
import { FileText, Download, UserMinus, FileSignature, Building2, Calendar } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { formatCurrency, formatDate, formatRUT } from '../utils/calculos';
import { useApp } from '../context/AppContext';

export default function DocumentosRRHH() {
  const { state } = useApp();
  const [tab, setTab] = useState<'contratos' | 'finiquitos'>('contratos');
  const [trabajadorSeleccionado, setTrabajadorSeleccionado] = useState<string>('');

  const trabajador = state.trabajadores.find(t => t.id === trabajadorSeleccionado);
  const empresa = state.configuracion;

  const generarContratoPDF = () => {
    if (!trabajador) return;
    
    // Generación de un HTML simple para impresión simulando PDF
    const content = `
      <div style="font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; max-width: 800px; margin: 0 auto;">
        <h2 style="text-align: center; text-decoration: underline;">CONTRATO DE TRABAJO</h2>
        <br/>
        <p>En la ciudad de <strong>${empresa.ciudad || 'Santiago'}</strong>, a <strong>${formatDate(trabajador.fechaIngreso)}</strong>, entre la empresa <strong>${empresa.razonSocial}</strong>, R.U.T. <strong>${empresa.rut}</strong>, representada legalmente por don/ña <strong>${empresa.representanteLegal || '______________'}</strong>, R.U.T. <strong>${empresa.rutRepresentante || '______________'}</strong>, ambos domiciliados en <strong>${empresa.direccion}</strong>, comuna de <strong>${empresa.comuna}</strong>, en adelante "el Empleador"; y don/ña <strong>${trabajador.nombre}</strong>, R.U.T. <strong>${formatRUT(trabajador.rut)}</strong>, domiciliado en ____________________________________, en adelante "el Trabajador", se ha convenido el siguiente contrato de trabajo:</p>
        
        <p><strong>PRIMERO:</strong> El Trabajador se compromete a prestar servicios como <strong>${trabajador.cargo || 'Funcionario'}</strong>, debiendo realizar todas las labores inherentes a dicho cargo.</p>
        
        <p><strong>SEGUNDO:</strong> La jornada de trabajo será de 44 horas semanales, distribuidas de lunes a viernes.</p>
        
        <p><strong>TERCERO:</strong> El Empleador pagará al Trabajador un Sueldo Base mensual de <strong>${formatCurrency(trabajador.sueldoBase)}</strong>, liquidado y pagado el último día hábil de cada mes.</p>
        
        <br/><br/><br/>
        <div style="display: flex; justify-content: space-between; margin-top: 50px;">
          <div style="text-align: center; width: 45%; border-top: 1px solid black; padding-top: 10px;">
            <strong>${empresa.razonSocial}</strong><br/>Empleador
          </div>
          <div style="text-align: center; width: 45%; border-top: 1px solid black; padding-top: 10px;">
            <strong>${trabajador.nombre}</strong><br/>Trabajador
          </div>
        </div>
      </div>
    `;

    const ventana = window.open('', '_blank');
    ventana?.document.write(content);
    ventana?.document.close();
    ventana?.focus();
    setTimeout(() => ventana?.print(), 500);
  };

  const generarFiniquitoPDF = () => {
    if (!trabajador) return;
    
    // Cálculo básico de finiquito (Mes de aviso + Vacaciones + Años de servicio)
    const sueldoBase = trabajador.sueldoBase;
    const aniosServicio = Math.max(0, new Date().getFullYear() - new Date(trabajador.fechaIngreso).getFullYear());
    const indemnizacionAnios = aniosServicio * sueldoBase;
    const mesAviso = sueldoBase;
    const vacacionesProporcionales = sueldoBase * 0.5; // Estimado genérico
    const totalFiniquito = indemnizacionAnios + mesAviso + vacacionesProporcionales;

    const content = `
      <div style="font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; max-width: 800px; margin: 0 auto;">
        <h2 style="text-align: center; text-decoration: underline;">FINIQUITO DE CONTRATO DE TRABAJO</h2>
        <br/>
        <p>En la ciudad de <strong>${empresa.ciudad || 'Santiago'}</strong>, a <strong>${formatDate(new Date())}</strong>, comparecen <strong>${empresa.razonSocial}</strong>, R.U.T. <strong>${empresa.rut}</strong>, en adelante "el Empleador"; y don/ña <strong>${trabajador.nombre}</strong>, R.U.T. <strong>${formatRUT(trabajador.rut)}</strong>, en adelante "el Trabajador", y exponen lo siguiente:</p>
        
        <p><strong>PRIMERO:</strong> El Trabajador prestó servicios para el Empleador desde el <strong>${formatDate(trabajador.fechaIngreso)}</strong> hasta el día de hoy, desempeñando el cargo de <strong>${trabajador.cargo || 'Funcionario'}</strong>.</p>
        
        <p><strong>SEGUNDO:</strong> El contrato de trabajo ha terminado por la causal del Artículo 161 del Código del Trabajo (Necesidades de la Empresa).</p>
        
        <p><strong>TERCERO: LIQUIDACIÓN DE PAGOS</strong></p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px;">
          <tr>
            <td style="border: 1px solid #ccc; padding: 8px;">Indemnización Sustitutiva Mes de Aviso</td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">${formatCurrency(mesAviso)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ccc; padding: 8px;">Indemnización por Años de Servicio (${aniosServicio} años)</td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">${formatCurrency(indemnizacionAnios)}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #ccc; padding: 8px;">Feriado Proporcional (Vacaciones)</td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">${formatCurrency(vacacionesProporcionales)}</td>
          </tr>
          <tr style="background-color: #f0f0f0; font-weight: bold;">
            <td style="border: 1px solid #ccc; padding: 8px;">TOTAL A PAGAR AL TRABAJADOR</td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">${formatCurrency(totalFiniquito)}</td>
          </tr>
        </table>
        
        <br/><br/><br/>
        <div style="display: flex; justify-content: space-between; margin-top: 50px;">
          <div style="text-align: center; width: 45%; border-top: 1px solid black; padding-top: 10px;">
            <strong>${empresa.razonSocial}</strong><br/>Empleador
          </div>
          <div style="text-align: center; width: 45%; border-top: 1px solid black; padding-top: 10px;">
            <strong>${trabajador.nombre}</strong><br/>Trabajador
          </div>
        </div>
      </div>
    `;

    const ventana = window.open('', '_blank');
    ventana?.document.write(content);
    ventana?.document.close();
    ventana?.focus();
    setTimeout(() => ventana?.print(), 500);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#1E3A5F]/10 rounded-lg">
            <FileSignature className="text-[#1E3A5F]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Documentos RRHH</h1>
            <p className="text-sm text-gray-500 mt-1">Generación de Contratos, Anexos y Finiquitos para {empresa.nombreFantasia}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('contratos')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            tab === 'contratos' ? 'bg-[#1E3A5F] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <FileText size={18} /> Contratos y Anexos
        </button>
        <button
          onClick={() => setTab('finiquitos')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            tab === 'finiquitos' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <UserMinus size={18} /> Finiquitos
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Seleccionar Trabajador</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
            {state.trabajadores.map(t => (
              <div 
                key={t.id} 
                onClick={() => setTrabajadorSeleccionado(t.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  trabajadorSeleccionado === t.id 
                    ? tab === 'contratos' ? 'bg-blue-50 border-blue-300' : 'bg-red-50 border-red-300'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                <p className="font-medium text-gray-900 text-sm">{t.nombre}</p>
                <p className="text-xs text-gray-500">{t.rut}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="col-span-2">
          {!trabajador ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
              <FileSignature size={48} className="mb-4 opacity-20" />
              <p>Seleccione un trabajador para generar documentos</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold text-xl">
                  {trabajador.nombre.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{trabajador.nombre}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-2">
                    <Building2 size={14} /> {empresa.razonSocial}
                  </p>
                </div>
              </div>

              {tab === 'contratos' ? (
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-800">Documentos de Contratación Disponibles</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors bg-gray-50">
                      <FileText className="text-blue-600 mb-2" size={24} />
                      <h5 className="font-bold text-sm text-gray-900">Contrato de Trabajo Estándar</h5>
                      <p className="text-xs text-gray-500 mb-4 mt-1">Genera el contrato legal con los datos del trabajador y la empresa activa.</p>
                      <button onClick={generarContratoPDF} className="w-full py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center justify-center gap-2">
                        <Download size={16} /> Generar PDF
                      </button>
                    </div>
                    
                    <div className="border border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-colors bg-gray-50 opacity-60">
                      <FileText className="text-gray-600 mb-2" size={24} />
                      <h5 className="font-bold text-sm text-gray-900">Anexo de Contrato</h5>
                      <p className="text-xs text-gray-500 mb-4 mt-1">Modificación de renta, cargo o jornada laboral.</p>
                      <button disabled className="w-full py-2 bg-gray-100 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed flex items-center justify-center gap-2">
                        En Desarrollo
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="font-medium text-red-800">Simulador de Término de Contrato</h4>
                  
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100 space-y-3 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Fecha de Ingreso:</span>
                      <span className="font-medium">{formatDate(trabajador.fechaIngreso)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Sueldo Base (Base Cálculo):</span>
                      <span className="font-medium">{formatCurrency(trabajador.sueldoBase)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Años de Servicio Calculados:</span>
                      <span className="font-medium text-red-700 font-bold">
                        {Math.max(0, new Date().getFullYear() - new Date(trabajador.fechaIngreso).getFullYear())} Años
                      </span>
                    </div>
                  </div>

                  <button onClick={generarFiniquitoPDF} className="w-full py-3 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-sm">
                    <Download size={18} /> Calcular y Generar Finiquito PDF
                  </button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

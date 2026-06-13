import React, { useState, useMemo } from 'react';
import { FileText, Download, AlertCircle, Info, Landmark, CheckCircle, CreditCard, Edit2, Check } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/calculos';

interface DatosBancoTrabajador {
  trabajadorId: string;
  banco: '001' | '037' | '012' | '039'; // Chile, Santander, Estado, Itaú
  tipoCuenta: 'CC' | 'CV' | 'CA'; // Corriente, Vista, Ahorro
  numeroCuenta: string;
}

export default function Previred() {
  const { state, showToast } = useApp();
  const [mes, setMes] = useState<number>(new Date().getMonth() + 1);
  const [anio, setAnio] = useState<number>(new Date().getFullYear());
  const [tabActiva, setTabActiva] = useState<'previred' | 'nominas'>('previred');
  const [bancoSeleccionado, setBancoSeleccionado] = useState<'chile' | 'santander'>('chile');

  // Estado para detalles de banco de trabajadores (guardado en memoria local de la vista)
  const [bancosTrabajadores, setBancosTrabajadores] = useState<Record<string, DatosBancoTrabajador>>({});
  const [editandoTrabajadorId, setEditandoTrabajadorId] = useState<string | null>(null);

  // Rut helper (divide RUT en base y DV)
  const splitRut = (rutFull: string) => {
    const clean = rutFull.replace(/\./g, '').replace(/-/g, '').toUpperCase();
    const base = clean.slice(0, -1);
    const dv = clean.slice(-1);
    return { base, dv };
  };

  const periodoKey = useMemo(() => {
    return `${anio}-${mes.toString().padStart(2, '0')}`;
  }, [mes, anio]);

  // Liquidación del período seleccionado
  const liqPeriodo = useMemo(() => {
    return (state.liquidaciones ?? []).find((l: any) => l.periodo === periodoKey);
  }, [state.liquidaciones, periodoKey]);

  // Lista de trabajadores procesados o activos para mostrar en las nóminas
  const listaPagos = useMemo(() => {
    if (liqPeriodo) {
      return liqPeriodo.lineas.map((linea: any) => {
        const trabajador = state.trabajadores.find((t: any) => t.id === linea.trabajadorId || t.rut === linea.rut);
        return {
          id: linea.trabajadorId || trabajador?.id || Math.random().toString(),
          rut: linea.rut,
          nombre: `${linea.nombre} ${linea.apellidos}`,
          montoLiquido: linea.sueldoLiquido,
          cargo: linea.cargo,
        };
      });
    } else {
      // Fallback si no hay liquidación, estimación con sueldo base
      return state.trabajadores
        .filter((t: any) => (t.estado ?? 'activo') === 'activo')
        .map((t: any) => ({
          id: t.id,
          rut: t.rut,
          nombre: `${t.nombre} ${t.apellidos}`,
          montoLiquido: Math.round(t.sueldoBase * 0.8), // Estimación del 80% bruto
          cargo: t.cargo,
        }));
    }
  }, [liqPeriodo, state.trabajadores]);

  // Obtener o inicializar los datos bancarios del trabajador
  const getDatosBanco = (trabajadorId: string, rut: string): DatosBancoTrabajador => {
    if (bancosTrabajadores[trabajadorId]) {
      return bancosTrabajadores[trabajadorId];
    }
    // Generación determinista basada en el RUT
    const cleanRut = rut.replace(/\D/g, '');
    const num = parseInt(cleanRut) || 12345678;
    const banco: DatosBancoTrabajador['banco'] = num % 4 === 0 ? '001' : num % 4 === 1 ? '037' : num % 4 === 2 ? '012' : '039';
    const tipoCuenta: DatosBancoTrabajador['tipoCuenta'] = num % 3 === 0 ? 'CC' : num % 3 === 1 ? 'CV' : 'CA';
    const numeroCuenta = String((num * 7) % 1000000000).padStart(8, '0');

    return {
      trabajadorId,
      banco,
      tipoCuenta,
      numeroCuenta
    };
  };

  const handleSaveBanco = (trabajadorId: string, updates: Partial<DatosBancoTrabajador>) => {
    setBancosTrabajadores(prev => {
      const current = prev[trabajadorId] || getDatosBanco(trabajadorId, listaPagos.find(p => p.id === trabajadorId)?.rut || '');
      return {
        ...prev,
        [trabajadorId]: {
          ...current,
          ...updates
        }
      };
    });
  };

  // Mapeos de códigos de Previred
  const mapAfpPreviredCode = (afpNombre: string) => {
    const nom = afpNombre.toLowerCase();
    if (nom.includes('capital')) return '33';
    if (nom.includes('cuprum')) return '03';
    if (nom.includes('habitat')) return '05';
    if (nom.includes('planvital') || nom.includes('plan')) return '08';
    if (nom.includes('provida')) return '09';
    if (nom.includes('modelo')) return '34';
    if (nom.includes('uno')) return '35';
    return '00';
  };

  const mapSaludPreviredCode = (isapreId: string) => {
    const id = isapreId.toLowerCase();
    if (id === 'fonasa' || id.includes('fonasa')) return '7';
    if (id.includes('colmena')) return '67';
    if (id.includes('consalud')) return '78';
    if (id.includes('cruz') || id.includes('blanca')) return '71';
    if (id.includes('masvida') || id.includes('nueva')) return '81';
    if (id.includes('banmedica')) return '62';
    if (id.includes('vida') || id.includes('tres')) return '88';
    return '7'; // default Fonasa
  };

  // Generador Previred (105 campos)
  const generarArchivoPrevired = () => {
    const empresaRutParts = splitRut(state.configuracion?.rut || '76.123.456-7');
    const periodo = `${mes.toString().padStart(2, '0')}${anio}`; // MMYYYY

    let csvContent = "";

    // Si hay liquidación procesada, usamos los datos reales
    if (liqPeriodo && liqPeriodo.lineas.length > 0) {
      liqPeriodo.lineas.forEach((linea: any) => {
        const trabajador = state.trabajadores.find((t: any) => t.id === linea.trabajadorId || t.rut === linea.rut);
        const tRutParts = splitRut(linea.rut);
        const nombresArr = (trabajador?.nombre || linea.nombre).split(' ');
        const apellidosArr = (trabajador?.apellidos || linea.apellidos).split(' ');
        
        const apPaterno = apellidosArr[0] || '';
        const apMaterno = apellidosArr[1] || '';
        const nombres = nombresArr.join(' ') || '';

        const fila = new Array(105).fill('');

        // Datos de la Empresa y Periodo
        fila[0] = empresaRutParts.base;     // 1. RUT Empresa
        fila[1] = empresaRutParts.dv;       // 2. DV Empresa
        fila[2] = periodo;                  // 3. Periodo de Remuneraciones

        // Datos del Trabajador
        fila[3] = tRutParts.base;           // 4. RUT Trabajador
        fila[4] = tRutParts.dv;             // 5. DV Trabajador
        fila[5] = apPaterno.slice(0, 30);   // 6. Apellido Paterno
        fila[6] = apMaterno.slice(0, 30);   // 7. Apellido Materno
        fila[7] = nombres.slice(0, 30);     // 8. Nombres
        fila[8] = 'M';                      // 9. Sexo (M o F)
        fila[9] = '1';                      // 10. Nacionalidad (1: Chilena)
        fila[10] = '0';                     // 11. Tipo de Pago (0: Normal)
        fila[11] = periodo;                 // 12. Periodo Desde
        fila[12] = periodo;                 // 13. Periodo Hasta
        fila[13] = '0';                     // 14. Código Régimen (0: AFP, 1: INP)

        // Remuneraciones y Movimientos
        fila[14] = '00';                            // 15. Tipo Trabajador
        fila[15] = String(linea.diasTrabajados);     // 16. Días Trabajados
        fila[16] = '0';                             // 17. Código Tipo Línea
        fila[17] = '0';                             // 18. Código Movimiento
        fila[18] = '';                              // 19. Fecha Desde (Movimiento)
        fila[19] = '';                              // 20. Fecha Hasta (Movimiento)

        // AFP
        fila[20] = mapAfpPreviredCode(linea.afpNombre);       // 21. Código AFP
        fila[21] = Math.round(linea.totalImponible).toString(); // 22. Monto Imponible AFP

        // Isapre / Fonasa (Salud)
        const saludCode = mapSaludPreviredCode(trabajador?.isapreId || 'fonasa');
        fila[22] = saludCode;                                  // 23. Código Institución Salud
        fila[23] = Math.round(linea.totalImponible).toString(); // 24. Monto Imponible Salud
        fila[24] = Math.round(linea.salud).toString();          // 25. Monto Salud (Pactado/Fonasa)

        // Seguro Cesantía (AFC)
        fila[25] = trabajador?.tipoContrato === 'honorarios' ? '1' : '0'; // 26. Seguro Cesantía (0: Si, 1: No)
        fila[26] = Math.round(linea.totalImponible).toString(); // 27. Renta Imponible Seguro Cesantía
        fila[27] = Math.round(linea.afc).toString();            // 28. Aporte Trabajador AFC
        fila[28] = Math.round(linea.afcEmpleador).toString();   // 29. Aporte Empleador AFC

        // SIS y Mutual
        fila[29] = Math.round(linea.sisEmpleador).toString();   // 30. Aporte SIS Empleador
        fila[30] = '3';                                         // 31. Código Mutualidad (3 = Mutual de Seguridad)
        fila[31] = Math.round(linea.mutual).toString();         // 32. Aporte Mutual

        for (let i = 32; i < 105; i++) {
          if (fila[i] === '') fila[i] = '0';
        }

        csvContent += fila.join(';') + '\n';
      });
    } else {
      // Fallback a trabajadores registrados usando sueldo base
      state.trabajadores.forEach(trabajador => {
        const tRutParts = splitRut(trabajador.rut);
        const nombresArr = trabajador.nombre.split(' ');
        const apellidosArr = trabajador.apellidos.split(' ');
        
        const apPaterno = apellidosArr[0] || '';
        const apMaterno = apellidosArr[1] || '';
        const nombres = nombresArr.join(' ') || '';

        const fila = new Array(105).fill('');

        // Datos de la Empresa y Periodo
        fila[0] = empresaRutParts.base;     // 1. RUT Empresa
        fila[1] = empresaRutParts.dv;       // 2. DV Empresa
        fila[2] = periodo;                  // 3. Periodo de Remuneraciones

        // Datos del Trabajador
        fila[3] = tRutParts.base;           // 4. RUT Trabajador
        fila[4] = tRutParts.dv;             // 5. DV Trabajador
        fila[5] = apPaterno.slice(0, 30);   // 6. Apellido Paterno
        fila[6] = apMaterno.slice(0, 30);   // 7. Apellido Materno
        fila[7] = nombres.slice(0, 30);     // 8. Nombres
        fila[8] = 'M';                      // 9. Sexo (M o F)
        fila[9] = '1';                      // 10. Nacionalidad
        fila[10] = '0';                     // 11. Tipo de Pago
        fila[11] = periodo;                 // 12. Periodo Desde
        fila[12] = periodo;                 // 13. Periodo Hasta
        fila[13] = '0';                     // 14. Código Régimen

        // Remuneraciones y Movimientos
        fila[14] = '00';
        fila[15] = '30';
        fila[16] = '0';
        fila[17] = '0';
        fila[18] = '';
        fila[19] = '';

        // AFP
        fila[20] = mapAfpPreviredCode(trabajador.afpId);
        fila[21] = Math.round(trabajador.sueldoBase).toString();

        // Isapre / Fonasa (Salud)
        const saludCode = mapSaludPreviredCode(trabajador.isapreId);
        fila[22] = saludCode;
        fila[23] = Math.round(trabajador.sueldoBase).toString();
        fila[24] = Math.round(trabajador.sueldoBase * 0.07).toString(); // Est. 7%

        // Seguro Cesantía (AFC)
        fila[25] = trabajador.tipoContrato === 'honorarios' ? '1' : '0';
        fila[26] = Math.round(trabajador.sueldoBase).toString();
        fila[27] = Math.round(trabajador.sueldoBase * (trabajador.tipoContrato === 'plazo' ? 0 : 0.006)).toString();
        fila[28] = Math.round(trabajador.sueldoBase * (trabajador.tipoContrato === 'plazo' ? 0.03 : 0.024)).toString();

        // SIS y Mutual
        fila[29] = Math.round(trabajador.sueldoBase * 0.0162).toString();
        fila[30] = '3';
        fila[31] = Math.round(trabajador.sueldoBase * 0.0093).toString();

        for (let i = 32; i < 105; i++) {
          if (fila[i] === '') fila[i] = '0';
        }

        csvContent += fila.join(';') + '\n';
      });
    }

    if (state.trabajadores.length === 0 && (!liqPeriodo || liqPeriodo.lineas.length === 0)) {
      showToast('warning', 'Sin datos', 'No hay trabajadores registrados o remuneraciones procesadas para generar el archivo.');
      return;
    }

    // Descargar el archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `PREVIRED_${periodo}_${empresaRutParts.base}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generador de Nómina Bancaria (TXT)
  const generarNominaBancaria = () => {
    if (listaPagos.length === 0) {
      showToast('warning', 'Sin datos', 'No hay liquidaciones o trabajadores disponibles para pagar.');
      return;
    }

    let txtContent = "";
    const cleanEmpresaRut = (state.configuracion?.rut || '76.123.456-7').replace(/\D/g, '');

    if (bancoSeleccionado === 'chile') {
      // Formato Banco de Chile Remuneraciones (Fixed Width)
      // Largo sugerido de línea: 80 - 100 caracteres.
      // E.g.: RUT(12) + Nombre(30) + Banco(3) + TipoCuenta(2) + N°Cuenta(12) + Monto(10) + Rellenos
      listaPagos.forEach(p => {
        const db = getDatosBanco(p.id, p.rut);
        const cleanRut = p.rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
        
        const rutFormatted = cleanRut.padStart(12, '0'); // RUT a 12 caracteres
        const nombreFormatted = p.nombre.substring(0, 30).padEnd(30, ' '); // Nombre a 30 caracteres
        const codBanco = db.banco.padStart(3, '0'); // Banco a 3 caracteres
        const tipoCta = (db.tipoCuenta === 'CC' ? '01' : db.tipoCuenta === 'CV' ? '02' : '03').padStart(2, '0'); // Tipo de Cuenta (01: Corriente, 02: Vista, 03: Ahorro)
        const nroCuenta = db.numeroCuenta.replace(/\D/g, '').substring(0, 12).padStart(12, '0'); // Cuenta a 12 caracteres
        const montoFormatted = String(p.montoLiquido).padStart(10, '0'); // Monto a 10 caracteres

        txtContent += `${rutFormatted}${nombreFormatted}${codBanco}${tipoCta}${nroCuenta}${montoFormatted}\r\n`;
      });
    } else {
      // Formato Santander Remuneraciones (TXT delimitado o fixed)
      // E.g. RUT(10);Nombre(30);Banco(3);TipoCta(2);N°Cta(12);Monto(10)
      listaPagos.forEach(p => {
        const db = getDatosBanco(p.id, p.rut);
        const cleanRut = p.rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
        
        const rutFormatted = cleanRut.substring(0, 10).padStart(10, '0');
        const nombreFormatted = p.nombre.substring(0, 30).padEnd(30, ' ');
        const codBanco = db.banco === '037' ? '037' : '001'; // Santander es 037
        const tipoCta = db.tipoCuenta; // CC, CV, CA
        const nroCuenta = db.numeroCuenta.replace(/\D/g, '').substring(0, 12).padEnd(12, ' ');
        const montoFormatted = String(p.montoLiquido).padStart(10, '0');

        txtContent += `${rutFormatted};${nombreFormatted.trim()};${codBanco};${tipoCta};${nroCuenta.trim()};${montoFormatted}\r\n`;
      });
    }

    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `NOMINA_${bancoSeleccionado.toUpperCase()}_${periodoKey}_${cleanEmpresaRut}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getNombreBanco = (code: string) => {
    switch (code) {
      case '001': return 'Banco de Chile';
      case '037': return 'Banco Santander';
      case '012': return 'Banco Estado';
      case '039': return 'Banco Itaú';
      default: return 'Otro Banco';
    }
  };

  const getNombreTipoCuenta = (code: string) => {
    switch (code) {
      case 'CC': return 'Cuenta Corriente';
      case 'CV': return 'Cuenta Vista / RUT';
      case 'CA': return 'Cuenta Ahorro';
      default: return 'Cuenta Corriente';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#1E3A5F]/10 rounded-lg">
            <FileText className="text-[#1E3A5F] dark:text-blue-400" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Previsiones y Nóminas Bancarias</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Exporta archivos estandarizados para cotizaciones de Previred y nóminas de transferencias bancarias masivas.
            </p>
          </div>
        </div>

        {/* Selector de Período */}
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <select 
            value={mes} 
            onChange={(e) => setMes(Number(e.target.value))}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-gray-800 dark:text-gray-200 text-sm focus:ring-2 focus:ring-[#1E3A5F]/20"
          >
            <option value={1}>Enero</option>
            <option value={2}>Febrero</option>
            <option value={3}>Marzo</option>
            <option value={4}>Abril</option>
            <option value={5}>Mayo</option>
            <option value={6}>Junio</option>
            <option value={7}>Julio</option>
            <option value={8}>Agosto</option>
            <option value={9}>Septiembre</option>
            <option value={10}>Octubre</option>
            <option value={11}>Noviembre</option>
            <option value={12}>Diciembre</option>
          </select>
          <input 
            type="number" 
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="w-20 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-gray-800 dark:text-gray-200 text-sm focus:ring-2 focus:ring-[#1E3A5F]/20"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setTabActiva('previred')}
          className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
            tabActiva === 'previred'
              ? 'border-[#1E3A5F] text-[#1E3A5F] dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Previred (105 Columnas)
        </button>
        <button
          onClick={() => setTabActiva('nominas')}
          className={`py-3 px-6 font-medium text-sm border-b-2 transition-colors ${
            tabActiva === 'nominas'
              ? 'border-[#1E3A5F] text-[#1E3A5F] dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Nóminas Bancarias de Pago
        </button>
      </div>

      {/* Alerta de cuadratura según estado de liquidaciones */}
      {liqPeriodo ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-3">
          <CheckCircle className="text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" size={18} />
          <div className="text-sm text-emerald-800 dark:text-emerald-300">
            <span className="font-bold">Remuneraciones Procesadas:</span> El período {periodoKey} cuenta con liquidaciones reales aprobadas. Los archivos se generarán con los montos exactos liquidados e imponibles.
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 flex items-start gap-3">
          <AlertCircle className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" size={18} />
          <div className="text-sm text-amber-800 dark:text-amber-300">
            <span className="font-bold">Remuneraciones No Procesadas:</span> No se han calculado liquidaciones oficiales para el período {periodoKey}. Se muestran montos estimativos basados en contratos activos. Se recomienda procesar el mes en el módulo de Remuneraciones antes de descargar los archivos.
          </div>
        </div>
      )}

      {tabActiva === 'previred' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Generación de Archivo Electrónico Previred</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Estructura oficial de 105 campos requerida por el portal de Previred para validación de planillas de cotizaciones.
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700/50 space-y-3">
              <h4 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Estructura Detallada de Campos</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400 font-mono">
                <div>• Campos 1-5: Identificación Empresa</div>
                <div>• Campos 6-13: Datos Personales Trabajador</div>
                <div>• Campos 14-20: Movimientos de Personal</div>
                <div>• Campos 21-22: Cotizaciones AFP (10% + Com)</div>
                <div>• Campos 23-25: Salud Fonasa/Isapre</div>
                <div>• Campos 26-29: AFC Aporte Empleador/Trabajador</div>
                <div>• Campos 30-32: Mutualidad e Invalidez SIS</div>
                <div>• Campos 33-105: APV, Depósitos y Rellenos Previred</div>
              </div>
            </div>

            <button 
              onClick={generarArchivoPrevired}
              className="w-full py-3 bg-[#1E3A5F] hover:bg-[#2D5A87] dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium shadow-md"
            >
              <Download size={20} />
              Descargar Archivo Previred (.csv)
            </button>
          </Card>

          <Card className="space-y-4">
            <h3 className="font-bold text-gray-900 dark:text-gray-100">Resumen Planilla Previsional</h3>
            <div className="space-y-3 divide-y divide-gray-100 dark:divide-gray-800">
              <div className="flex justify-between items-center py-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Empresa</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{state.configuracion?.nombreFantasia}</span>
              </div>
              <div className="flex justify-between items-center py-2 text-sm font-mono">
                <span className="text-gray-600 dark:text-gray-400">RUT</span>
                <span className="text-gray-800 dark:text-gray-200">{state.configuracion?.rut}</span>
              </div>
              <div className="flex justify-between items-center py-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Trabajadores a Declarar</span>
                <span className="font-bold text-[#1E3A5F] dark:text-blue-400">{listaPagos.length}</span>
              </div>
              <div className="flex justify-between items-center py-2 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Imponible Total Est.</span>
                <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                  {formatCurrency(listaPagos.reduce((acc, p) => acc + (p.montoLiquido / 0.8), 0))}
                </span>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-1 space-y-4">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">Configuración Banco</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Selección del Banco</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setBancoSeleccionado('chile')}
                      className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all ${
                        bancoSeleccionado === 'chile'
                          ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 dark:border-blue-500 dark:bg-blue-500/10 text-[#1E3A5F] dark:text-blue-400'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <Landmark size={20} />
                      <span className="text-xs font-bold">Banco de Chile</span>
                    </button>
                    <button
                      onClick={() => setBancoSeleccionado('santander')}
                      className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all ${
                        bancoSeleccionado === 'santander'
                          ? 'border-red-600 bg-red-500/5 dark:border-red-500 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <Landmark size={20} />
                      <span className="text-xs font-bold">Santander</span>
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-700/50 text-xs text-gray-600 dark:text-gray-400 space-y-2">
                  <p className="font-bold flex items-center gap-1">
                    <Info size={12} />
                    Detalle del Formato
                  </p>
                  <p>
                    {bancoSeleccionado === 'chile' 
                      ? 'Banco de Chile exige un archivo TXT de ancho fijo con RUT relleno con ceros a la izquierda (12 caracteres) y montos de 10 dígitos.'
                      : 'Santander exige un archivo TXT delimitado por punto y coma (;) con RUT a 10 dígitos y montos enteros con relleno.'}
                  </p>
                </div>

                <button
                  onClick={generarNominaBancaria}
                  className="w-full py-3 bg-[#1E3A5F] hover:bg-[#2D5A87] dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium shadow-md"
                >
                  <Download size={18} />
                  Exportar Nómina TXT
                </button>
              </div>
            </Card>

            <Card className="lg:col-span-3 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CreditCard size={18} className="text-gray-400" />
                  Trabajadores e Información Bancaria
                </h3>
                <span className="text-xs bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full text-gray-500">
                  Total Líquido a Transferir: <span className="font-bold font-mono text-[#1E3A5F] dark:text-blue-400">{formatCurrency(listaPagos.reduce((s, p) => s + p.montoLiquido, 0))}</span>
                </span>
              </div>

              <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-xl">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800 text-gray-500 uppercase text-xs tracking-wider">
                      <th className="p-3">Trabajador</th>
                      <th className="p-3">RUT</th>
                      <th className="p-3">Banco</th>
                      <th className="p-3">Tipo Cuenta</th>
                      <th className="p-3">N° Cuenta</th>
                      <th className="p-3 text-right">Líquido a Pagar</th>
                      <th className="p-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {listaPagos.map(p => {
                      const db = getDatosBanco(p.id, p.rut);
                      const isEditing = editandoTrabajadorId === p.id;
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-850/50 transition-colors">
                          <td className="p-3 font-semibold text-gray-800 dark:text-gray-200">
                            <div>{p.nombre}</div>
                            <div className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">{p.cargo}</div>
                          </td>
                          <td className="p-3 font-mono text-xs">{p.rut}</td>
                          <td className="p-3">
                            {isEditing ? (
                              <select
                                value={db.banco}
                                onChange={(e) => handleSaveBanco(p.id, { banco: e.target.value as any })}
                                className="px-2 py-1 text-xs border rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                              >
                                <option value="001">Banco de Chile</option>
                                <option value="037">Banco Santander</option>
                                <option value="012">Banco Estado</option>
                                <option value="039">Banco Itaú</option>
                              </select>
                            ) : (
                              <span className="text-gray-700 dark:text-gray-300">{getNombreBanco(db.banco)}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {isEditing ? (
                              <select
                                value={db.tipoCuenta}
                                onChange={(e) => handleSaveBanco(p.id, { tipoCuenta: e.target.value as any })}
                                className="px-2 py-1 text-xs border rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                              >
                                <option value="CC">Corriente</option>
                                <option value="CV">Vista</option>
                                <option value="CA">Ahorro</option>
                              </select>
                            ) : (
                              <span className="text-gray-700 dark:text-gray-300">{getNombreTipoCuenta(db.tipoCuenta)}</span>
                            )}
                          </td>
                          <td className="p-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={db.numeroCuenta}
                                onChange={(e) => handleSaveBanco(p.id, { numeroCuenta: e.target.value })}
                                className="w-28 px-2 py-1 text-xs border rounded font-mono bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                              />
                            ) : (
                              <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{db.numeroCuenta}</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-gray-150">
                            {formatCurrency(p.montoLiquido)}
                          </td>
                          <td className="p-3 text-center">
                            {isEditing ? (
                              <button 
                                onClick={() => setEditandoTrabajadorId(null)}
                                className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded"
                              >
                                <Check size={16} />
                              </button>
                            ) : (
                              <button 
                                onClick={() => setEditandoTrabajadorId(p.id)}
                                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

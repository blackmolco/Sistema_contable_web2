import React, { useState } from 'react';
import {
  Calculator,
  DollarSign,
  TrendingUp,
  Percent,
  Users,
  Briefcase,
} from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { Button, Input, Select } from '../components/ui/FormElements';
import {
  formatCurrency,
  calcularSueldoLiquido,
  calcularHonorarios,
  calcularHonorariosDesdeLiquido,
  calcularAsignacionFamiliar,
} from '../utils/calculos';
import { AFP_DATA, ISAPRES, ESCALA_IMPUESTO_UNICO, SUELDO_MINIMO, UIT_2024 } from '../data/normativa';

type CalculadoraActiva = 'sueldo' | 'honorarios' | 'afp' | 'impuesto' | 'asignacion';

export default function Calculadora() {
  const [calculadoraActiva, setCalculadoraActiva] = useState<CalculadoraActiva>('sueldo');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calculadora</h1>
          <p className="text-sm text-gray-500 mt-1">
            Herramientas de cálculo tributario y laboral chileno
          </p>
        </div>
      </div>

      {/* Selector de Calculadora */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { id: 'sueldo', label: 'Sueldo Líquido', icon: Users },
          { id: 'honorarios', label: 'Honorarios', icon: DollarSign },
          { id: 'afp', label: 'Cotización AFP', icon: Briefcase },
          { id: 'impuesto', label: 'Impuesto Único', icon: Percent },
          { id: 'asignacion', label: 'Asig. Familiar', icon: TrendingUp },
        ].map((calc) => (
          <button
            key={calc.id}
            onClick={() => setCalculadoraActiva(calc.id as CalculadoraActiva)}
            className={`p-4 rounded-xl border-2 transition-all text-left
              ${calculadoraActiva === calc.id
                ? 'border-[#1E3A5F] bg-[#1E3A5F]/5'
                : 'border-gray-200 hover:border-gray-300 bg-white'
              }
            `}
          >
            <calc.icon
              size={24}
              className={`mb-2 ${calculadoraActiva === calc.id ? 'text-[#1E3A5F]' : 'text-gray-400'}`}
            />
            <p className={`font-medium ${calculadoraActiva === calc.id ? 'text-[#1E3A5F]' : 'text-gray-700'}`}>
              {calc.label}
            </p>
          </button>
        ))}
      </div>

      {/* Contenido de Calculadora */}
      {calculadoraActiva === 'sueldo' && <CalculadoraSueldo />}
      {calculadoraActiva === 'honorarios' && <CalculadoraHonorarios />}
      {calculadoraActiva === 'afp' && <CalculadoraAFP />}
      {calculadoraActiva === 'impuesto' && <CalculadoraImpuesto />}
      {calculadoraActiva === 'asignacion' && <CalculadoraAsignacion />}
    </div>
  );
}

function CalculadoraSueldo() {
  const [sueldoBase, setSueldoBase] = useState(500000);
  const [colacion, setColacion] = useState(50000);
  const [movilizacion, setMovilizacion] = useState(35000);
  const [bonificacion, setBonificacion] = useState(0);
  const [afpId, setAfpId] = useState('afp_habitat');
  const [isapreId, setIsapreId] = useState('fonasa');
  const [tipoContrato, setTipoContrato] = useState<'indefinido' | 'plazo'>('indefinido');
  const [cargaCivil, setCargaCivil] = useState(0);
  const [resultado, setResultado] = useState<ReturnType<typeof calcularSueldoLiquido> | null>(null);

  const calcular = () => {
    const afp = AFP_DATA.find((a) => a.id === afpId);
    const res = calcularSueldoLiquido({
      sueldoBase,
      colacion,
      movilizacion,
      bonificacion,
      comisionAfp: afp?.comisionFija || 1.27,
      tipoContrato,
      cargaCivil,
      cargaMilitar: 0,
    });
    setResultado(res);
  };

  return (
    <Card title="Calculadora de Sueldo Líquido">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-700">Datos del Trabajador</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Sueldo Base"
              type="number"
              value={sueldoBase}
              onChange={(e) => setSueldoBase(Number(e.target.value))}
            />
            <Select
              label="AFP"
              value={afpId}
              onChange={(e) => setAfpId(e.target.value)}
              options={AFP_DATA.map((a) => ({ value: a.id, label: a.nombre }))}
            />
            <Select
              label="Salud"
              value={isapreId}
              onChange={(e) => setIsapreId(e.target.value)}
              options={ISAPRES.map((i) => ({ value: i.id, label: i.nombre }))}
            />
            <Select
              label="Tipo de Contrato"
              value={tipoContrato}
              onChange={(e) => setTipoContrato(e.target.value as 'indefinido' | 'plazo')}
              options={[
                { value: 'indefinido', label: 'Indefinido' },
                { value: 'plazo', label: 'A Plazo' },
              ]}
            />
          </div>
          <h3 className="font-semibold text-gray-700 pt-4">Haberes</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Colación"
              type="number"
              value={colacion}
              onChange={(e) => setColacion(Number(e.target.value))}
            />
            <Input
              label="Movilización"
              type="number"
              value={movilizacion}
              onChange={(e) => setMovilizacion(Number(e.target.value))}
            />
            <Input
              label="Bonificación"
              type="number"
              value={bonificacion}
              onChange={(e) => setBonificacion(Number(e.target.value))}
            />
            <Input
              label="Cargas Familiares"
              type="number"
              value={cargaCivil}
              onChange={(e) => setCargaCivil(Number(e.target.value))}
            />
          </div>
          <Button className="w-full mt-4" onClick={calcular}>
            Calcular Sueldo Líquido
          </Button>
        </div>

        {/* Resultado */}
        <div>
          {resultado ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 p-4 rounded-xl text-center">
                <p className="text-sm text-emerald-600 mb-1">Sueldo Líquido</p>
                <p className="text-3xl font-bold text-emerald-700">{formatCurrency(resultado.sueldoLiquido)}</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-gray-700">Cotizaciones</h4>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>AFP (10%)</span>
                    <span className="text-red-600">- {formatCurrency(resultado.cotizaciones.afpAhorro)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SIS (1.53%)</span>
                    <span className="text-red-600">- {formatCurrency(resultado.cotizaciones.afpSis)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Comisión AFP</span>
                    <span className="text-red-600">- {formatCurrency(resultado.cotizaciones.afpComision)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Salud (7%)</span>
                    <span className="text-red-600">- {formatCurrency(resultado.cotizaciones.salud)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AFC</span>
                    <span className="text-red-600">- {formatCurrency(resultado.cotizaciones.afc)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Total Descuentos</span>
                    <span className="text-red-600">
                      - {formatCurrency(resultado.cotizaciones.total + resultado.impuestoUnico)}
                    </span>
                  </div>
                </div>
              </div>

              {resultado.asignacionFamiliar > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg text-sm">
                  <div className="flex justify-between">
                    <span>Asignación Familiar ({cargaCivil} cargas)</span>
                    <span className="text-blue-600">+ {formatCurrency(resultado.asignacionFamiliar)}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <Calculator size={48} className="mx-auto mb-3" />
                <p>Ingrese los datos y presione calcular</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function CalculadoraHonorarios() {
  const [monto, setMonto] = useState(0);
  const [modo, setModo] = useState<'bruto' | 'liquido'>('bruto');
  const [resultado, setResultado] = useState<{ bruto: number; retencion: number; liquido: number } | null>(null);

  const calcular = () => {
    if (modo === 'bruto') {
      const res = calcularHonorarios(monto);
      setResultado({ bruto: monto, retencion: res.retencion, liquido: res.liquido });
    } else {
      const res = calcularHonorariosDesdeLiquido(monto);
      setResultado({ bruto: res.bruto, retencion: res.retencion, liquido: monto });
    }
  };

  return (
    <Card title="Calculadora de Honorarios (Art. 42 N°2 LIR)">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => { setModo('bruto'); setResultado(null); }}
              className={`flex-1 py-2 px-3 rounded-lg font-medium ${
                modo === 'bruto' ? 'bg-[#1E3A5F] text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Calcular desde Bruto
            </button>
            <button
              onClick={() => { setModo('liquido'); setResultado(null); }}
              className={`flex-1 py-2 px-3 rounded-lg font-medium ${
                modo === 'liquido' ? 'bg-[#1E3A5F] text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Calcular desde Líquido
            </button>
          </div>
          <Input
            label={modo === 'bruto' ? 'Monto Bruto' : 'Monto Líquido Deseado'}
            type="number"
            value={monto}
            onChange={(e) => setMonto(Number(e.target.value))}
          />
          <Button className="w-full" onClick={calcular}>
            Calcular
          </Button>
        </div>

        <div>
          {resultado ? (
            <div className="bg-emerald-50 p-6 rounded-xl space-y-4">
              <div className="text-center">
                <p className="text-sm text-emerald-600 mb-1">Líquido a Pagar</p>
                <p className="text-3xl font-bold text-emerald-700">{formatCurrency(resultado.liquido)}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Honorario Bruto</span>
                  <span>{formatCurrency(resultado.bruto)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Retención 10%</span>
                  <span>- {formatCurrency(resultado.retencion)}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                  <span>Total a Pagar</span>
                  <span>{formatCurrency(resultado.liquido)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <p>Ingrese el monto y presione calcular</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function CalculadoraAFP() {
  const [sueldo, setSueldo] = useState(500000);
  const [afpId, setAfpId] = useState('afp_habitat');

  const afp = AFP_DATA.find((a) => a.id === afpId);
  const ahorro = sueldo * 0.1;
  const sis = sueldo * 0.0153;
  const comision = sueldo * ((afp?.comisionFija || 1.27) / 100);
  const total = ahorro + sis + comision;

  return (
    <Card title="Calculadora de Cotización AFP">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <Input
            label="Sueldo Imponible"
            type="number"
            value={sueldo}
            onChange={(e) => setSueldo(Number(e.target.value))}
          />
          <Select
            label="AFP"
            value={afpId}
            onChange={(e) => setAfpId(e.target.value)}
            options={AFP_DATA.map((a) => ({ value: a.id, label: a.nombre }))}
          />
          <div className="p-4 bg-gray-50 rounded-lg text-sm">
            <p className="text-gray-600">Comisión: {afp?.comisionFija}% fija + 0.77% variable</p>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-xl space-y-4">
          <h4 className="font-semibold text-gray-700">Desglose de Cotización</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Ahorro Individual (10%)</span>
              <span className="font-medium">{formatCurrency(ahorro)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">SIS (1.53%)</span>
              <span className="font-medium">{formatCurrency(sis)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Comisión AFP ({afp?.comisionFija}%)</span>
              <span className="font-medium">{formatCurrency(comision)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t font-semibold">
              <span>Total Cotización</span>
              <span className="text-[#1E3A5F]">{formatCurrency(total)}</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 pt-2">
            * El 10% de ahorro es parte de tu fondo de pensiones
          </div>
        </div>
      </div>
    </Card>
  );
}

function CalculadoraImpuesto() {
  const [sueldo, setSueldo] = useState(1500000);
  const [mostrarAnual, setMostrarAnual] = useState(true);

  const sueldoAnual = sueldo * 12;
  const tramoAcumulado = 0;
  let impuestoTotal = 0;

  for (const item of ESCALA_IMPUESTO_UNICO) {
    if (sueldoAnual <= item.hasta) {
      impuestoTotal = Math.max(0, (sueldoAnual * item.factor) - item.deduccion);
      break;
    }
  }

  const impuestoMensual = Math.round(impuestoTotal / 12);

  return (
    <Card title="Calculadora de Impuesto Único (Art. 52 LIR)">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <Input
            label="Sueldo Imponible Mensual"
            type="number"
            value={sueldo}
            onChange={(e) => setSueldo(Number(e.target.value))}
          />
          <div className="flex gap-4">
            <button
              onClick={() => setMostrarAnual(false)}
              className={`flex-1 py-2 px-3 rounded-lg font-medium ${
                !mostrarAnual ? 'bg-[#1E3A5F] text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Ver Mensual
            </button>
            <button
              onClick={() => setMostrarAnual(true)}
              className={`flex-1 py-2 px-3 rounded-lg font-medium ${
                mostrarAnual ? 'bg-[#1E3A5F] text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              Ver Anual
            </button>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-xl space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">
              Impuesto {mostrarAnual ? 'Anual' : 'Mensual'}
            </p>
            <p className="text-3xl font-bold text-[#1E3A5F]">
              {formatCurrency(mostrarAnual ? impuestoTotal : impuestoMensual)}
            </p>
          </div>

          <div className="text-sm space-y-1">
            <p className="text-gray-600">
              Renta anual imponible: {formatCurrency(sueldoAnual)}
            </p>
            <p className="text-gray-600">UIT 2024: {formatCurrency(UIT_2024)}</p>
          </div>

          <div className="pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Escala del Impuesto</h4>
            <div className="space-y-1 text-xs">
              {ESCALA_IMPUESTO_UNICO.map((tramo) => (
                <div key={tramo.tramo} className="flex justify-between py-1">
                  <span>{tramo.nombre} ({tramo.factor * 100}%)</span>
                  <span className="text-gray-500">
                    {formatCurrency(tramo.desde)} - {formatCurrency(tramo.hasta === Infinity ? 99999999 : tramo.hasta)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function CalculadoraAsignacion() {
  const [sueldo, setSueldo] = useState(800000);
  const [cargaCivil, setCargaCivil] = useState(1);
  const [cargaMilitar, setCargaMilitar] = useState(0);

  const asignacion = calcularAsignacionFamiliar(sueldo, cargaCivil, cargaMilitar);

  let tramo = '';
  if (sueldo <= 493829) tramo = 'Tramo A';
  else if (sueldo <= 712694) tramo = 'Tramo B';
  else tramo = 'Tramo C';

  return (
    <Card title="Calculadora de Asignación Familiar">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <Input
            label="Sueldo Imponible"
            type="number"
            value={sueldo}
            onChange={(e) => setSueldo(Number(e.target.value))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Cargas Civiles"
              type="number"
              value={cargaCivil}
              onChange={(e) => setCargaCivil(Number(e.target.value))}
            />
            <Input
              label="Cargas Militares"
              type="number"
              value={cargaMilitar}
              onChange={(e) => setCargaMilitar(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="bg-emerald-50 p-6 rounded-xl space-y-4">
          <div className="text-center">
            <p className="text-sm text-emerald-600 mb-1">Asignación Familiar Mensual</p>
            <p className="text-3xl font-bold text-emerald-700">{formatCurrency(asignacion)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Tramo</span>
              <span className="font-medium">{tramo}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Cargas</span>
              <span className="font-medium">{cargaCivil + cargaMilitar}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Monto por Carga</span>
              <span>
                {sueldo <= 493829
                  ? formatCurrency(21798)
                  : sueldo <= 712694
                  ? formatCurrency(13174)
                  : formatCurrency(4310)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

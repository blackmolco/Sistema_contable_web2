import React, { useState } from 'react';
import { RefreshCw, Calculator, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card } from './Cards';
import { formatCurrency } from '../../utils/calculos';

export function CalculadoraHonorarios() {
  const [monto, setMonto] = useState<string>('');
  const [tipo, setTipo] = useState<'bruto_a_liquido' | 'liquido_a_bruto'>('liquido_a_bruto');
  
  // Tasa actual 2024
  const TASA_RETENCION = 0.1375; // 13.75%

  const calcular = () => {
    const valor = parseFloat(monto.replace(/\D/g, '')) || 0;
    if (valor === 0) return { bruto: 0, retencion: 0, liquido: 0 };

    if (tipo === 'liquido_a_bruto') {
      // Bruto = Liquido / (1 - Tasa)
      const bruto = Math.round(valor / (1 - TASA_RETENCION));
      const retencion = bruto - valor;
      return { bruto, retencion, liquido: valor };
    } else {
      // Liquido = Bruto - (Bruto * Tasa)
      const retencion = Math.round(valor * TASA_RETENCION);
      const liquido = valor - retencion;
      return { bruto: valor, retencion, liquido };
    }
  };

  const resultado = calcular();

  return (
    <Card className="bg-gradient-to-br from-[#1E3A5F] to-[#2D5A87] text-white border-none shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-white/10 rounded-lg">
          <Calculator className="text-emerald-400" size={24} />
        </div>
        <div>
          <h3 className="font-bold text-lg">Calculadora de Honorarios</h3>
          <p className="text-xs text-white/60">Tasa SII 2024 ({TASA_RETENCION * 100}%)</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex bg-white/10 p-1 rounded-lg">
          <button
            onClick={() => setTipo('liquido_a_bruto')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${tipo === 'liquido_a_bruto' ? 'bg-white text-[#1E3A5F]' : 'text-white hover:bg-white/5'}`}
          >
            Quiero $ Líquido
          </button>
          <button
            onClick={() => setTipo('bruto_a_liquido')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${tipo === 'bruto_a_liquido' ? 'bg-white text-[#1E3A5F]' : 'text-white hover:bg-white/5'}`}
          >
            Tengo $ Bruto
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/80 mb-1">
            {tipo === 'liquido_a_bruto' ? 'Monto Líquido a Pagar' : 'Monto Bruto de la Boleta'}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 font-bold">$</span>
            <input
              type="text"
              value={formatCurrency(parseFloat(monto.replace(/\D/g, '')) || 0).replace('$', '').trim()}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white font-mono placeholder-white/30 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
              placeholder="0"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-white/70">Monto Bruto</span>
            <span className="font-mono font-medium">{formatCurrency(resultado.bruto)}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-red-300">
            <span className="flex items-center gap-1"><TrendingDown size={14} /> Retención SII</span>
            <span className="font-mono font-medium">-{formatCurrency(resultado.retencion)}</span>
          </div>
          <div className="flex justify-between items-center bg-white/10 p-3 rounded-lg border border-white/10">
            <span className="font-bold text-emerald-400">Total Líquido</span>
            <span className="text-xl font-black text-emerald-400 font-mono tracking-wider">{formatCurrency(resultado.liquido)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

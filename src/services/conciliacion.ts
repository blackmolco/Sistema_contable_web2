// Servicio de Conciliación Bancaria
import { generateId } from '../utils/calculos';

export interface TransaccionBancaria {
  id: string;
  fecha: string;
  descripcion: string;
  tipo: 'debito' | 'credito';
  monto: number;
  referencia?: string;
  conciliada: boolean;
  transaccionId?: string; // ID de la transacción contable asociada
}

export interface TransaccionContable {
  id: string;
  fecha: string;
  glosa: string;
  monto: number;
  cuentaBanco: string;
  tipo: 'debito' | 'credito';
  conciliada: boolean;
  transaccionBancariaId?: string;
}

export interface PartidaConciliada {
  transaccionBancaria: TransaccionBancaria;
  transaccionContable: TransaccionContable;
  diferencia?: number;
  fechaConciliacion: string;
}

export interface ResultadoConciliacion {
  partidasConciliadas: PartidaConciliada[];
  transaccionesBancariasPendientes: TransaccionBancaria[];
  transaccionesContablesPendientes: TransaccionContable[];
  totalConciliado: number;
  totalDiferencias: number;
  mensaje: string;
}

export class ConciliacionService {

  // Conciliar por referencia/código
  static conciliarPorReferencia(
    transaccionesBancarias: TransaccionBancaria[],
    transaccionesContables: TransaccionContable[]
  ): ResultadoConciliacion {
    const partidasConciliadas: PartidaConciliada[] = [];
    const transaccionesBancariasPendientes: TransaccionBancaria[] = [];
    const transaccionesContablesPendientes: TransaccionContable[] = [];

    // Marcar como conciliadas las que tienen referencia
    const marcadasBancarias = [...transaccionesBancarias];
    const marcadasContables = [...transaccionesContables];

    // Intentar conciliar por referencia exacta
    marcadasBancarias.forEach(tb => {
      if (tb.conciliada) return;

      const tc = marcadasContables.find(tc =>
        !tc.conciliada &&
        tc.monto === tb.monto &&
        tc.tipo === tb.tipo &&
        (tb.referencia === tc.glosa || tb.referencia?.includes(tc.glosa))
      );

      if (tc) {
        const partida: PartidaConciliada = {
          transaccionBancaria: { ...tb, conciliada: true },
          transaccionContable: { ...tc, conciliada: true },
          fechaConciliacion: new Date().toISOString(),
        };
        partidasConciliadas.push(partida);
        tb.conciliada = true;
        tb.transaccionId = tc.id;
        tc.conciliada = true;
        tc.transaccionBancariaId = tb.id;
      }
    });

    // Conciliación automática por monto y fecha (tolerancia 3 días)
    marcadasBancarias.forEach(tb => {
      if (tb.conciliada) return;

      const fechaBanco = new Date(tb.fecha);
      const tc = marcadasContables.find(tc =>
        !tc.conciliada &&
        tc.monto === tb.monto &&
        tc.tipo === tb.tipo &&
        Math.abs(new Date(tc.fecha).getTime() - fechaBanco.getTime()) <= 3 * 24 * 60 * 60 * 1000
      );

      if (tc) {
        const partida: PartidaConciliada = {
          transaccionBancaria: { ...tb, conciliada: true },
          transaccionContable: { ...tc, conciliada: true },
          fechaConciliacion: new Date().toISOString(),
        };
        partidasConciliadas.push(partida);
        tb.conciliada = true;
        tb.transaccionId = tc.id;
        tc.conciliada = true;
        tc.transaccionBancariaId = tb.id;
      }
    });

    // Obtener pendientes
    marcadasBancarias.forEach(tb => {
      if (!tb.conciliada) {
        transaccionesBancariasPendientes.push(tb);
      }
    });

    marcadasContables.forEach(tc => {
      if (!tc.conciliada) {
        transaccionesContablesPendientes.push(tc);
      }
    });

    // Calcular totales
    const totalConciliado = partidasConciliadas.reduce((sum, p) => sum + p.transaccionBancaria.monto, 0);
    const totalDiferencias = partidasConciliadas.reduce((sum, p) => sum + (p.diferencia || 0), 0);

    return {
      partidasConciliadas,
      transaccionesBancariasPendientes,
      transaccionesContablesPendientes,
      totalConciliado,
      totalDiferencias,
      mensaje: this.generarMensaje(partidasConciliadas.length, transaccionesBancariasPendientes.length, transaccionesContablesPendientes.length),
    };
  }

  // Conciliación manual
  static conciliarManualmente(
    tb: TransaccionBancaria,
    tc: TransaccionContable
  ): PartidaConciliada {
    return {
      transaccionBancaria: { ...tb, conciliada: true },
      transaccionContable: { ...tc, conciliada: true },
      diferencia: tb.monto - tc.monto,
      fechaConciliacion: new Date().toISOString(),
    };
  }

  // Encontrar partidas posibles para conciliar
  static encontrarPosiblesConciliaciones(
    tb: TransaccionBancaria,
    transaccionesContables: TransaccionContable[]
  ): TransaccionContable[] {
    return transaccionesContables.filter(tc =>
      !tc.conciliada &&
      tc.monto === tb.monto &&
      tc.tipo === tb.tipo
    );
  }

  // Generar reporte de conciliación
  static generarReporteConciliacion(
    resultado: ResultadoConciliacion,
    cuentaBancaria: string,
    saldoBanco: number,
    saldoContable: number,
    periodo: string
  ): string {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Conciliación Bancaria</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #1E3A5F; }
    .header { margin-bottom: 20px; }
    .section { margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
    th { background: #1E3A5F; color: white; }
    .pendiente { background: #fff3cd; }
    .conciliado { background: #d4edda; }
    .totals { font-weight: bold; margin-top: 20px; }
    .diferencia { color: red; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Conciliación Bancaria</h1>
    <p><strong>Cuenta:</strong> ${cuentaBancaria}</p>
    <p><strong>Período:</strong> ${periodo}</p>
    <p><strong>Fecha Informe:</strong> ${new Date().toLocaleDateString('es-CL')}</p>
  </div>

  <div class="section">
    <h2>Partidas Conciliadas (${resultado.partidasConciliadas.length})</h2>
    <table>
      <tr>
        <th>Fecha</th>
        <th>Descripción Banco</th>
        <th>Descripción Contable</th>
        <th>Monto</th>
      </tr>
      ${resultado.partidasConciliadas.map(p => `
        <tr class="conciliado">
          <td>${p.transaccionBancaria.fecha}</td>
          <td>${p.transaccionBancaria.descripcion}</td>
          <td>${p.transaccionContable.glosa}</td>
          <td>$${p.transaccionBancaria.monto.toLocaleString()}</td>
        </tr>
      `).join('')}
    </table>
    <p class="totals">Total Conciliado: $${resultado.totalConciliado.toLocaleString()}</p>
  </div>

  <div class="section">
    <h2>Transacciones Bancarias Pendientes (${resultado.transaccionesBancariasPendientes.length})</h2>
    ${resultado.transaccionesBancariasPendientes.length > 0 ? `
      <table>
        <tr>
          <th>Fecha</th>
          <th>Descripción</th>
          <th>Tipo</th>
          <th>Monto</th>
        </tr>
        ${resultado.transaccionesBancariasPendientes.map(p => `
          <tr class="pendiente">
            <td>${p.fecha}</td>
            <td>${p.descripcion}</td>
            <td>${p.tipo}</td>
            <td>$${p.monto.toLocaleString()}</td>
          </tr>
        `).join('')}
      </table>
    ` : '<p>Sin partidas pendientes</p>'}
  </div>

  <div class="section">
    <h2>Transacciones Contables Pendientes (${resultado.transaccionesContablesPendientes.length})</h2>
    ${resultado.transaccionesContablesPendientes.length > 0 ? `
      <table>
        <tr>
          <th>Fecha</th>
          <th>Glosa</th>
          <th>Tipo</th>
          <th>Monto</th>
        </tr>
        ${resultado.transaccionesContablesPendientes.map(p => `
          <tr class="pendiente">
            <td>${p.fecha}</td>
            <td>${p.glosa}</td>
            <td>${p.tipo}</td>
            <td>$${p.monto.toLocaleString()}</td>
          </tr>
        `).join('')}
      </table>
    ` : '<p>Sin partidas pendientes</p>'}
  </div>

  <div class="section">
    <h2>Resumen</h2>
    <p><strong>Saldo Banco:</strong> $${saldoBanco.toLocaleString()}</p>
    <p><strong>Saldo Contable:</strong> $${saldoContable.toLocaleString()}</p>
    <p class="diferencia"><strong>Diferencia:</strong> $${(saldoBanco - saldoContable).toLocaleString()}</p>
  </div>

  <footer>
    <p>Contable Chile - Sistema de Gestión Contable</p>
  </footer>
</body>
</html>
    `;
    return html;
  }

  // Generar mensaje de resultado
  private static generarMensaje(
    conciliadas: number,
    pendientesBanco: number,
    pendientesContable: number
  ): string {
    if (conciliadas === 0 && pendientesBanco === 0 && pendientesContable === 0) {
      return 'No hay transacciones para conciliar';
    }

    if (pendientesBanco === 0 && pendientesContable === 0) {
      return `Conciliación completa. ${conciliadas} partidas conciliadas.`;
    }

    const partes: string[] = [];
    partes.push(`${conciliadas} partidas conciliadas`);

    if (pendientesBanco > 0) {
      partes.push(`${pendientesBanco} transacciones bancarias pendientes`);
    }

    if (pendientesContable > 0) {
      partes.push(`${pendientesContable} transacciones contables pendientes`);
    }

    return partes.join(', ') + '.';
  }

  // Calcular saldo bancos
  static calcularSaldo(transacciones: TransaccionBancaria[]): number {
    return transacciones.reduce((saldo, t) => {
      return t.tipo === 'credito' ? saldo + t.monto : saldo - t.monto;
    }, 0);
  }

  // Importar transacciones desde CSV del banco
  static importarCSV(csvContent: string): TransaccionBancaria[] {
    const lineas = csvContent.split('\n').filter(l => l.trim());
    const transacciones: TransaccionBancaria[] = [];

    // Omitir encabezado si existe
    const inicio = lineas[0]?.toLowerCase().includes('fecha') ? 1 : 0;

    for (let i = inicio; i < lineas.length; i++) {
      const partes = lineas[i].split(';');
      if (partes.length >= 4) {
        transacciones.push({
          id: generateId(),
          fecha: partes[0].trim(),
          descripcion: partes[1].trim(),
          tipo: partes[2].trim().toLowerCase().includes('cr') ? 'credito' : 'debito',
          monto: parseFloat(partes[3].replace(/\./g, '').replace(',', '.')) || 0,
          referencia: partes[4]?.trim(),
          conciliada: false,
        });
      }
    }

    return transacciones;
  }
}
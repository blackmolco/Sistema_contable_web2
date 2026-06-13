// Servicio de Exportación - Excel y PDF
import { formatCurrency, formatDate } from '../utils/calculos';
import type { DocumentoTributario, Trabajador } from '../types';

export type ExportFormat = 'excel' | 'pdf' | 'csv';

// Datos de documento para exportar
export interface ExportData {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  summary?: { label: string; value: string | number }[];
  footer?: string;
}

// Generar contenido CSV
export function generateCSV(data: ExportData): string {
  const lines: string[] = [];

  // Título
  lines.push(data.title.toUpperCase());
  if (data.subtitle) lines.push(data.subtitle);
  lines.push('');

  // Encabezados
  lines.push(data.headers.join(';'));

  // Filas
  data.rows.forEach(row => {
    lines.push(row.map(cell => {
      const str = String(cell);
      return str.includes(';') ? `"${str}"` : str;
    }).join(';'));
  });

  // Resumen
  if (data.summary && data.summary.length > 0) {
    lines.push('');
    data.summary.forEach(item => {
      lines.push(`${item.label};${item.value}`);
    });
  }

  // Footer
  if (data.footer) {
    lines.push('');
    lines.push(data.footer);
  }

  lines.push('');
  lines.push(`Generado: ${formatDate(new Date().toISOString())}`);

  return lines.join('\n');
}

// Generar HTML para PDF
export function generatePDFHTML(data: ExportData): string {
  const tableRows = data.rows.map(row => {
    return `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
  }).join('');

  const summaryRows = data.summary?.map(item => `
    <tr class="summary">
      <td colspan="${data.headers.length - 1}">${item.label}</td>
      <td class="value">${item.value}</td>
    </tr>
  `).join('') || '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${data.title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
    h1 { color: #1E3A5F; font-size: 24px; margin-bottom: 5px; }
    h2 { color: #666; font-size: 14px; font-weight: normal; margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th { background: #1E3A5F; color: white; padding: 12px; text-align: left; font-size: 12px; }
    td { padding: 10px; border-bottom: 1px solid #ddd; font-size: 12px; }
    tr:hover { background: #f5f5f5; }
    .summary { font-weight: bold; background: #f0f0f0; }
    .value { text-align: right; }
    .footer { margin-top: 30px; font-size: 10px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <h1>${data.title}</h1>
  ${data.subtitle ? `<h2>${data.subtitle}</h2>` : ''}

  <table>
    <thead>
      <tr>${data.headers.map(h => `<th>${h}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${tableRows}
      ${summaryRows}
    </tbody>
  </table>

  <div class="footer">
    ${data.footer || ''}<br/>
    Generado el ${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL')}
  </div>
</body>
</html>
  `;
}

// Descargar archivo
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Exportar a CSV
export function exportToCSV(data: ExportData, filename: string): void {
  const csv = generateCSV(data);
  downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8');
}

// Exportar a PDF (usando HTML)
export function exportToPDF(data: ExportData, filename: string): void {
  const html = generatePDFHTML(data);
  downloadFile(html, `${filename}.html`, 'text/html');

  // Abrir para imprimir como PDF
  setTimeout(() => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  }, 500);
}

export interface LiquidacionExport {
  sueldoBase: number;
  gratificacion: number;
  horasExtra: number;
  bonos: number;
  afp: number;
  salud: number;
  afc: number;
  impuestoUnico: number;
  cotizacionVoluntaria: number;
  otrosDescuentos: number;
  totalHaberes: number;
  totalDescuentos: number;
  sueldoLiquido: number;
}

// Clase de exportación para reportes contables
export class ExportService {

  // Exportar libro de ventas/compras
  static exportarLibro(
    tipo: 'ventas' | 'compras',
    documentos: DocumentoTributario[],
    periodo: string
  ) {
    const headers = ['Fecha', 'Tipo', 'Número', 'RUT', 'Razón Social', 'Neto', 'IVA', 'Total'];

    const rows = documentos.map(doc => [
      formatDate(doc.fecha),
      doc.tipo.toUpperCase(),
      doc.numero,
      doc.receptor.rut,
      doc.receptor.razonSocial,
      doc.subtotal,
      doc.iva,
      doc.total,
    ]);

    const totalNeto = documentos.reduce((sum, d) => sum + d.subtotal, 0);
    const totalIVA = documentos.reduce((sum, d) => sum + d.iva, 0);
    const totalTotal = documentos.reduce((sum, d) => sum + d.total, 0);

    const data: ExportData = {
      title: `Libro de ${tipo === 'ventas' ? 'Ventas' : 'Compras'}`,
      subtitle: `Período: ${periodo}`,
      headers,
      rows,
      summary: [
        { label: 'Total Neto', value: formatCurrency(totalNeto) },
        { label: 'Total IVA', value: formatCurrency(totalIVA) },
        { label: 'Total General', value: formatCurrency(totalTotal) },
      ],
      footer: 'Contable Chile - Sistema de Gestión Contable',
    };

    return data;
  }

  // Exportar balance de comprobación
  static exportarBalance(
    cuentas: { codigo: string; nombre: string; debe: number; haber: number }[]
  ) {
    const headers = ['Código', 'Cuenta', 'Débitos', 'Créditos'];

    const rows = cuentas.map(c => [
      c.codigo,
      c.nombre,
      c.debe,
      c.haber,
    ]);

    const totalDebe = cuentas.reduce((sum, c) => sum + c.debe, 0);
    const totalHaber = cuentas.reduce((sum, c) => sum + c.haber, 0);

    const data: ExportData = {
      title: 'Balance de Comprobación',
      subtitle: `Fecha: ${formatDate(new Date().toISOString())}`,
      headers,
      rows,
      summary: [
        { label: 'Total Débitos', value: formatCurrency(totalDebe) },
        { label: 'Total Créditos', value: formatCurrency(totalHaber) },
      ],
      footer: 'Contable Chile',
    };

    return data;
  }

  // Exportar estado de resultados
  static exportarEstadoResultados(
    ingresos: { concepto: string; monto: number }[],
    gastos: { concepto: string; monto: number }[],
    titulo: string
  ) {
    const headers = ['Concepto', 'Monto'];

    const rowsIngresos = ingresos.map(i => [i.concepto, i.monto]);
    const rowsGastos = gastos.map(g => [g.concepto, g.monto]);

    const totalIngresos = ingresos.reduce((sum, i) => sum + i.monto, 0);
    const totalGastos = gastos.reduce((sum, g) => sum + g.monto, 0);
    const resultado = totalIngresos - totalGastos;

    const rows = [
      ...rowsIngresos,
      [{ label: 'TOTAL INGRESOS', value: 0 }], // marker
      ...rowsGastos,
      [{ label: 'TOTAL GASTOS', value: 0 }], // marker
    ];

    const data: ExportData = {
      title: titulo,
      subtitle: `Período: ${formatDate(new Date().toISOString())}`,
      headers,
      rows: rowsIngresos.length > 0
        ? [...rowsIngresos, ['TOTAL INGRESOS', totalIngresos], ...rowsGastos, ['TOTAL GASTOS', totalGastos], ['RESULTADO', resultado]]
        : [...rowsGastos, ['TOTAL GASTOS', totalGastos]],
      summary: [
        { label: 'Resultado del Ejercicio', value: formatCurrency(resultado) },
      ],
      footer: 'Contable Chile',
    };

    return data;
  }

  // Exportar líquido de remuneraciones
  static exportarLiquidacion(
    trabajador: Pick<Trabajador, 'nombre' | 'apellidos'>,
    liquidacion: LiquidacionExport,
    periodo: string
  ) {
    const data: ExportData = {
      title: 'Liquidación de Sueldo',
      subtitle: `${trabajador.nombre} ${trabajador.apellidos} - ${periodo}`,
      headers: ['Concepto', 'Haberes', 'Descuentos'],
      rows: [
        ['Sueldo Base', liquidacion.sueldoBase, ''],
        ['Gratificación', liquidacion.gratificacion, ''],
        ['Horas Extra', liquidacion.horasExtra, ''],
        ['Bonos', liquidacion.bonos, ''],
        ['AFP', '', liquidacion.afp],
        ['Salud (Isapre)', '', liquidacion.salud],
        ['AFC', '', liquidacion.afc],
        ['Impuesto Único', '', liquidacion.impuestoUnico],
        ['Cotización Voluntaria', '', liquidacion.cotizacionVoluntaria],
        ['Otros Descuentos', '', liquidacion.otrosDescuentos],
      ],
      summary: [
        { label: 'Total Haberes', value: formatCurrency(liquidacion.totalHaberes) },
        { label: 'Total Descuentos', value: formatCurrency(liquidacion.totalDescuentos) },
        { label: 'Sueldo Líquido', value: formatCurrency(liquidacion.sueldoLiquido) },
      ],
      footer: 'Contable Chile - Boleta de Pago',
    };

    return data;
  }
}

// Componente de utilidades de exportación
export function useExport() {
  const exportToFormat = (data: ExportData, filename: string, format: ExportFormat) => {
    switch (format) {
      case 'csv':
        exportToCSV(data, filename);
        break;
      case 'pdf':
        exportToPDF(data, filename);
        break;
      case 'excel':
        // Por ahora tratamos Excel como CSV
        exportToCSV(data, filename);
        break;
    }
  };

  return { exportToFormat, exportToCSV, exportToPDF };
}

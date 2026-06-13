import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAppStore } from '../stores/appStore';
import { ResultadoSueldoLiquido, LiquidoCalculado, Trabajador, LiquidacionLinea, ConfiguracionEmpresa } from '../types';
import { Empresa } from '../stores/appStore';
import { formatCurrency, formatRUT, numeroALetras, formatDate } from '../utils/calculos';
import { UF_2026_MAYO_REFERENCIAL, UTM_2026_MAYO, TOPES_LEGALES, getHorasSemanalesPorPeriodo } from '../data/normativa';
import { PreviRedService } from './PreviRedService';

function obtenerEmpresaConfig(config?: ConfiguracionEmpresa) {
  // 1. Preferir config explícito (viene de AppContext — es la fuente de verdad)
  if (config?.razonSocial) {
    return config as any;
  }
  // 2. Leer directamente de localStorage (AppContext guarda aquí la config real)
  try {
    const raw = localStorage.getItem('scc_app');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.configuracion?.razonSocial) {
        return parsed.configuracion;
      }
    }
  } catch (e) {}
  // 3. Fallback al store multi-empresa (puede tener datos demo)
  return useAppStore.getState().empresaActiva;
}

function dibujarLiquidacionFormato(
  doc: jsPDF,
  empresa: ConfiguracionEmpresa | Empresa | undefined | null,
  periodo: string,
  linea: {
    nombre: string; apellidos: string; rut: string; cargo: string; afpNombre: string; tipoContrato: string; fechaIngreso: string;
    sueldoBase: number; horasExtras: number; montoHorasExtras: number; gratificacion: number; colacion: number; movilizacion: number; bonificacion: number; asignacionFamiliar: number;
    totalImponible: number; totalHaberes: number;
    afp: number; salud: number; afc: number; impuestoUnico: number; anticipos: number;
    totalDescuentos: number; sueldoLiquido: number;
  },
  indicadores: { uf: number; utm: number; topeImponible: number; horasSemanales: number }
) {
  // HEADER
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text('Liquidación de Remuneraciones', 105, 20, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Período: ${periodo}`, 105, 27, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`UF: ${formatCurrency(indicadores.uf)} - UTM: ${formatCurrency(indicadores.utm)} - Tope Imponible: ${formatCurrency(indicadores.topeImponible)}`, 105, 32, { align: 'center' });

  // Draw main outer box
  doc.setDrawColor(203, 213, 225); // gray-300
  doc.setLineWidth(0.3);
  doc.roundedRect(15, 40, 180, 160, 2, 2);

  // SECTION 1: Contract info
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('Fecha de Inicio de Contrato', 18, 46);
  doc.text(linea.fechaIngreso || '01-01-2025', 85, 46, { align: 'right' });
  doc.text('Días Remunerados', 105, 46);
  doc.text('30', 190, 46, { align: 'right' });

  doc.text('Jornada Completa', 18, 52);
  doc.text(`Horas Semanales: ${indicadores.horasSemanales}`, 85, 52, { align: 'right' });
  doc.text('Sueldo Base Pactado: ' + formatCurrency(linea.sueldoBase), 190, 52, { align: 'right' });

  doc.line(15, 56, 195, 56);

  // SECTION 2: Empleador / Trabajador Header
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(15, 56, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('Empleador', 18, 61);
  doc.text('Trabajadora', 105, 61);
  doc.line(103, 56, 103, 90);
  doc.line(15, 64, 195, 64);

  // SECTION 2: Details
  doc.setFont('helvetica', 'normal');
  doc.text('Nombre', 18, 70);
  doc.text(empresa?.razonSocial || 'Empresa No Definida', 100, 70, { align: 'right' });
  doc.text('RUN', 18, 75);
  doc.text(empresa?.rut || 'Sin RUT', 100, 75, { align: 'right' });

  doc.text('Nombre', 105, 70);
  doc.text(`${linea.nombre} ${linea.apellidos}`, 190, 70, { align: 'right' });
  doc.text('RUN', 105, 75);
  doc.text(linea.rut, 190, 75, { align: 'right' });
  doc.text('Salud', 105, 80);
  doc.text('FONASA/ISAPRE', 190, 80, { align: 'right' });
  doc.text('AFP', 105, 85);
  doc.text(linea.afpNombre, 190, 85, { align: 'right' });
  doc.text('Cargo', 105, 90);
  doc.text(linea.cargo || '', 190, 90, { align: 'right' });

  doc.line(15, 93, 195, 93);

  // SECTION 3: Haberes / Descuentos Header
  doc.setFillColor(241, 245, 249);
  doc.rect(15, 93, 180, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('Haberes', 18, 98);
  doc.text('Descuentos', 105, 98);
  doc.line(103, 93, 103, 175);
  doc.line(15, 101, 195, 101);

  // SECTION 3: Details
  doc.setFont('helvetica', 'normal');
  let yHab = 107;
  doc.text('Sueldo Base', 18, yHab); doc.text(formatCurrency(linea.sueldoBase), 100, yHab, { align: 'right' }); yHab+=5;
  if (linea.montoHorasExtras > 0) { doc.text(`Horas Extras (${linea.horasExtras})`, 18, yHab); doc.text(formatCurrency(linea.montoHorasExtras), 100, yHab, { align: 'right' }); yHab+=5; }
  if (linea.movilizacion > 0) { doc.text('Asignación Movilización', 18, yHab); doc.text(formatCurrency(linea.movilizacion), 100, yHab, { align: 'right' }); yHab+=5; }
  if (linea.colacion > 0) { doc.text('Asignación Alimentación', 18, yHab); doc.text(formatCurrency(linea.colacion), 100, yHab, { align: 'right' }); yHab+=5; }
  if (linea.asignacionFamiliar > 0) { doc.text('Asignación Familiar', 18, yHab); doc.text(formatCurrency(linea.asignacionFamiliar), 100, yHab, { align: 'right' }); yHab+=5; }
  if (linea.gratificacion > 0) { doc.text('Gratificación Legal', 18, yHab); doc.text(formatCurrency(linea.gratificacion), 100, yHab, { align: 'right' }); yHab+=5; }
  if (linea.bonificacion > 0) { doc.text('Otros Bonos', 18, yHab); doc.text(formatCurrency(linea.bonificacion), 100, yHab, { align: 'right' }); yHab+=5; }

  let yDesc = 107;
  doc.text(`AFP`, 105, yDesc); doc.text(formatCurrency(linea.afp), 190, yDesc, { align: 'right' }); yDesc+=5;
  doc.text(`Salud (7%)`, 105, yDesc); doc.text(formatCurrency(linea.salud), 190, yDesc, { align: 'right' }); yDesc+=5;
  if (linea.afc > 0) { doc.text(`Seguro Cesantía`, 105, yDesc); doc.text(formatCurrency(linea.afc), 190, yDesc, { align: 'right' }); yDesc+=5; }
  if (linea.impuestoUnico > 0) { doc.text(`Impuesto Único`, 105, yDesc); doc.text(formatCurrency(linea.impuestoUnico), 190, yDesc, { align: 'right' }); yDesc+=5; }
  if (linea.anticipos > 0) { doc.text(`Anticipos`, 105, yDesc); doc.text(formatCurrency(linea.anticipos), 190, yDesc, { align: 'right' }); yDesc+=5; }

  // SECTION 3: Totals
  doc.line(18, 155, 100, 155);
  doc.line(105, 155, 190, 155);
  doc.setFont('helvetica', 'bold');
  doc.text('Total Imponible', 18, 160); doc.text(formatCurrency(linea.totalImponible), 100, 160, { align: 'right' });
  doc.text('Total Haberes', 18, 165); doc.text(formatCurrency(linea.totalHaberes), 100, 165, { align: 'right' });
  doc.text('Total Descuentos', 105, 165); doc.text(formatCurrency(linea.totalDescuentos), 190, 165, { align: 'right' });

  doc.line(15, 175, 195, 175);

  // SECTION 4: Alcance Liquido
  doc.setFillColor(241, 245, 249);
  doc.rect(15, 175, 180, 8, 'F');
  doc.text('Alcance Líquido', 105, 180, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(formatCurrency(linea.sueldoLiquido), 105, 188, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Son: ${numeroALetras(linea.sueldoLiquido)}`, 105, 193, { align: 'center' });

  // SIGNATURE AREA
  doc.text(`Certifico que he recibido de ${empresa?.razonSocial || 'Empleador'}, a mi entera\nsatisfacción el alcance líquido indicado en la presente liquidación y no\ntengo cargo ni cobro posterior que hacer.`, 15, 230);
  
  doc.line(130, 240, 180, 240);
  doc.setFont('helvetica', 'bold');
  doc.text(`${linea.nombre} ${linea.apellidos}`, 155, 245, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.text('Trabajador/a', 155, 249, { align: 'center' });
  doc.text(linea.rut, 155, 253, { align: 'center' });
}

export function generarPDFLiquidacionDesdeLinea(
  linea: LiquidacionLinea,
  periodoLabel: string,
  config?: ConfiguracionEmpresa,
  periodoKey?: string,   // 'YYYY-MM' para obtener UF/UTM/horas correctas del período
  ufStored?: number,     // UF guardada en LiquidacionPeriodo (prioritaria)
  utmStored?: number,    // UTM guardada en LiquidacionPeriodo (prioritaria)
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const empresa = obtenerEmpresaConfig(config);

  // Indicadores del período correcto
  const key = periodoKey ?? '';
  const fromService = key ? PreviRedService.getIndicadoresPDF(key) : null;
  const indicadores = {
    uf:             ufStored  ?? fromService?.uf  ?? UF_2026_MAYO_REFERENCIAL,
    utm:            utmStored ?? fromService?.utm ?? UTM_2026_MAYO,
    topeImponible:  fromService?.topeImponible    ?? TOPES_LEGALES.COTIZACION_AFP_SALUD_MAX,
    horasSemanales: key ? getHorasSemanalesPorPeriodo(key) : 42,
  };

  dibujarLiquidacionFormato(doc, empresa, periodoLabel, {
    nombre: linea.nombre, apellidos: linea.apellidos, rut: linea.rut, cargo: linea.cargo,
    afpNombre: linea.afpNombre, tipoContrato: linea.tipoContrato, fechaIngreso: '',
    sueldoBase: linea.sueldoBase, horasExtras: linea.horasExtras ?? 0, montoHorasExtras: linea.montoHorasExtras ?? 0, gratificacion: linea.gratificacion,
    colacion: linea.colacion, movilizacion: linea.movilizacion, bonificacion: linea.bonificacion, asignacionFamiliar: 0,
    totalImponible: linea.totalImponible, totalHaberes: linea.totalHaberes,
    afp: linea.totalAfp, salud: linea.salud, afc: linea.afc, impuestoUnico: linea.impuestoUnico, anticipos: linea.anticipos,
    totalDescuentos: linea.totalDescuentos, sueldoLiquido: linea.sueldoLiquido
  }, indicadores);

  const rutSafe = linea.rut.replace(/[.\-]/g, '');
  const perSafe = periodo.replace(/\s/g, '_');
  doc.save(`liquidacion_${rutSafe}_${perSafe}.pdf`);
}

type LiquidoReal = LiquidoCalculado & ResultadoSueldoLiquido;

const ACCENT = '#1E3A5F';

function agregarHeader(doc: jsPDF, titulo: string, subtitulo?: string, config?: ConfiguracionEmpresa | Empresa) {
  let empresa: ConfiguracionEmpresa | Empresa | null | undefined = useAppStore.getState().empresaActiva;
  
  // Fallback a configuración local (legacy) si no hay empresa seleccionada en el AppStore
  if (!empresa) {
    if (config) {
      empresa = config as any;
    } else {
      try {
        const raw = localStorage.getItem('scc_app');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.configuracion) {
            empresa = parsed.configuracion;
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }

  if (!empresa) {
    doc.setFontSize(14);
    doc.text(titulo, 14, 20);
    return;
  }

  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(empresa.nombreFantasia || 'Empresa', 14, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${empresa.razonSocial} | RUT: ${empresa.rut}`, 14, 21);
  doc.text(`${empresa.direccion || ''} | ${empresa.comuna || ''}, ${empresa.ciudad || ''}`, 14, 27);

  if (empresa.logo) {
    try {
      doc.addImage(empresa.logo, 'PNG', 175, 5, 25, 18);
    } catch {
      // Logos cargados por el usuario pueden venir en formatos no soportados por jsPDF.
    }
  }

  doc.setTextColor(30, 58, 95);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(titulo, 14, 38);

  if (subtitulo) {
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitulo, 14, 45);
  }

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(14, 48, 196, 48);
}

function piePagina(doc: jsPDF, pagina: number, total: number) {
  const pages = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado: ${format(new Date(), "dd 'de' MMMM yyyy, HH:mm", { locale: es })}`, 14, 290);
  doc.text(`Pagina ${pagina} de ${total}`, 186, 290, { align: 'right' });
}

export function generarPDFLiquidacion(
  trabajador: Trabajador,
  liquido: ResultadoSueldoLiquido | LiquidoCalculado,
  periodo: string,         // Puede ser 'YYYY-MM' o label humano "Mayo 2026"
  config?: ConfiguracionEmpresa,
  periodoKey?: string,     // 'YYYY-MM' para indicadores (si periodo es label humano)
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const empresa = obtenerEmpresaConfig(config);

  // Determinar el periodoKey para el lookup de indicadores
  // Si periodo ya tiene formato YYYY-MM lo usamos directo, si no usamos periodoKey
  const key = periodoKey ?? (/^\d{4}-\d{2}$/.test(periodo) ? periodo : '');
  const fromService = key ? PreviRedService.getIndicadoresPDF(key) : null;
  const indicadores = {
    uf:             fromService?.uf  ?? UF_2026_MAYO_REFERENCIAL,
    utm:            fromService?.utm ?? UTM_2026_MAYO,
    topeImponible:  fromService?.topeImponible ?? TOPES_LEGALES.COTIZACION_AFP_SALUD_MAX,
    horasSemanales: key ? getHorasSemanalesPorPeriodo(key) : 42,
  };

  const l = liquido as ResultadoSueldoLiquido;
  const l2 = liquido as LiquidoCalculado;

  const liquidoPagar = l.sueldoLiquido || l2.sueldoLiquido || 0;
  const totalHaberes = l.totalHaberes || l2.totalHaberes || 0;
  const imponible = l.imponible || l2.sueldoImponible || 0;
  const totalAfp = l.cotizaciones?.totalAfp || l2.afp?.total || 0;
  const totalSalud = l.cotizaciones?.salud || l2.salud?.cotizacion || 0;
  const totalAfc = l.cotizaciones?.afc || l2.afc || 0;
  const totalImpuesto = l.impuestoUnico || l2.impuestoUnico || 0;
  const totalDescuentos = (l.cotizaciones?.total || 0) + totalImpuesto + (l2.totalCotizaciones || 0);

  const mHExtras = l.montoHorasExtras || 0;
  const hExtras = l.horasExtras || 0;
  const asigFam = l.asignacionFamiliar || 0;
  const gratif = l.gratificacion ?? ((imponible - trabajador.sueldoBase - mHExtras) > 0 ? (imponible - trabajador.sueldoBase - mHExtras) : 0);

  let afpName = 'AFP';
  if (trabajador.afpId) {
    const fromList = ['Provida', 'Habitat', 'Capital', 'Cuprum', 'PlanVital', 'Modelo', 'Uno'].find(x => trabajador.afpId?.toLowerCase().includes(x.toLowerCase()));
    if (fromList) afpName = 'AFP ' + fromList;
  }

  dibujarLiquidacionFormato(doc, empresa, periodo, {
    nombre: trabajador.nombre, apellidos: trabajador.apellidos, rut: trabajador.rut, cargo: trabajador.cargo,
    afpNombre: afpName, tipoContrato: trabajador.tipoContrato, fechaIngreso: trabajador.fechaIngreso,
    sueldoBase: trabajador.sueldoBase, horasExtras: hExtras, montoHorasExtras: mHExtras,
    gratificacion: gratif,
    colacion: trabajador.colacion, movilizacion: trabajador.movilizacion, bonificacion: trabajador.bonificacion || 0, asignacionFamiliar: asigFam,
    totalImponible: imponible, totalHaberes: totalHaberes + asigFam,
    afp: totalAfp, salud: totalSalud, afc: totalAfc, impuestoUnico: totalImpuesto, anticipos: 0,
    totalDescuentos: totalDescuentos, sueldoLiquido: liquidoPagar
  }, indicadores);

  const rutSafe = trabajador.rut.replace(/[.\-]/g, '');
  const perSafe = periodo.replace(/\s/g, '_');
  doc.save(`liquidacion_${rutSafe}_${perSafe}.pdf`);
}

export function generarPDFEstadoFinanciero(
  titulo: string,
  data: { label: string; valor: number }[],
  fecha?: string
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  agregarHeader(doc, titulo, fecha || format(new Date(), "dd 'de' MMMM yyyy", { locale: es }));

  autoTable(doc, {
    startY: 54,
    head: [['Cuenta', 'Monto (CLP)']],
    body: data.map(row => [row.label, formatCurrency(row.valor)]),
    theme: 'striped',
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 140 }, 1: { cellWidth: 46, halign: 'right' } },
    margin: { left: 14, right: 14 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    piePagina(doc, i, pages);
  }

  const filename = `${titulo.replace(/\s+/g, '_')}_${(fecha || format(new Date(), 'yyyyMMdd')).replace(/\s/g, '_')}.pdf`;
  doc.save(filename);
}

export function generarPDFAsientos(
  asientos: {
    fecha: string; numero: number; glosa: string;
    detalles: { cuenta: string; nombre: string; debe: number; haber: number }[];
    totalDebe: number; totalHaber: number;
  }[]
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  agregarHeader(doc, 'Libro Diario', 'Detalle de Asientos Contables');

  autoTable(doc, {
    startY: 54,
    head: [['N#', 'Fecha', 'Glosa', 'Cuenta', 'Debe (CLP)', 'Haber (CLP)']],
    body: asientos.flatMap((a) => [
      [
        String(a.numero), a.fecha, a.glosa, '', '', ''
      ],
      ...a.detalles.map((d) => [
        '', '', '', `${d.cuenta} - ${d.nombre}`,
        d.debe > 0 ? formatCurrency(d.debe) : '',
        d.haber > 0 ? formatCurrency(d.haber) : '',
      ]),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 22 },
      2: { cellWidth: 65 },
      3: { cellWidth: 70 },
      4: { cellWidth: 35, halign: 'right' },
      5: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    piePagina(doc, i, pages);
  }

  doc.save('libro_diario.pdf');
}

export function generarPDFMayorContable(
  cuentaCodigo: string,
  cuentaNombre: string,
  movimientos: { fecha: string; numeroAsiento: number; glosa: string; debe: number; haber: number; saldo: number }[],
  fechaDesde?: string,
  fechaHasta?: string
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const rango = fechaDesde && fechaHasta
    ? `${format(new Date(fechaDesde + 'T12:00:00'), "dd/MM/yyyy")} – ${format(new Date(fechaHasta + 'T12:00:00'), "dd/MM/yyyy")}`
    : format(new Date(), "dd 'de' MMMM yyyy", { locale: es });
  agregarHeader(doc, `Libro Mayor — ${cuentaCodigo}`, `${cuentaNombre} | ${rango}`);

  const totalDebe = movimientos.reduce((s, m) => s + m.debe, 0);
  const totalHaber = movimientos.reduce((s, m) => s + m.haber, 0);
  const saldoFinal = movimientos.at(-1)?.saldo ?? 0;

  autoTable(doc, {
    startY: 54,
    head: [['Fecha', 'N° Asiento', 'Glosa', 'Debe (CLP)', 'Haber (CLP)', 'Saldo (CLP)']],
    body: [
      ...movimientos.map((m) => [
        formatDate(m.fecha),
        `#${m.numeroAsiento}`,
        m.glosa,
        m.debe > 0 ? formatCurrency(m.debe) : '',
        m.haber > 0 ? formatCurrency(m.haber) : '',
        formatCurrency(m.saldo),
      ]),
      // Fila de totales
      [
        { content: 'TOTALES', colSpan: 3, styles: { fontStyle: 'bold', halign: 'right' as const } },
        { content: formatCurrency(totalDebe), styles: { fontStyle: 'bold', halign: 'right' as const } },
        { content: formatCurrency(totalHaber), styles: { fontStyle: 'bold', halign: 'right' as const } },
        { content: formatCurrency(saldoFinal), styles: { fontStyle: 'bold', halign: 'right' as const, fillColor: saldoFinal >= 0 ? [209, 250, 229] : [254, 226, 226] } },
      ],
    ],
    theme: 'striped',
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 95 },
      3: { cellWidth: 38, halign: 'right' },
      4: { cellWidth: 38, halign: 'right' },
      5: { cellWidth: 38, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    piePagina(doc, i, pages);
  }

  const rutSafe = cuentaCodigo.replace(/\./g, '');
  doc.save(`libro_mayor_${rutSafe}_${(rango).replace(/[\s/–]/g, '_')}.pdf`);
}

export function generarPDFResumen(
  tipo: 'ventas' | 'compras',
  registros: { fecha: string; rut: string; razonSocial: string; neto: number; iva: number; total: number }[],
  periodo: string
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const label = tipo === 'ventas' ? 'Libro de Ventas' : 'Libro de Compras';
  agregarHeader(doc, label, periodo);

  autoTable(doc, {
    startY: 54,
    head: [['Fecha', 'RUT', 'Razon Social', 'Neto (CLP)', 'IVA (CLP)', 'Total (CLP)']],
    body: registros.map(r => [
      r.fecha, r.rut, r.razonSocial,
      formatCurrency(r.neto),
      formatCurrency(r.iva),
      formatCurrency(r.total),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 25 }, 1: { cellWidth: 30 }, 2: { cellWidth: 60 },
      3: { cellWidth: 35, halign: 'right' }, 4: { cellWidth: 30, halign: 'right' }, 5: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    piePagina(doc, i, pages);
  }

  doc.save(`${tipo === 'ventas' ? 'libro_ventas' : 'libro_compras'}_${periodo.replace(/\s/g, '_')}.pdf`);
}

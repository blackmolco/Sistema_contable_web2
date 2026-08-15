// Paleta categórica compartida por todos los gráficos de la app — un color fijo
// por concepto, no hex sueltos por página. Valores validados (CVD-safe, all-pairs)
// con la skill dataviz: node scripts/validate_palette.js "#2a78d6,#eb6834,#1baf7a"
export const CHART_PALETTE = {
  ventas:     '#1baf7a', // aqua  — slot 3
  ingresos:   '#1baf7a', // mismo concepto que "ventas"
  neto:       '#1baf7a',
  saldo:      '#1baf7a',
  compras:    '#2a78d6', // blue  — slot 1
  proyectado: '#2a78d6', // base/confirmado
  gastos:     '#eb6834', // orange— slot 2
  egresos:    '#eb6834',
  iva:        '#eb6834',
  prediccion: '#4a3aa7', // violet— slot 7, distingue "predicción IA"
  neutro:     '#898781', // gris muted — categoría "Otros"
};

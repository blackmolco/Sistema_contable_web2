export { useAuthStore } from './authStore';
export type { User } from './authStore';

export { useContabilidadStore } from './contabilidadStore';
export type { Cuenta, AsientoContable, DetalleAsiento } from './contabilidadStore';

export { useFacturacionStore } from './facturacionStore';
export type { DocumentoTributario, Honorario } from './facturacionStore';

export { useRemuneracionesStore } from './remuneracionesStore';
export type { Trabajador, LiquidacionSueldo } from './remuneracionesStore';

export { useAppStore } from './appStore';
export type { Empresa, Notificacion, Tarea } from './appStore';

// ===== TESORERIA STORE (migrado de TesoreriaService) =====
export interface FlujoCaja {
  id: string;
  fecha: string;
  tipo: 'entrada' | 'salida';
  categoria: string;
  descripcion: string;
  monto: number;
  origen: 'factura' | 'honorario' | 'arriendo' | 'sueldo' | 'proveedor' | 'impuesto' | 'otro';
  estado: 'proyectado' | 'confirmado' | 'realizado';
}

export interface ProyeccionFlujo {
  fecha: string;
  saldo: number;
  entradas: number;
  salidas: number;
}

export interface AlertaTesoreria {
  id: string;
  tipo: 'warning' | 'danger' | 'info';
  mensaje: string;
  monto?: number;
}

export interface ProductoInventario {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  unidad: string;
  precioCosto: number;
  precioVenta: number;
  stockActual: number;
  stockMinimo: number;
  ubicacion?: string;
  proveedor?: string;
  activo: boolean;
}

export interface MovimientoInventario {
  id: string;
  productoId: string;
  tipo: 'entrada' | 'salida' | 'ajuste' | 'devolucion';
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  motivo: string;
  documento?: string;
  fecha: string;
  usuario: string;
}

export interface AlertaStock {
  producto: ProductoInventario;
  tipo: 'minimo' | 'agotado' | 'exceso';
  mensaje: string;
}

// ===== TESORERIA STORE =====
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { formatCurrency } from '../utils/calculos';

interface TesoreriaState {
  flujoCaja: FlujoCaja[];
  saldoInicial: number;
  setFlujoCaja: (flujo: FlujoCaja[]) => void;
  agregarMovimiento: (m: Omit<FlujoCaja, 'id'>) => FlujoCaja;
  actualizarMovimiento: (id: string, datos: Partial<FlujoCaja>) => FlujoCaja | null;
  eliminarMovimiento: (id: string) => boolean;
  setSaldoInicial: (monto: number) => void;
  calcularSaldoProyectado: (fecha?: string) => number;
  proyectarFlujo: (dias?: number) => ProyeccionFlujo[];
  detectarAnomalias: () => AlertaTesoreria[];
  obtenerSugerencias: () => string[];
}

export const useTesoreriaStore = create<TesoreriaState>()(
  persist(
    (set, get) => ({
      flujoCaja: [],
      saldoInicial: 0,

      setFlujoCaja: (flujo) => set({ flujoCaja: flujo }),

      agregarMovimiento: (m) => {
        const n: FlujoCaja = { id: `flux_${Date.now()}`, ...m };
        set((s) => ({ flujoCaja: [...s.flujoCaja, n] }));
        return n;
      },

      actualizarMovimiento: (id, datos) => {
        let r: FlujoCaja | null = null;
        set((s) => {
          const i = s.flujoCaja.findIndex((f) => f.id === id);
          if (i === -1) return s;
          r = { ...s.flujoCaja[i], ...datos };
          const f = [...s.flujoCaja];
          f[i] = r;
          return { flujoCaja: f };
        });
        return r;
      },

      eliminarMovimiento: (id) => {
        let r = false;
        set((s) => {
          const f = s.flujoCaja.filter((x) => x.id !== id);
          r = f.length < s.flujoCaja.length;
          return { flujoCaja: f };
        });
        return r;
      },

      setSaldoInicial: (monto) => set({ saldoInicial: monto }),

      calcularSaldoProyectado: (fecha) => {
        const { flujoCaja, saldoInicial } = get();
        const limite = fecha || new Date().toISOString();
        let saldo = saldoInicial;
        flujoCaja.filter((f) => f.estado !== 'realizado' && f.fecha <= limite)
          .forEach((f) => { saldo += f.tipo === 'entrada' ? f.monto : -f.monto; });
        return saldo;
      },

      proyectarFlujo: (dias = 30) => {
        const { flujoCaja, saldoInicial } = get();
        const r: ProyeccionFlujo[] = [];
        const hoy = new Date();
        let saldo = saldoInicial;
        flujoCaja.filter((f) => f.fecha <= hoy.toISOString().split('T')[0] && f.estado === 'realizado')
          .forEach((f) => { saldo += f.tipo === 'entrada' ? f.monto : -f.monto; });
        for (let i = 0; i <= dias; i++) {
          const d = new Date(hoy);
          d.setDate(d.getDate() + i);
          const fs = d.toISOString().split('T')[0];
          const en = flujoCaja.filter((f) => f.fecha === fs && f.tipo === 'entrada').reduce((a, b) => a + b.monto, 0);
          const sa = flujoCaja.filter((f) => f.fecha === fs && f.tipo === 'salida').reduce((a, b) => a + b.monto, 0);
          saldo += en - sa;
          r.push({ fecha: fs, saldo, entradas: en, salidas: sa });
        }
        return r;
      },

      detectarAnomalias: () => {
        const { flujoCaja } = get();
        const a: AlertaTesoreria[] = [];
        const sp = get().calcularSaldoProyectado();
        if (sp < 0) a.push({ id: 'a1', tipo: 'danger', mensaje: 'Saldo proyectado negativo', monto: sp });
        else if (sp < 1000000) a.push({ id: 'a2', tipo: 'warning', mensaje: 'Saldo bajo', monto: sp });
        const pp = flujoCaja.filter((f) => {
          const d = Math.ceil((new Date(f.fecha).getTime() - Date.now()) / 86400000);
          return f.tipo === 'salida' && f.estado !== 'realizado' && d >= 0 && d <= 7;
        });
        if (pp.length > 0) a.push({ id: 'a3', tipo: 'warning', mensaje: `${pp.length} pagos esta semana` });
        const im = flujoCaja.filter((f) => f.origen === 'impuesto' && f.estado !== 'realizado');
        if (im.length > 0) a.push({ id: 'a4', tipo: 'info', mensaje: `${im.length} obligaciones tributarias` });
        return a;
      },

      obtenerSugerencias: () => {
        const { flujoCaja } = get();
        const s: string[] = [];
        const saldo = get().calcularSaldoProyectado();
        const fv = flujoCaja.filter((f) => {
          if (f.origen !== 'factura' || f.tipo !== 'entrada') return false;
          const v = new Date(f.fecha);
          v.setDate(v.getDate() + 30);
          return v < new Date() && f.estado !== 'realizado';
        });
        if (fv.length > 0) s.push(`Recuperar ${fv.length} facturas por ${formatCurrency(fv.reduce((a, b) => a + b.monto, 0))}`);
        if (saldo < 2000000) s.push('Considerar linea de credito');
        if (saldo > 10000000) s.push('Evaluar inversiones a corto plazo');
        return s;
      },
    }),
    { name: 'tesoreria-storage', partialize: (st) => ({ flujoCaja: st.flujoCaja, saldoInicial: st.saldoInicial }) }
  )
);

// ===== INVENTARIO STORE (migrado de InventarioService) =====

const CATEGORIAS_DEFAULT = [
  { id: 'cat_1', nombre: 'Mercaderia', descripcion: 'Productos para venta', color: '#3B82F6' },
  { id: 'cat_2', nombre: 'Materia Prima', descripcion: 'Materiales de produccion', color: '#10B981' },
  { id: 'cat_3', nombre: 'Suministros', descripcion: 'Articulos de oficina', color: '#F59E0B' },
  { id: 'cat_4', nombre: 'Activos', descripcion: 'Bienes de uso', color: '#6366F1' },
  { id: 'cat_5', nombre: 'Otros', descripcion: 'Otros productos', color: '#64748B' },
];

function getProductosDemo(): ProductoInventario[] {
  return [
    { id: 'prod_001', codigo: 'MER-001', nombre: 'Notebook Profesional', descripcion: 'Notebook 15.6 i5 8GB 256GB SSD', categoria: 'Mercaderia', unidad: 'UND', precioCosto: 450000, precioVenta: 599000, stockActual: 15, stockMinimo: 5, ubicacion: 'Bodega A-1', proveedor: 'Tech Chile S.A.', activo: true },
    { id: 'prod_002', codigo: 'SUM-001', nombre: 'Resma Papel A4', descripcion: 'Resma de papel bond A4 75gr', categoria: 'Suministros', unidad: 'RES', precioCosto: 3500, precioVenta: 5500, stockActual: 50, stockMinimo: 20, ubicacion: 'Estante B-3', proveedor: 'Office Depot', activo: true },
    { id: 'prod_003', codigo: 'MER-002', nombre: 'Mouse Inalambrico', descripcion: 'Mouse bluetooth ergonomico', categoria: 'Mercaderia', unidad: 'UND', precioCosto: 8500, precioVenta: 15990, stockActual: 3, stockMinimo: 10, ubicacion: 'Bodega A-2', proveedor: 'Tech Chile S.A.', activo: true },
    { id: 'prod_004', codigo: 'MAT-001', nombre: 'Cable HDMI 2m', descripcion: 'Cable HDMI alta velocidad 2 metros', categoria: 'Materia Prima', unidad: 'UND', precioCosto: 4200, precioVenta: 8900, stockActual: 25, stockMinimo: 10, ubicacion: 'Bodega B-1', proveedor: 'Importadora Tech', activo: true },
  ];
}

interface InventarioState {
  productos: ProductoInventario[];
  movimientos: MovimientoInventario[];
  categorias: { id: string; nombre: string; descripcion: string; color: string }[];
  setProductos: (p: ProductoInventario[]) => void;
  agregarProducto: (p: Omit<ProductoInventario, 'id' | 'activo'>) => ProductoInventario;
  actualizarProducto: (id: string, datos: Partial<ProductoInventario>) => ProductoInventario | null;
  eliminarProducto: (id: string) => boolean;
  registrarMovimiento: (m: Omit<MovimientoInventario, 'id'>) => MovimientoInventario;
  verificarAlertas: () => AlertaStock[];
  getResumen: () => { totalProductos: number; totalValorizado: number; bajoStock: number; agotados: number };
  buscarProductos: (termino: string) => ProductoInventario[];
}

export const useInventarioStore = create<InventarioState>()(
  persist(
    (set, get) => ({
      productos: [],
      movimientos: [],
      categorias: CATEGORIAS_DEFAULT,

      setProductos: (p) => set({ productos: p }),

      agregarProducto: (datos) => {
        const nuevo: ProductoInventario = { id: `prod_${Date.now()}`, ...datos, activo: true };
        set((s) => ({ productos: [...s.productos, nuevo] }));
        return nuevo;
      },

      actualizarProducto: (id, datos) => {
        let r: ProductoInventario | null = null;
        set((s) => {
          const i = s.productos.findIndex((p) => p.id === id);
          if (i === -1) return s;
          r = { ...s.productos[i], ...datos };
          const p = [...s.productos];
          p[i] = r;
          return { productos: p };
        });
        return r;
      },

      eliminarProducto: (id) => {
        let r = false;
        set((s) => {
          const f = s.productos.filter((p) => p.id !== id);
          r = f.length < s.productos.length;
          return { productos: f };
        });
        return r;
      },

      registrarMovimiento: (mov) => {
        const n: MovimientoInventario = { id: `mov_${Date.now()}`, ...mov };
        set((s) => ({ movimientos: [n, ...s.movimientos].slice(0, 500) }));
        return n;
      },

      verificarAlertas: () => {
        const { productos } = get();
        const a: AlertaStock[] = [];
        productos.filter((p) => p.activo).forEach((p) => {
          if (p.stockActual <= 0) a.push({ producto: p, tipo: 'agotado', mensaje: `${p.nombre} agotado` });
          else if (p.stockActual <= p.stockMinimo) a.push({ producto: p, tipo: 'minimo', mensaje: `${p.nombre} bajo stock (${p.stockActual}/${p.stockMinimo})` });
          else if (p.stockActual > p.stockMinimo * 3) a.push({ producto: p, tipo: 'exceso', mensaje: `${p.nombre} exceso de stock` });
        });
        return a;
      },



      exportarInventario: () => {
        const { productos } = get();
        return JSON.stringify(productos, null, 2);
      },

      getResumen: () => {
        const { productos } = get();
        const activos = productos.filter((p) => p.activo);
        return {
          totalProductos: activos.length,
          totalValorizado: activos.reduce((s, p) => s + p.stockActual * p.precioCosto, 0),
          bajoStock: activos.filter((p) => p.stockActual <= p.stockMinimo && p.stockActual > 0).length,
          agotados: activos.filter((p) => p.stockActual <= 0).length,
        };
      },

      buscarProductos: (termino) => {
        const t = termino.toLowerCase();
        return get().productos.filter((p) =>
          p.codigo.toLowerCase().includes(t) || p.nombre.toLowerCase().includes(t)
        );
      },
    }),
    {
      name: 'inventario-storage',
      partialize: (st) => ({ productos: st.productos, movimientos: st.movimientos }),
      onRehydrateStorage: () => (state) => {
        if (state && state.productos.length === 0) {
          state.setProductos(getProductosDemo());
        }
      },
    }
  )
);


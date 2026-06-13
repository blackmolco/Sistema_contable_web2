// Servicio de Inventario - Control de Stock

import { generateId } from '../utils/calculos';

export interface Producto {
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
  fechaCreacion: Date;
  fechaActualizacion: Date;
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
  fecha: Date;
  usuario: string;
}

export interface AlertaStock {
  producto: Producto;
  tipo: 'minimo' | 'agotado' | 'exceso';
  mensaje: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  descripcion: string;
  color: string;
}

const CATEGORIAS_DEFAULT: Categoria[] = [
  { id: 'cat_1', nombre: 'Mercadería', descripcion: 'Productos para venta', color: '#3B82F6' },
  { id: 'cat_2', nombre: 'Materia Prima', descripcion: 'Materiales de producción', color: '#10B981' },
  { id: 'cat_3', nombre: 'Suministros', descripcion: 'Artículos de oficina', color: '#F59E0B' },
  { id: 'cat_4', nombre: 'Activos', descripcion: 'Bienes de uso', color: '#6366F1' },
  { id: 'cat_5', nombre: 'Otros', descripcion: 'Otros productos', color: '#64748B' },
];

export class InventarioService {
  private static readonly STORAGE_KEY = 'contable_inventario';
  private static readonly MOVIMIENTOS_KEY = 'contable_movimientos_inventario';
  private static readonly CATEGORIAS_KEY = 'contable_categorias_inventario';

  // Productos de demostración
  private static getProductosDemo(): Producto[] {
    return [
      {
        id: 'prod_001',
        codigo: 'MER-001',
        nombre: 'Notebook Profesional',
        descripcion: 'Notebook 15.6" i5 8GB 256GB SSD',
        categoria: 'Mercadería',
        unidad: 'UND',
        precioCosto: 450000,
        precioVenta: 599000,
        stockActual: 15,
        stockMinimo: 5,
        ubicacion: 'Bodega A-1',
        proveedor: 'Tech Chile S.A.',
        fechaCreacion: new Date('2024-01-15'),
        fechaActualizacion: new Date(),
        activo: true,
      },
      {
        id: 'prod_002',
        codigo: 'SUM-001',
        nombre: 'Resma Papel A4',
        descripcion: 'Resma de papel bond A4 75gr',
        categoria: 'Suministros',
        unidad: 'RES',
        precioCosto: 3500,
        precioVenta: 5500,
        stockActual: 50,
        stockMinimo: 20,
        ubicacion: 'Estante B-3',
        proveedor: 'Office Depot',
        fechaCreacion: new Date('2024-01-20'),
        fechaActualizacion: new Date(),
        activo: true,
      },
      {
        id: 'prod_003',
        codigo: 'MER-002',
        nombre: 'Mouse Inalámbrico',
        descripcion: 'Mouse bluetooth ergonómico',
        categoria: 'Mercadería',
        unidad: 'UND',
        precioCosto: 8500,
        precioVenta: 15990,
        stockActual: 3,
        stockMinimo: 10,
        ubicacion: 'Bodega A-2',
        proveedor: 'Tech Chile S.A.',
        fechaCreacion: new Date('2024-02-01'),
        fechaActualizacion: new Date(),
        activo: true,
      },
      {
        id: 'prod_004',
        codigo: 'MAT-001',
        nombre: 'Cable HDMI 2m',
        descripcion: 'Cable HDMI alta velocidad 2 metros',
        categoria: 'Materia Prima',
        unidad: 'UND',
        precioCosto: 4200,
        precioVenta: 8900,
        stockActual: 25,
        stockMinimo: 10,
        ubicacion: 'Bodega B-1',
        proveedor: 'Importadora Tech',
        fechaCreacion: new Date('2024-02-10'),
        fechaActualizacion: new Date(),
        activo: true,
      },
    ];
  }

  // Obtener todos los productos
  static getProductos(): Producto[] {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    const demo = this.getProductosDemo();
    this.setProductos(demo);
    return demo;
  }

  // Guardar productos
  static setProductos(productos: Producto[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(productos));
  }

  // Obtener categorías
  static getCategorias(): Categoria[] {
    const stored = localStorage.getItem(this.CATEGORIAS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    localStorage.setItem(this.CATEGORIAS_KEY, JSON.stringify(CATEGORIAS_DEFAULT));
    return CATEGORIAS_DEFAULT;
  }

  // Agregar producto
  static agregarProducto(producto: Omit<Producto, 'id' | 'fechaCreacion' | 'fechaActualizacion'>): Producto {
    const productos = this.getProductos();
    const nuevo: Producto = {
      ...producto,
      id: generateId(),
      fechaCreacion: new Date(),
      fechaActualizacion: new Date(),
    };
    productos.push(nuevo);
    this.setProductos(productos);
    return nuevo;
  }

  // Actualizar producto
  static actualizarProducto(id: string, datos: Partial<Producto>): Producto | null {
    const productos = this.getProductos();
    const index = productos.findIndex(p => p.id === id);
    if (index === -1) return null;

    productos[index] = {
      ...productos[index],
      ...datos,
      fechaActualizacion: new Date(),
    };
    this.setProductos(productos);
    return productos[index];
  }

  // Eliminar producto
  static eliminarProducto(id: string): boolean {
    const productos = this.getProductos();
    const filtered = productos.filter(p => p.id !== id);
    if (filtered.length === productos.length) return false;

    this.setProductos(filtered);
    return true;
  }

  // Registrar movimiento
  static registrarMovimiento(movimiento: Omit<MovimientoInventario, 'id'>): MovimientoInventario {
    const movimientos = this.getMovimientos();
    const nuevo: MovimientoInventario = {
      ...movimiento,
      id: generateId(),
    };
    movimientos.unshift(nuevo);

    // Mantener solo últimos 500 movimientos
    if (movimientos.length > 500) {
      movimientos.splice(500);
    }

    localStorage.setItem(this.MOVIMIENTOS_KEY, JSON.stringify(movimientos));
    return nuevo;
  }

  // Obtener movimientos
  static getMovimientos(): MovimientoInventario[] {
    const stored = localStorage.getItem(this.MOVIMIENTOS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return [];
  }

  // Obtener movimientos por producto
  static getMovimientosProducto(productoId: string): MovimientoInventario[] {
    return this.getMovimientos().filter(m => m.productoId === productoId);
  }

  // Ajustar stock
  static ajustarStock(productoId: string, nuevaCantidad: number, motivo: string): boolean {
    const productos = this.getProductos();
    const index = productos.findIndex(p => p.id === productoId);
    if (index === -1) return false;

    const stockAnterior = productos[index].stockActual;
    productos[index].stockActual = nuevaCantidad;
    productos[index].fechaActualizacion = new Date();

    this.setProductos(productos);

    // Registrar movimiento
    this.registrarMovimiento({
      productoId,
      tipo: 'ajuste',
      cantidad: nuevaCantidad - stockAnterior,
      stockAnterior,
      stockNuevo: nuevaCantidad,
      motivo,
      fecha: new Date(),
      usuario: 'admin',
    });

    return true;
  }

  // Entrada de stock
  static entradaStock(productoId: string, cantidad: number, documento: string, motivo: string): boolean {
    const productos = this.getProductos();
    const index = productos.findIndex(p => p.id === productoId);
    if (index === -1) return false;

    const stockAnterior = productos[index].stockActual;
    productos[index].stockActual += cantidad;
    productos[index].fechaActualizacion = new Date();

    this.setProductos(productos);

    this.registrarMovimiento({
      productoId,
      tipo: 'entrada',
      cantidad,
      stockAnterior,
      stockNuevo: productos[index].stockActual,
      motivo,
      documento,
      fecha: new Date(),
      usuario: 'admin',
    });

    return true;
  }

  // Salida de stock
  static salidaStock(productoId: string, cantidad: number, documento: string, motivo: string): boolean {
    const productos = this.getProductos();
    const index = productos.findIndex(p => p.id === productoId);
    if (index === -1) return false;

    if (productos[index].stockActual < cantidad) {
      return false; // Stock insuficiente
    }

    const stockAnterior = productos[index].stockActual;
    productos[index].stockActual -= cantidad;
    productos[index].fechaActualizacion = new Date();

    this.setProductos(productos);

    this.registrarMovimiento({
      productoId,
      tipo: 'salida',
      cantidad,
      stockAnterior,
      stockNuevo: productos[index].stockActual,
      motivo,
      documento,
      fecha: new Date(),
      usuario: 'admin',
    });

    return true;
  }

  // Verificar alertas de stock
  static verificarAlertas(): AlertaStock[] {
    const productos = this.getProductos();
    const alertas: AlertaStock[] = [];

    productos.forEach(producto => {
      if (!producto.activo) return;

      if (producto.stockActual <= 0) {
        alertas.push({
          producto,
          tipo: 'agotado',
          mensaje: `${producto.nombre} está agotado`,
        });
      } else if (producto.stockActual <= producto.stockMinimo) {
        alertas.push({
          producto,
          tipo: 'minimo',
          mensaje: `${producto.nombre} bajo stock mínimo (${producto.stockActual}/${producto.stockMinimo})`,
        });
      } else if (producto.stockActual > producto.stockMinimo * 3) {
        alertas.push({
          producto,
          tipo: 'exceso',
          mensaje: `${producto.nombre} con exceso de stock`,
        });
      }
    });

    return alertas;
  }

  // Obtener resumen de inventario
  static getResumen(): {
    totalProductos: number;
    totalValorizado: number;
    productosActivos: number;
    bajoStock: number;
    agotados: number;
  } {
    const productos = this.getProductos().filter(p => p.activo);
    const totalValorizado = productos.reduce((sum, p) => sum + (p.stockActual * p.precioCosto), 0);
    const bajoStock = productos.filter(p => p.stockActual <= p.stockMinimo && p.stockActual > 0).length;
    const agotados = productos.filter(p => p.stockActual <= 0).length;

    return {
      totalProductos: productos.length,
      totalValorizado,
      productosActivos: productos.filter(p => p.activo).length,
      bajoStock,
      agotados,
    };
  }

  // Buscar productos
  static buscarProductos(termino: string): Producto[] {
    const productos = this.getProductos();
    const lower = termino.toLowerCase();
    return productos.filter(p =>
      p.codigo.toLowerCase().includes(lower) ||
      p.nombre.toLowerCase().includes(lower) ||
      p.descripcion.toLowerCase().includes(lower) ||
      p.categoria.toLowerCase().includes(lower)
    );
  }

  // Exportar inventario
  static exportarInventario(): string {
    return JSON.stringify(this.getProductos());
  }

  // Importar inventario
  static importarInventario(json: string): boolean {
    try {
      const productos = JSON.parse(json);
      this.setProductos(productos);
      return true;
    } catch {
      return false;
    }
  }
}
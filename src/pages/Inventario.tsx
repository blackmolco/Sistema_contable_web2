import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Filter,
  Download,
  Upload,
  ArrowUpDown,
  History,
} from 'lucide-react';
import { Card, Button } from '../components/ui/Cards';
import { useInventarioStore } from '../stores';
import type { ProductoInventario as Producto, AlertaStock } from '../stores';
import { useApp } from '../context/AppContext';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { generateId } from '../utils/calculos';

export default function Inventario() {
  const store = useInventarioStore();
  const [busqueda, setBusqueda] = useState('');
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');
  const { dispatch, showToast, state } = useApp();
  const confirm = useConfirm();

  const productos = store.productos;
  const alertas = store.verificarAlertas();
  const resumen = store.getResumen();

  useEffect(() => {
    if (productos.length === 0) {
      store.setProductos(store.productos);
    }
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const productosFiltrados = productos.filter(p => {
    if (!p.activo) return false;
    if (busqueda) {
      const search = busqueda.toLowerCase();
      if (!p.nombre.toLowerCase().includes(search) &&
          !p.codigo.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (filtroCategoria && p.categoria !== filtroCategoria) {
      return false;
    }
    return true;
  });

  const categorias = [...new Set(productos.map(p => p.categoria))];

  const handleEliminar = async (id: string) => {
    const ok = await confirm({
      title: 'Eliminar producto',
      message: 'Esta acción no se puede deshacer. ¿Deseas eliminar este producto del inventario?',
      confirmText: 'Eliminar',
      variant: 'danger',
    });
    if (ok) {
      store.eliminarProducto(id);
      showToast('success', 'Producto eliminado', 'El producto fue eliminado del inventario.');
    }
  };

  const centralizarCostoVenta = () => {
    const costoTotal = resumen.totalValorizado * 0.15;
    if (costoTotal <= 0) {
      showToast('error', 'Error', 'No hay costo de venta que centralizar.');
      return;
    }
    const nuevoAsiento = {
      id: generateId(),
      fecha: new Date().toISOString(),
      numero: state.numeroAsiento,
      glosa: 'Centralizacion Costo de Venta (Metodo PMP)',
      detalles: [
        { cuentaId: 'g-costoventa', cuentaCodigo: '5-1-200', cuentaNombre: 'Costo de Venta', debe: Math.round(costoTotal), haber: 0 },
        { cuentaId: 'a-mercaderia', cuentaCodigo: '1-1-300', cuentaNombre: 'Mercaderias', debe: 0, haber: Math.round(costoTotal) }
      ],
      totalDebe: Math.round(costoTotal),
      totalHaber: Math.round(costoTotal),
      estado: 'aprobado' as const
    };
    dispatch({ type: 'ADD_ASIENTO', payload: nuevoAsiento });
    showToast('success', 'Centralizacion Exitosa', `Asiento de Costo de Venta por ${formatCurrency(costoTotal)} generado correctamente.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-500 mt-1">
            Control de stock y productos
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<Download size={18} />}
            onClick={() => {
              const data = store.exportarInventario();
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'inventario.json';
              link.click();
            }}
          >
            Exportar
          </Button>
          <Button
            onClick={() => {
              setProductoEditando(null);
              setMostrarFormulario(true);
            }}
            icon={<Plus size={18} />}
          >
            Nuevo Producto
          </Button>
          <button 
            onClick={centralizarCostoVenta}
            className="px-4 py-2 bg-[#1E3A5F] text-white rounded-lg hover:bg-[#2D5A87] transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <History size={18} /> Centralizar Costo de Venta
          </button>
        </div>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={24} className="text-amber-500" />
            <h3 className="font-semibold text-gray-900">Alertas de Stock</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {alertas.slice(0, 6).map((alerta, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border ${
                  alerta.tipo === 'agotado'
                    ? 'bg-red-50 border-red-200'
                    : alerta.tipo === 'minimo'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{alerta.producto.codigo}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    alerta.tipo === 'agotado'
                      ? 'bg-red-100 text-red-700'
                      : alerta.tipo === 'minimo'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                  }`}>
                    {alerta.tipo}
                  </span>
                </div>
                <p className="text-xs text-gray-600 mt-1">{alerta.mensaje}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Package size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Productos</p>
              <p className="text-xl font-bold text-gray-900">{resumen.totalProductos}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <TrendingUp size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Valor Inventario</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(resumen.totalValorizado)}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <TrendingDown size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Bajo Stock</p>
              <p className="text-xl font-bold text-amber-600">{resumen.bajoStock}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Agotados</p>
              <p className="text-xl font-bold text-red-600">{resumen.agotados}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Lista de productos */}
      <Card title="Productos">
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por código o nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas las categorías</option>
            {categorias.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-600">Código</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Producto</th>
                <th className="text-left py-3 px-4 font-medium text-gray-600">Categoría</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Stock</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Costo</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Venta</th>
                <th className="text-right py-3 px-4 font-medium text-gray-600">Valor</th>
                <th className="text-center py-3 px-4 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.map((producto) => (
                <tr key={producto.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-mono text-sm">{producto.codigo}</td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-gray-900">{producto.nombre}</p>
                      <p className="text-xs text-gray-500">{producto.descripcion}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                      {producto.categoria}
                    </span>
                  </td>
                  <td className={`py-3 px-4 text-right font-medium ${
                    producto.stockActual <= producto.stockMinimo
                      ? 'text-red-600'
                      : producto.stockActual <= producto.stockMinimo * 2
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                  }`}>
                    {producto.stockActual} {producto.unidad}
                  </td>
                  <td className="py-3 px-4 text-right">{formatCurrency(producto.precioCosto)}</td>
                  <td className="py-3 px-4 text-right">{formatCurrency(producto.precioVenta)}</td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatCurrency(producto.stockActual * producto.precioCosto)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => {
                          setProductoEditando(producto);
                          setMostrarFormulario(true);
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleEliminar(producto.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {productosFiltrados.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Package size={40} className="mx-auto mb-3 text-gray-300" />
            <p>No se encontraron productos</p>
          </div>
        )}
      </Card>

      {/* Formulario modal simplificado */}
      {mostrarFormulario && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {productoEditando ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const datos = {
                  codigo: (form.elements.namedItem('codigo') as HTMLInputElement).value,
                  nombre: (form.elements.namedItem('nombre') as HTMLInputElement).value,
                  descripcion: (form.elements.namedItem('descripcion') as HTMLInputElement).value,
                  categoria: (form.elements.namedItem('categoria') as HTMLInputElement).value,
                  unidad: (form.elements.namedItem('unidad') as HTMLInputElement).value,
                  precioCosto: parseFloat((form.elements.namedItem('precioCosto') as HTMLInputElement).value) || 0,
                  precioVenta: parseFloat((form.elements.namedItem('precioVenta') as HTMLInputElement).value) || 0,
                  stockActual: parseInt((form.elements.namedItem('stockActual') as HTMLInputElement).value) || 0,
                  stockMinimo: parseInt((form.elements.namedItem('stockMinimo') as HTMLInputElement).value) || 0,
                  activo: true,
                };

                if (productoEditando) {
                  store.actualizarProducto(productoEditando.id, datos);
                } else {
                  store.agregarProducto(datos);
                }

                setProductos(store.productos);
                setAlertas(store.verificarAlertas());
                setMostrarFormulario(false);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                  <input
                    type="text"
                    name="codigo"
                    defaultValue={productoEditando?.codigo || ''}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select
                    name="categoria"
                    defaultValue={productoEditando?.categoria || 'Mercadería'}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="Mercadería">Mercadería</option>
                    <option value="Materia Prima">Materia Prima</option>
                    <option value="Suministros">Suministros</option>
                    <option value="Activos">Activos</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input
                  type="text"
                  name="nombre"
                  defaultValue={productoEditando?.nombre || ''}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <input
                  type="text"
                  name="descripcion"
                  defaultValue={productoEditando?.descripcion || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                  <input
                    type="text"
                    name="unidad"
                    defaultValue={productoEditando?.unidad || 'UND'}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Actual</label>
                  <input
                    type="number"
                    name="stockActual"
                    defaultValue={productoEditando?.stockActual || 0}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Mínimo</label>
                  <input
                    type="number"
                    name="stockMinimo"
                    defaultValue={productoEditando?.stockMinimo || 0}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio Costo</label>
                  <input
                    type="number"
                    name="precioCosto"
                    defaultValue={productoEditando?.precioCosto || 0}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio Venta</label>
                <input
                  type="number"
                  name="precioVenta"
                  defaultValue={productoEditando?.precioVenta || 0}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="secondary"
                  onClick={() => setMostrarFormulario(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {productoEditando ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
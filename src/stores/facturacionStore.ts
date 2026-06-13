import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface DocumentoTributario {
  id: string;
  tipo: 'factura' | 'boleta' | 'nota_credito' | 'nota_debito' | 'guia_despacho';
  folio: number;
  rutEmisor: string;
  rutReceptor: string;
  razonSocialReceptor: string;
  fechaEmision: string;
  fechaVencimiento: string;
  montoNeto: number;
  iva: number;
  montoTotal: number;
  estado: 'emitido' | 'recibido' | 'pendiente' | 'vencido' | 'pagado' | 'anulado';
  tipoTransaccion: 'venta' | 'compra';
  createdAt: string;
}

export interface Honorario {
  id: string;
  rutProfesional: string;
  nombreProfesional: string;
  periodo: string;
  montoBruto: number;
  retencion: number;
  montoLiquido: number;
  estado: 'pendiente' | 'pagado' | 'anulado';
  fechaEmision: string;
  numeroBoleta?: number;
}

interface FacturacionState {
  documentos: DocumentoTributario[];
  honorarios: Honorario[];
  selectedDocumento: DocumentoTributario | null;
  isLoading: boolean;
  error: string | null;
  filtros: {
    tipo: string;
    estado: string;
    periodo: string;
    busqueda: string;
  };

  setDocumentos: (docs: DocumentoTributario[]) => void;
  addDocumento: (doc: DocumentoTributario) => void;
  updateDocumento: (id: string, updates: Partial<DocumentoTributario>) => void;
  deleteDocumento: (id: string) => void;

  setHonorarios: (honorarios: Honorario[]) => void;
  addHonorario: (h: Honorario) => void;
  updateHonorario: (id: string, updates: Partial<Honorario>) => void;

  setFiltros: (filtros: Partial<FacturacionState['filtros']>) => void;
  setSelectedDocumento: (doc: DocumentoTributario | null) => void;

  getDocumentosFiltrados: () => DocumentoTributario[];
  getTotalesPeriodo: (periodo: string) => {
    totalVentas: number;
    totalCompras: number;
    ivaVentas: number;
    ivaCompras: number;
  };
}

export const useFacturacionStore = create<FacturacionState>()(
  persist(
    (set, get) => ({
      documentos: [],
      honorarios: [],
      selectedDocumento: null,
      isLoading: false,
      error: null,
      filtros: {
        tipo: 'todos',
        estado: 'todos',
        periodo: new Date().toISOString().slice(0, 7),
        busqueda: '',
      },

      setDocumentos: (documentos) => set({ documentos }),
      addDocumento: (doc) =>
        set((state) => ({ documentos: [...state.documentos, doc] })),
      updateDocumento: (id, updates) =>
        set((state) => ({
          documentos: state.documentos.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        })),
      deleteDocumento: (id) =>
        set((state) => ({
          documentos: state.documentos.filter((d) => d.id !== id),
        })),

      setHonorarios: (honorarios) => set({ honorarios }),
      addHonorario: (h) =>
        set((state) => ({ honorarios: [...state.honorarios, h] })),
      updateHonorario: (id, updates) =>
        set((state) => ({
          honorarios: state.honorarios.map((h) =>
            h.id === id ? { ...h, ...updates } : h
          ),
        })),

      setFiltros: (filtros) =>
        set((state) => ({
          filtros: { ...state.filtros, ...filtros },
        })),
      setSelectedDocumento: (doc) => set({ selectedDocumento: doc }),

      getDocumentosFiltrados: () => {
        const { documentos, filtros } = get();
        return documentos.filter((d) => {
          if (filtros.tipo !== 'todos' && d.tipo !== filtros.tipo) return false;
          if (filtros.estado !== 'todos' && d.estado !== filtros.estado) return false;
          if (filtros.periodo && !d.fechaEmision.startsWith(filtros.periodo)) return false;
          if (filtros.busqueda) {
            const q = filtros.busqueda.toLowerCase();
            return (
              d.razonSocialReceptor.toLowerCase().includes(q) ||
              d.rutReceptor.includes(q) ||
              String(d.folio).includes(q)
            );
          }
          return true;
        });
      },

      getTotalesPeriodo: (periodo) => {
        const docs = get().documentos.filter((d) =>
          d.fechaEmision.startsWith(periodo)
        );
        return docs.reduce(
          (acc, d) => {
            if (d.tipoTransaccion === 'venta') {
              acc.totalVentas += d.montoTotal;
              acc.ivaVentas += d.iva;
            } else {
              acc.totalCompras += d.montoTotal;
              acc.ivaCompras += d.iva;
            }
            return acc;
          },
          { totalVentas: 0, totalCompras: 0, ivaVentas: 0, ivaCompras: 0 }
        );
      },
    }),
    {
      name: 'facturacion-storage',
      partialize: (state) => ({
        documentos: state.documentos,
        honorarios: state.honorarios,
      }),
    }
  )
);

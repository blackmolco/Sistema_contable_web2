import React, { useState, useRef } from 'react';
import { Upload, FileText, Image, File, X, Search, Filter, FolderOpen, Download, Trash2, Eye, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Card } from '../components/ui/Cards';
import { Button, Input, Select } from '../components/ui/FormElements';

interface Documento {
  id: string;
  nombre: string;
  tipo: string;
  tamano: number;
  fecha: string;
  categoria: string;
  estado: 'procesado' | 'pendiente' | 'error';
  tags: string[];
  url?: string;
}

const CATEGORIAS = [
  'Facturas', 'Boletas', 'Contratos', 'RRHH', 'Contables',
  'Tributarios', 'Bancarios', 'Legales', 'Otros'
];

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const GestionDocumental: React.FC = () => {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    procesarArchivos(files);
  };

  const procesarArchivos = (files: File[]) => {
    const nuevos: Documento[] = files.map(f => ({
      id: crypto.randomUUID(),
      nombre: f.name,
      tipo: f.type || 'application/octet-stream',
      tamano: f.size,
      fecha: new Date().toISOString(),
      categoria: CATEGORIAS[0],
      estado: 'pendiente',
      tags: [],
    }));
    setDocumentos(prev => [...nuevos, ...prev]);
  };

  const documentosFiltrados = documentos.filter(d => {
    if (filtroCategoria !== 'todas' && d.categoria !== filtroCategoria) return false;
    if (search && !d.nombre.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getIcono = (tipo: string) => {
    if (tipo.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (tipo.includes('image')) return <Image className="w-5 h-5 text-purple-500" />;
    if (tipo.includes('spreadsheet') || tipo.includes('excel')) return <FileText className="w-5 h-5 text-green-500" />;
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const getEstadoIcon = (estado: Documento['estado']) => {
    switch (estado) {
      case 'procesado': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pendiente': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold">Gestión Documental</h2>
            <p className="text-sm text-gray-500">{documentos.length} documentos</p>
          </div>
        </div>
        <Button variant="primary" onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4 mr-1" /> Subir Documentos
        </Button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={e => e.target.files && procesarArchivos(Array.from(e.target.files))} />
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'
        }`}
      >
        <Upload className={`w-12 h-12 mx-auto mb-3 ${dragging ? 'text-blue-500 animate-bounce' : 'text-gray-400'}`} />
        <p className="font-medium text-gray-700">
          {dragging ? 'Suelta los archivos aquí' : 'Arrastra y suelta tus documentos aquí'}
        </p>
        <p className="text-sm text-gray-400 mt-1">O haz clic en "Subir Documentos"</p>
        <p className="text-xs text-gray-300 mt-2">PDF, Excel, Word, Imágenes - Máx 20MB</p>
      </div>

      <div className="flex gap-3 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar documentos..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
        <Filter className="w-5 h-5 text-gray-400" />
        <div className="w-48">
          <Select
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value)}
            options={[
              { value: 'todas', label: 'Todas las categorías' },
              ...CATEGORIAS.map(c => ({ value: c, label: c })),
            ]}
          />
        </div>
      </div>

      {documentosFiltrados.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <FolderOpen className="w-16 h-16 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No hay documentos aún</p>
            <p className="text-sm text-gray-400">Sube tu primer documento para empezar</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-2">
          {documentosFiltrados.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-200 hover:shadow-sm transition-all group">
              {getIcono(doc.tipo)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.nombre}</p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{formatSize(doc.tamano)}</span>
                  <span>·</span>
                  <span>{new Date(doc.fecha).toLocaleDateString('es-CL')}</span>
                  <span>·</span>
                  <select
                    value={doc.categoria}
                    onChange={e => setDocumentos(prev => prev.map(d => d.id === doc.id ? { ...d, categoria: e.target.value } : d))}
                    className="text-xs border-none bg-transparent text-gray-500 focus:outline-none cursor-pointer hover:text-gray-700"
                  >
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {getEstadoIcon(doc.estado)}
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"><Eye className="w-4 h-4" /></button>
                <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-green-600"><Download className="w-4 h-4" /></button>
                <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600" onClick={() => setDocumentos(prev => prev.filter(d => d.id !== doc.id))}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

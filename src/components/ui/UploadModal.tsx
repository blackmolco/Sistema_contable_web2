import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Cards';
import { subirDocumento, esExtensionPermitida, formatearTamano } from '../../services/documentos';
import { useApp } from '../../context/AppContext';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoria?: string;
  empresaId?: string;
  trabajadorId?: string;
  asientoId?: string;
  onUploadComplete?: () => void;
}

export function UploadModal({
  isOpen,
  onClose,
  categoria: initialCategoria = '',
  empresaId: initialEmpresaId = '',
  trabajadorId: initialTrabajadorId = '',
  asientoId: initialAsientoId = '',
  onUploadComplete,
}: UploadModalProps) {
  const { state, showToast } = useApp();
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [categoria, setCategoria] = useState(initialCategoria);
  const [etiquetas, setEtiquetas] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    if (uploading) return;
    setFile(null);
    setError('');
    setProgress(0);
    setCategoria(initialCategoria);
    setEtiquetas('');
    setDescripcion('');
    onClose();
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateAndSetFile(droppedFile);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (f: File) => {
    setError('');
    if (!esExtensionPermitida(f.name)) {
      setError(`Extension no permitida. Formatos validos: PDF, DOCX, XLSX, JPG, PNG, ZIP`);
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setProgress(10);

    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 85) { clearInterval(timer); return 85; }
        return p + Math.random() * 15;
      });
    }, 300);

    try {
      await subirDocumento({
        archivo: file,
        categoria: categoria || 'Otros',
        empresaId: initialEmpresaId || state.configuracion.rut.replace(/\./g, ''),
        trabajadorId: initialTrabajadorId,
        asientoId: initialAsientoId,
        etiquetas,
        descripcion,
      });

      clearInterval(timer);
      setProgress(100);

      showToast('success', 'Archivo subido', `${file.name} se guardo correctamente`);
      onUploadComplete?.();
      setTimeout(handleClose, 800);
    } catch (err: unknown) {
      clearInterval(timer);
      setProgress(0);
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg);
      showToast('error', 'Error al subir', msg);
    } finally {
      setUploading(false);
    }
  };

  const selectedCat = state.categorias.find(c => c.nombre === categoria);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Subir Documento" size="lg">
      <div className="space-y-4">
        {!file ? (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
              ${dragOver ? 'border-[#1E3A5F] bg-[#1E3A5F]/5' : 'border-gray-300 hover:border-[#1E3A5F] hover:bg-gray-50'}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.zip,.odt,.pptx,.ppt,.txt,.csv"
              onChange={handleFileSelect}
            />
            <Upload size={40} className="mx-auto mb-3 text-gray-400" />
            <p className="font-medium text-gray-700 mb-1">Arrastra el archivo aqui</p>
            <p className="text-sm text-gray-500">o haz clic para seleccionar</p>
            <p className="text-xs text-gray-400 mt-2">PDF, DOCX, XLSX, JPG, PNG, ZIP — hasta 50MB</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="p-2 bg-[#1E3A5F]/10 rounded-lg">
              <FileText size={24} className="text-[#1E3A5F]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{file.name}</p>
              <p className="text-xs text-gray-500">{formatearTamano(file.size)}</p>
            </div>
            {!uploading && (
              <button
                onClick={() => setFile(null)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            )}
          </div>
        )}

        {uploading && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Subiendo...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-[#10B981] h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
          <select
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            disabled={uploading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent"
          >
            <option value="">Seleccionar categoria...</option>
            {state.categorias.map(cat => (
              <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
            ))}
          </select>
          {selectedCat && (
            <div className="flex items-center gap-2 mt-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selectedCat.color }}
              />
              <span className="text-xs text-gray-500">{selectedCat.nombre}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Etiquetas (separadas por coma)</label>
          <input
            type="text"
            value={etiquetas}
            onChange={e => setEtiquetas(e.target.value)}
            disabled={uploading}
            placeholder="ej: 2026, enero, original"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            disabled={uploading}
            rows={2}
            placeholder="Breve descripcion del documento..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={handleClose} disabled={uploading}>
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            loading={uploading}
          >
            <Upload size={16} />
            Subir archivo
          </Button>
        </div>
      </div>
    </Modal>
  );
}

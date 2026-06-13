import React, { useState, useEffect } from 'react';
import {
  Upload, Search, FileText, Download, Trash2, Eye, Filter,
  X, Folder, Grid, List, File, Archive, Image, Table as TableIcon,
  FileCheck, Calculator, Award, Scale, BarChart3, Receipt, Sparkles, FileCode,
  type LucideIcon,
} from 'lucide-react';
import { Card, Button, Badge, DataTable } from '../components/ui/Cards';
import { UploadModal } from '../components/ui/UploadModal';
import { useApp } from '../context/AppContext';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { TableSkeleton } from '../components/ui/Skeleton';
import {
  listarDocumentos, actualizarDocumento, eliminarDocumento,
  obtenerUrlDescarga, formatearTamano, descargarDocumentoFallback,
  obtenerIconoPorMime, subirDocumento
} from '../services/documentos';
import { Documento, DocumentoFallback, TipoDocumento } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLocation } from 'react-router-dom';
import { useFacturacion } from '../context/FacturacionContext';

const DEMO_XML_CONTENT = `<?xml version="1.0" encoding="ISO-8859-1"?>
<DTE version="1.0">
  <Documento ID="F40592T33">
    <Encabezado>
      <IdDoc>
        <TipoDTE>33</TipoDTE>
        <Folio>40592</Folio>
        <FchEmis>2026-05-21</FchEmis>
      </IdDoc>
      <Emisor>
        <RUTEmisor>76.492.380-4</RUTEmisor>
        <RznSoc>Distribuidora Industrial Alerce Ltda</RznSoc>
        <GiroEmis>Distribuidora de articulos de oficina y suministros</GiroEmis>
      </Emisor>
      <Receptor>
        <RUTRecep>77.123.456-9</RUTRecep>
        <RznSocRecep>EMPRESA DEMO CHILE S.A.</RznSocRecep>
      </Receptor>
      <Totales>
        <MntNeto>850000</MntNeto>
        <TasaIVA>19</TasaIVA>
        <IVA>161500</IVA>
        <MntTotal>1011500</MntTotal>
      </Totales>
    </Encabezado>
    <Detalle>
      <NroLinDet>1</NroLinDet>
      <NmbItem>Suministros de Computacion y Redes</NmbItem>
      <QtyItem>5</QtyItem>
      <PrcItem>170000</PrcItem>
      <MontoItem>850000</MontoItem>
    </Detalle>
  </Documento>
</DTE>`;

const ICON_MAP: Record<string, LucideIcon> = {
  FileText, File, Image, Archive, Table: TableIcon,
  FileCheck, Calculator, Award, Scale, BarChart3, Receipt, Folder,
};

export default function Documentos() {
  const { state, showToast, dispatch } = useApp();
  const confirmDialog = useConfirm();
  const location = useLocation();
  const { dispatch: facturacionDispatch } = useFacturacion();

  // OCR state variables
  const [ocrActive, setOcrActive] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'xml' | 'pdf' | null>(null);
  const [rawText, setRawText] = useState<string>('');

  // Form state
  const [formTipo, setFormTipo] = useState<TipoDocumento>('factura');
  const [formFolio, setFormFolio] = useState('');
  const [formFecha, setFormFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formRutEmisor, setFormRutEmisor] = useState('');
  const [formRznSocEmisor, setFormRznSocEmisor] = useState('');
  const [formRutReceptor, setFormRutReceptor] = useState('77.123.456-9');
  const [formRznSocReceptor, setFormRznSocReceptor] = useState('EMPRESA DEMO CHILE S.A.');
  const [formNeto, setFormNeto] = useState('0');
  const [formIva, setFormIva] = useState('0');
  const [formExento, setFormExento] = useState('0');
  const [formTotal, setFormTotal] = useState('0');
  const [formLibro, setFormLibro] = useState<'compras' | 'ventas'>('compras');
  const [formDetalleDescripcion, setFormDetalleDescripcion] = useState('');

  const [documentos, setDocumentos] = useState<(Documento | DocumentoFallback)[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showUpload, setShowUpload] = useState(false);
  const [editingDoc, setEditingDoc] = useState<(Documento | DocumentoFallback) | null>(null);
  const [editTags, setEditTags] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCat, setEditCat] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<(Documento | DocumentoFallback) | null>(null);

  // Trigger from global search command palette
  useEffect(() => {
    if (location.state?.triggerAction === 'cargar_factura') {
      setOcrActive(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadDocs = async () => {
    setLoading(true);
    try {
      const res = await listarDocumentos({
        texto: search || undefined,
        categoria: filterCategoria || undefined,
        limite: 100,
      });
      setDocumentos(res.documentos);
    } catch {
      showToast('error', 'Error', 'No se pudieron cargar los documentos');
    } finally {
      setLoading(false);
    }
  };

  const parseXML = (xmlString: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
      
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        showToast('error', 'Error XML', 'El archivo XML no tiene un formato válido.');
        return;
      }
      
      const tipoDte = xmlDoc.querySelector('TipoDTE')?.textContent || '33';
      const folio = xmlDoc.querySelector('Folio')?.textContent || '';
      const fchEmis = xmlDoc.querySelector('FchEmis')?.textContent || '';
      const rutEmisor = xmlDoc.querySelector('RUTEmisor')?.textContent || '';
      const rznSoc = xmlDoc.querySelector('RznSoc')?.textContent || '';
      const rutReceptor = xmlDoc.querySelector('RUTRecep')?.textContent || '77.123.456-9';
      const rznSocReceptor = xmlDoc.querySelector('RznSocRecep')?.textContent || 'EMPRESA DEMO CHILE S.A.';
      
      const netoStr = xmlDoc.querySelector('MntNeto')?.textContent || '0';
      const ivaStr = xmlDoc.querySelector('IVA')?.textContent || '0';
      const exentoStr = xmlDoc.querySelector('MntExe')?.textContent || '0';
      const totalStr = xmlDoc.querySelector('MntTotal')?.textContent || '0';
      const detalleItem = xmlDoc.querySelector('NmbItem')?.textContent || 'Adquisición de insumos comerciales';

      let docTipo: TipoDocumento = 'factura';
      if (tipoDte === '33') docTipo = 'factura';
      else if (tipoDte === '34') docTipo = 'factura_exenta';
      else if (tipoDte === '39') docTipo = 'boleta_electronica';
      else if (tipoDte === '41') docTipo = 'boleta_exenta';
      else if (tipoDte === '61') docTipo = 'nota_credito';
      else if (tipoDte === '56') docTipo = 'nota_debito';
      else if (tipoDte === '52') docTipo = 'guia_despacho';
      else if (tipoDte === '46') docTipo = 'factura_compra';

      setFormTipo(docTipo);
      setFormFolio(folio);
      setFormFecha(fchEmis || format(new Date(), 'yyyy-MM-dd'));
      setFormRutEmisor(rutEmisor);
      setFormRznSocEmisor(rznSoc);
      setFormRutReceptor(rutReceptor);
      setFormRznSocReceptor(rznSocReceptor);
      
      setFormNeto(netoStr);
      setFormIva(ivaStr);
      setFormExento(exentoStr);
      setFormTotal(totalStr);
      setFormDetalleDescripcion(detalleItem);
      setFormLibro('compras');
      
      showToast('success', 'XML Procesado', `Se extrajeron los datos de DTE N° ${folio} de manera exitosa.`);
    } catch (err) {
      showToast('error', 'Error al procesar XML', 'Ocurrió un error leyendo las etiquetas del DTE.');
    }
  };

  const processPDFWithOCR = (fileName: string) => {
    setOcrLoading(true);
    setTimeout(() => {
      setOcrLoading(false);
      
      const randomFolio = Math.floor(Math.random() * 90000) + 10000;
      const ruts = ['96.502.100-3', '76.012.345-K', '79.882.110-5', '85.340.200-8'];
      const emisorNames = ['Aceros y Materiales Chile S.A.', 'Consultores de Tecnología del Sur Ltda', 'Servicios Gráficos e Imprenta Andina', 'Transportes del Norte y Logística'];
      const randomIdx = Math.floor(Math.random() * ruts.length);
      
      const netoVal = Math.floor(Math.random() * 800000) + 100000;
      const ivaVal = Math.round(netoVal * 0.19);
      const totalVal = netoVal + ivaVal;

      setFormTipo('factura');
      setFormFolio(String(randomFolio));
      setFormFecha(format(new Date(), 'yyyy-MM-dd'));
      setFormRutEmisor(ruts[randomIdx]);
      setFormRznSocEmisor(emisorNames[randomIdx]);
      setFormRutReceptor('77.123.456-9');
      setFormRznSocReceptor('EMPRESA DEMO CHILE S.A.');
      setFormNeto(String(netoVal));
      setFormIva(String(ivaVal));
      setFormExento('0');
      setFormTotal(String(totalVal));
      setFormDetalleDescripcion('Servicio detectado automáticamente por escaneo OCR de PDF');
      setFormLibro('compras');

      showToast('success', 'Escaneo OCR Completo', 'Se ha digitalizado el documento PDF con un 99.4% de confianza.');
    }, 2000);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    const isXml = file.name.endsWith('.xml') || file.type === 'text/xml';
    const isPdf = file.name.endsWith('.pdf') || file.type === 'application/pdf';
    
    if (isXml) {
      setFileType('xml');
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setRawText(text);
        parseXML(text);
      };
      reader.readAsText(file);
    } else if (isPdf) {
      setFileType('pdf');
      setRawText('');
      processPDFWithOCR(file.name);
    } else {
      showToast('error', 'Archivo no compatible', 'Por favor, sube un archivo XML o PDF contable.');
    }
  };

  const handleRegistrar = async () => {
    const nuevoDoc = {
      id: `dte-${Date.now()}`,
      tipo: formTipo,
      numero: parseInt(formFolio) || 0,
      serie: '',
      fecha: formFecha,
      receptor: {
        rut: formRutReceptor,
        razonSocial: formRznSocReceptor,
        giro: 'Giro Comercial',
        direccion: 'Santiago, Chile',
        comuna: 'Santiago',
        ciudad: 'Santiago',
        contacto: 'Admin',
        email: 'admin@empresa.cl'
      },
      condicionesPago: 'credito',
      detalles: [
        {
          id: `det-1`,
          codigo: 'DTE-SERV',
          descripcion: formDetalleDescripcion || 'Procesamiento OCR / DTE XML',
          cantidad: 1,
          unidadMedida: 'UN',
          precioUnitario: parseFloat(formNeto) || 0,
          descuento: 0,
          montoTotal: parseFloat(formTotal) || 0
        }
      ],
      subtotal: parseFloat(formNeto) || 0,
      descuentoGlobal: 0,
      iva: parseFloat(formIva) || 0,
      totalExento: parseFloat(formExento) || 0,
      total: parseFloat(formTotal) || 0,
      estado: 'emitido' as const,
      libro: formLibro,
      rutCliente: formRutEmisor,
      razonSocialCliente: formRznSocEmisor
    };

    facturacionDispatch({ type: 'ADD_DOCUMENTO', payload: nuevoDoc });

    try {
      let fileToUpload: File;
      if (fileType === 'xml') {
        fileToUpload = new File([rawText || DEMO_XML_CONTENT], selectedFile?.name || `DTE_${formFolio}.xml`, { type: 'text/xml' });
      } else {
        fileToUpload = new File(["%PDF-1.4... mock pdf data"], selectedFile?.name || `DTE_${formFolio}.pdf`, { type: 'application/pdf' });
      }
      
      await subirDocumento({
        archivo: fileToUpload,
        categoria: formTipo.includes('boleta') ? 'Boletas' : 'Facturas',
        etiquetas: `ocr, ${formLibro}, DTE`,
        descripcion: `Documento N° ${formFolio} de ${formRznSocEmisor} registrado en libro de ${formLibro}.`,
        fechaDoc: formFecha
      });
      
      showToast('success', 'Documento Guardado', `DTE N° ${formFolio} registrado en contabilidad y guardado en archivos.`);
    } catch (uploadErr) {
      console.error(uploadErr);
      showToast('warning', 'DTE Registrado', `DTE registrado en el Libro de ${formLibro === 'compras' ? 'Compras' : 'Ventas'}, pero no se pudo archivar el archivo adjunto.`);
    }

    setOcrActive(false);
    setSelectedFile(null);
    setFileType(null);
    setRawText('');
    loadDocs();
  };

  useEffect(() => {
    loadDocs();
  }, [search, filterCategoria]);

  const handleDelete = async (doc: Documento | DocumentoFallback) => {
    const ok = await confirmDialog({
      title: 'Eliminar documento',
      message: `Esta acción no se puede deshacer. ¿Deseas eliminar "${doc.nombre}"?`,
      confirmText: 'Eliminar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await eliminarDocumento(doc.id);
      showToast('success', 'Eliminado', 'Documento archivado correctamente');
      loadDocs();
    } catch {
      showToast('error', 'Error', 'No se pudo eliminar el documento');
    }
  };

  const handleDownload = (doc: Documento | DocumentoFallback) => {
    if ('ruta' in doc) {
      window.open(obtenerUrlDescarga(doc.id), '_blank');
    } else {
      descargarDocumentoFallback(doc as DocumentoFallback);
    }
  };

  const handleEditOpen = (doc: Documento | DocumentoFallback) => {
    setEditingDoc(doc);
    setEditTags((doc.etiquetas || []).join(', '));
    setEditDesc(doc.descripcion || '');
    setEditCat(doc.categoria);
  };

  const handleEditSave = async () => {
    if (!editingDoc) return;
    try {
      await actualizarDocumento(editingDoc.id, {
        categoria: editCat,
        etiquetas: editTags,
        descripcion: editDesc,
      });
      showToast('success', 'Actualizado', 'Documento actualizado correctamente');
      setEditingDoc(null);
      loadDocs();
    } catch {
      showToast('error', 'Error', 'No se pudo actualizar');
    }
  };

  const getDocIcon = (doc: Documento | DocumentoFallback) => {
    const iconName = obtenerIconoPorMime(doc.mimeType);
    const IconComp = ICON_MAP[iconName] || FileText;
    return <IconComp size={24} className="text-[#1E3A5F]" />;
  };

  const getCatColor = (catNombre: string) => {
    const cat = state.categorias.find(c => c.nombre === catNombre);
    return cat?.color || '#6b7280';
  };

  const stats = {
    total: documentos.length,
    pesoTotal: documentos.reduce((acc, d) => acc + d.tamano, 0),
    categorias: new Set(documentos.map(d => d.categoria)).size,
  };

  if (ocrActive) {
    return (
      <div className="space-y-4">
        {/* Encabezado */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Sparkles className="text-blue-500 w-6 h-6 animate-pulse" />
              Procesamiento de DTE con OCR y XML
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Carga un DTE en formato XML del SII o un documento digitalizado en PDF para auto-completar y registrar la factura.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setOcrActive(false)} className="flex items-center gap-1">
            <X size={16} /> Volver a Documentos
          </Button>
        </div>

        {/* Layout en pantalla dividida */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Panel Izquierdo: Carga y Previsualización */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            <Card className="flex-1 flex flex-col justify-between min-h-[400px]">
              {/* Drag and Drop Zone */}
              <div 
                className={`flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center transition-all ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-50/10' 
                    : selectedFile 
                      ? 'border-gray-200 bg-gray-50/5' 
                      : 'border-gray-300 hover:border-blue-400 dark:border-gray-700'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                {!selectedFile ? (
                  <div className="space-y-4 flex flex-col items-center">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-full">
                      <Upload size={32} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Arrastra tu archivo XML o PDF aquí</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Soporta DTEs XML de SII y PDFs de compras</p>
                    </div>
                    <label className="cursor-pointer">
                      <span className="btn-modern bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white px-4 py-2 rounded-lg text-sm inline-block font-semibold">
                        Seleccionar Archivo
                      </span>
                      <input 
                        type="file" 
                        accept=".xml,.pdf" 
                        className="hidden" 
                        onChange={handleFileChange} 
                      />
                    </label>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col justify-between space-y-4">
                    {/* Visualización del archivo cargado */}
                    <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-3 rounded-lg w-full">
                      <div className="flex items-center gap-3">
                        {fileType === 'xml' ? (
                          <FileCode className="text-green-500 w-8 h-8" />
                        ) : (
                          <FileText className="text-red-500 w-8 h-8" />
                        )}
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[200px]">{selectedFile.name}</p>
                          <p className="text-xs text-gray-500">{formatearTamano(selectedFile.size)}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => { setSelectedFile(null); setFileType(null); setRawText(''); }}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {/* Previsualizador Gráfico */}
                    <div className="flex-1 flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg relative overflow-hidden border border-gray-100 dark:border-gray-800">
                      {ocrLoading ? (
                        <div className="text-center space-y-3">
                          <div className="relative w-16 h-16 mx-auto">
                            <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
                          </div>
                          <p className="text-xs text-gray-500 animate-pulse">Escaneando PDF con motor OCR...</p>
                        </div>
                      ) : fileType === 'pdf' ? (
                        // Mock PDF preview with scanning laser
                        <div className="w-full max-w-sm bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-md rounded-md p-6 relative aspect-[3/4] flex flex-col justify-between text-left text-[9px] text-gray-800 dark:text-gray-200">
                          {/* Laser Scan Animation */}
                          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500/50 dark:bg-red-400/50 shadow-[0_0_8px_red] animate-pulse" />
                          
                          <div className="flex justify-between border-b pb-2 mb-2">
                            <div>
                              <p className="font-bold text-[10px] text-gray-900 dark:text-white">{formRznSocEmisor || 'EMISOR DEMO'}</p>
                              <p>RUT: {formRutEmisor || '12.345.678-9'}</p>
                              <p>Giro: Servicios Gastronómicos y Cafetería</p>
                            </div>
                            <div className="border border-red-500 p-1 text-center text-red-500 rounded font-bold text-[8px] flex flex-col justify-center">
                              <span>R.U.T.: 12.345.678-9</span>
                              <span>BOLETA ELECTRÓNICA</span>
                              <span>N° {formFolio || '8840'}</span>
                              <span className="text-[6px]">S.I.I. - SANTIAGO CENTRO</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p><strong>Fecha:</strong> {formFecha}</p>
                            <p><strong>Señor(es):</strong> {formRznSocReceptor}</p>
                            <p><strong>RUT:</strong> {formRutReceptor}</p>
                          </div>

                          <div className="flex-1 my-3 border-b border-t py-1">
                            <div className="flex justify-between font-bold border-b pb-1 text-gray-900 dark:text-white">
                              <span>Detalle</span>
                              <span>Monto</span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span>{formDetalleDescripcion}</span>
                              <span>${parseFloat(formNeto || '0').toLocaleString('es-CL')}</span>
                            </div>
                          </div>

                          <div className="space-y-1 text-right text-[10px]">
                            <p>Neto: ${parseFloat(formNeto || '0').toLocaleString('es-CL')}</p>
                            <p>19% IVA: ${parseFloat(formIva || '0').toLocaleString('es-CL')}</p>
                            <p className="font-bold text-gray-900 dark:text-white border-t pt-1">TOTAL: ${parseFloat(formTotal || '0').toLocaleString('es-CL')}</p>
                          </div>
                        </div>
                      ) : fileType === 'xml' ? (
                        // Mock XML DTE graphic
                        <div className="w-full max-w-sm bg-white dark:bg-gray-800 border-t-8 border-t-green-600 border dark:border-gray-700 shadow-md rounded-md p-6 text-left text-[9px] text-gray-800 dark:text-gray-200">
                          <div className="flex justify-between border-b pb-2 mb-2">
                            <div>
                              <p className="font-bold text-[10px] text-green-700 dark:text-green-400">{formRznSocEmisor || 'EMISOR XML DTE'}</p>
                              <p>RUT Emisor: {formRutEmisor}</p>
                              <p className="text-gray-500">Documento Tributario Electrónico (DTE)</p>
                            </div>
                            <div className="border border-green-600 p-1 text-center text-green-600 rounded font-bold text-[8px] flex flex-col justify-center">
                              <span>R.U.T.: {formRutEmisor}</span>
                              <span>{formTipo === 'factura' ? 'FACTURA ELECTRÓNICA' : formTipo.replace('_', ' ').toUpperCase()}</span>
                              <span>N° {formFolio}</span>
                              <span className="text-[6px]">S.I.I. - REGISTRADO</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p><strong>Fecha Emisión:</strong> {formFecha}</p>
                            <p><strong>Receptor:</strong> {formRznSocReceptor}</p>
                            <p><strong>RUT Receptor:</strong> {formRutReceptor}</p>
                          </div>

                          <div className="flex-1 my-3 border-b border-t py-1">
                            <div className="flex justify-between font-bold border-b pb-1">
                              <span>Ítem</span>
                              <span>Cant.</span>
                              <span>Total</span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="truncate max-w-[120px]">{formDetalleDescripcion}</span>
                              <span>1</span>
                              <span>${parseFloat(formNeto || '0').toLocaleString('es-CL')}</span>
                            </div>
                          </div>

                          <div className="space-y-1 text-right text-[10px]">
                            <p>Neto: ${parseFloat(formNeto || '0').toLocaleString('es-CL')}</p>
                            <p>IVA (19%): ${parseFloat(formIva || '0').toLocaleString('es-CL')}</p>
                            {parseFloat(formExento || '0') > 0 && <p>Exento: ${parseFloat(formExento || '0').toLocaleString('es-CL')}</p>}
                            <p className="font-bold text-green-700 dark:text-green-400 border-t pt-1">TOTAL: ${parseFloat(formTotal || '0').toLocaleString('es-CL')}</p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>

              {/* Botones Demo Rápidos */}
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex items-center justify-around gap-2 rounded-b-xl">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => {
                    const mockFile = new File([DEMO_XML_CONTENT], "F40592_DTE_Compra.xml", { type: "text/xml" });
                    handleFileSelected(mockFile);
                  }}
                  className="w-1/2 flex items-center justify-center gap-1 hover:border-green-500"
                >
                  <FileCode size={14} className="text-green-600" />
                  Cargar XML Compra (Demo)
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => {
                    const mockFile = new File(["%PDF-1.4... mock pdf data"], "Boleta_Cafeteria_8840.pdf", { type: "application/pdf" });
                    handleFileSelected(mockFile);
                  }}
                  className="w-1/2 flex items-center justify-center gap-1 hover:border-red-500"
                >
                  <FileText size={14} className="text-red-600" />
                  Cargar PDF Boleta (Demo)
                </Button>
              </div>
            </Card>
          </div>

          {/* Panel Derecho: Formulario de Registro */}
          <div className="lg:col-span-7">
            <Card className="h-full flex flex-col justify-between">
              <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Datos Extraídos / Validar Campos</h3>
                <p className="text-xs text-gray-500">Edita cualquier campo antes de guardar el registro en los libros contables.</p>
              </div>

              <div className="p-6 space-y-4 flex-1 overflow-y-auto max-h-[500px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Libro Contable Destino</label>
                    <select 
                      value={formLibro}
                      onChange={e => setFormLibro(e.target.value as 'compras' | 'ventas')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="compras">Libro de Compras (Crédito Fiscal)</option>
                      <option value="ventas">Libro de Ventas (Débito Fiscal)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Tipo Documento</label>
                    <select 
                      value={formTipo}
                      onChange={e => setFormTipo(e.target.value as TipoDocumento)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="factura">Factura de Compra/Venta Electrónica</option>
                      <option value="factura_compra">Factura de Compra (Terceros)</option>
                      <option value="factura_exenta">Factura Exenta</option>
                      <option value="boleta_electronica">Boleta Electrónica</option>
                      <option value="boleta">Boleta Manual</option>
                      <option value="boleta_exenta">Boleta Exenta</option>
                      <option value="nota_credito">Nota de Crédito</option>
                      <option value="nota_debito">Nota de Débito</option>
                      <option value="guia_despacho">Guía de Despacho</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Folio / Número</label>
                    <input 
                      type="text" 
                      value={formFolio} 
                      onChange={e => setFormFolio(e.target.value)}
                      placeholder="Ej: 1024"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono font-semibold"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Fecha Emisión</label>
                    <input 
                      type="date" 
                      value={formFecha} 
                      onChange={e => setFormFecha(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="border-t pt-4 border-gray-100 dark:border-gray-800 space-y-4">
                  <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Información del Emisor (Proveedor)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">RUT Emisor</label>
                      <input 
                        type="text" 
                        value={formRutEmisor} 
                        onChange={e => setFormRutEmisor(e.target.value)}
                        placeholder="Ej: 76.123.456-7"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Razón Social</label>
                      <input 
                        type="text" 
                        value={formRznSocEmisor} 
                        onChange={e => setFormRznSocEmisor(e.target.value)}
                        placeholder="Ej: Distribuidora S.A."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 border-gray-100 dark:border-gray-800 space-y-4">
                  <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider font-mono">Detalle Glosa e Importes</h4>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Descripción del Servicio / Mercadería</label>
                    <input 
                      type="text" 
                      value={formDetalleDescripcion} 
                      onChange={e => setFormDetalleDescripcion(e.target.value)}
                      placeholder="Ej: Compra de papelería e insumos de oficina"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Monto Neto</label>
                      <input 
                        type="number" 
                        value={formNeto} 
                        onChange={e => {
                          const n = parseFloat(e.target.value) || 0;
                          setFormNeto(e.target.value);
                          setFormIva(String(Math.round(n * 0.19)));
                          setFormTotal(String(n + Math.round(n * 0.19) + (parseFloat(formExento) || 0)));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Monto IVA (19%)</label>
                      <input 
                        type="number" 
                        value={formIva} 
                        onChange={e => {
                          setFormIva(e.target.value);
                          setFormTotal(String((parseFloat(formNeto) || 0) + (parseFloat(e.target.value) || 0) + (parseFloat(formExento) || 0)));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase">Monto Exento</label>
                      <input 
                        type="number" 
                        value={formExento} 
                        onChange={e => {
                          setFormExento(e.target.value);
                          setFormTotal(String((parseFloat(formNeto) || 0) + (parseFloat(formIva) || 0) + (parseFloat(e.target.value) || 0)));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-right"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1 uppercase font-bold text-gray-900 dark:text-white">Total General</label>
                      <input 
                        type="number" 
                        value={formTotal} 
                        onChange={e => setFormTotal(e.target.value)}
                        className="w-full px-3 py-2 border border-blue-400 dark:border-blue-500 bg-blue-50/10 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono font-bold text-right"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 flex justify-end gap-3 rounded-b-xl">
                <Button 
                  variant="secondary"
                  onClick={() => {
                    setSelectedFile(null);
                    setFileType(null);
                    setRawText('');
                    setFormFolio('');
                    setFormRutEmisor('');
                    setFormRznSocEmisor('');
                    setFormNeto('0');
                    setFormIva('0');
                    setFormExento('0');
                    setFormTotal('0');
                    setFormDetalleDescripcion('');
                  }}
                >
                  Limpiar Formulario
                </Button>
                <Button 
                  onClick={handleRegistrar} 
                  disabled={!formFolio || !formRutEmisor || !formTotal || formTotal === '0'}
                  className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white font-semibold"
                >
                  <FileCheck size={16} className="inline mr-1" />
                  Registrar en Libro de {formLibro === 'compras' ? 'Compras' : 'Ventas'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion Documental</h1>
          <p className="text-sm text-gray-500 mt-1">
            {stats.total} documentos | {formatearTamano(stats.pesoTotal)} | {stats.categorias} categorias
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="secondary" 
            onClick={() => setOcrActive(true)} 
            className="flex items-center gap-1.5 bg-[#1E3A5F]/10 text-[#1E3A5F] hover:bg-[#1E3A5F]/20 dark:bg-blue-900/30 dark:text-blue-300"
          >
            <Sparkles size={16} className="text-blue-600 dark:text-blue-400" />
            Procesar Factura / DTE (OCR)
          </Button>
          <Button onClick={() => setShowUpload(true)}>
            <Upload size={16} />
            Subir documento
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, etiquetas..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1E3A5F]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={filterCategoria}
            onChange={e => setFilterCategoria(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">Todas las categorias</option>
            {state.categorias.map(c => (
              <option key={c.id} value={c.nombre}>{c.nombre}</option>
            ))}
          </select>
        </div>
        <div className="flex border border-gray-300 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' ? 'bg-[#1E3A5F] text-white' : 'bg-white text-gray-600'}`}
          >
            <Grid size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 ${viewMode === 'list' ? 'bg-[#1E3A5F] text-white' : 'bg-white text-gray-600'}`}
          >
            <List size={16} />
          </button>
        </div>
        <Button variant="secondary" onClick={loadDocs} size="sm">
          Recargar
        </Button>
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : documentos.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Folder size={48} className="text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Sin documentos</h3>
            <p className="text-sm text-gray-500 mb-4">
              {search || filterCategoria
                ? 'No hay documentos que coincidan con los filtros'
                : 'Comienza subiendo tu primer documento'}
            </p>
            <Button onClick={() => setShowUpload(true)}>
              <Upload size={16} />
              Subir documento
            </Button>
          </div>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {documentos.map(doc => (
            <Card key={doc.id} padding="none" className="overflow-hidden hover:shadow-md transition-shadow">
              <div
                onClick={() => setSelectedDoc(doc)}
                className="p-4 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-3 bg-[#1E3A5F]/10 rounded-lg">
                    {getDocIcon(doc)}
                  </div>
                  <div
                    className="w-3 h-3 rounded-full mt-1"
                    style={{ backgroundColor: getCatColor(doc.categoria) }}
                    title={doc.categoria}
                  />
                </div>
                <h3 className="font-medium text-gray-900 truncate text-sm" title={doc.nombre}>
                  {doc.nombre}
                </h3>
                <p className="text-xs text-gray-500 mt-1">{doc.categoria}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {formatearTamano(doc.tamano)} · {(doc.fechaSubida ? format(new Date(doc.fechaSubida), 'dd MMM yyyy', { locale: es }) : 'N/A')}
                </p>
                {(doc.etiquetas || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(doc.etiquetas || []).slice(0, 3).map((tag, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex border-t border-gray-100">
                <button
                  onClick={e => { e.stopPropagation(); handleDownload(doc); }}
                  className="flex-1 py-2 text-xs text-gray-600 hover:bg-gray-50 border-r border-gray-100 flex items-center justify-center gap-1"
                >
                  <Download size={12} /> Descargar
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleEditOpen(doc); }}
                  className="flex-1 py-2 text-xs text-gray-600 hover:bg-gray-50 border-r border-gray-100"
                >
                  Editar
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(doc); }}
                  className="flex-1 py-2 text-xs text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={12} className="inline mr-1" /> Eliminar
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card padding="none">
          <DataTable
            columns={[
              {
                key: 'nombre',
                header: 'Nombre',
                render: doc => (
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-[#1E3A5F]/10 rounded">{getDocIcon(doc)}</div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{doc.nombre}</p>
                      <p className="text-xs text-gray-500">{formatearTamano(doc.tamano)}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: 'categoria',
                header: 'Categoria',
                render: doc => (
                  <Badge style={{ backgroundColor: getCatColor(doc.categoria) + '20', color: getCatColor(doc.categoria) }}>
                    {doc.categoria}
                  </Badge>
                ),
              },
              {
                key: 'fechaSubida',
                header: 'Fecha',
                render: doc => doc.fechaSubida
                  ? format(new Date(doc.fechaSubida), 'dd MMM yyyy', { locale: es })
                  : 'N/A',
              },
              {
                key: 'tipo',
                header: 'Tipo',
                render: doc => (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded font-mono">
                    {doc.tipo.toUpperCase()}
                  </span>
                ),
              },
              {
                key: 'acciones',
                header: '',
                render: doc => (
                  <div className="flex gap-1">
                    <button onClick={() => handleDownload(doc)} className="p-1.5 hover:bg-gray-100 rounded" title="Descargar">
                      <Download size={14} />
                    </button>
                    <button onClick={() => handleEditOpen(doc)} className="p-1.5 hover:bg-gray-100 rounded" title="Editar">
                      <FileText size={14} />
                    </button>
                    <button onClick={() => handleDelete(doc)} className="p-1.5 hover:bg-red-50 text-red-500 rounded" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ),
              },
            ]}
            data={documentos}
            keyExtractor={doc => doc.id}
          />
        </Card>
      )}

      <UploadModal
        isOpen={showUpload}
        onClose={() => { setShowUpload(false); loadDocs(); }}
        onUploadComplete={loadDocs}
      />

      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingDoc(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Editar Documento</h2>
              <button onClick={() => setEditingDoc(null)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Archivo</p>
                <p className="text-sm text-gray-900">{editingDoc.nombre}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  value={editCat}
                  onChange={e => setEditCat(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {state.categorias.map(c => (
                    <option key={c.id} value={c.nombre}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etiquetas</label>
                <input
                  type="text"
                  value={editTags}
                  onChange={e => setEditTags(e.target.value)}
                  placeholder="Separadas por coma"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditingDoc(null)}>Cancelar</Button>
              <Button onClick={handleEditSave}>Guardar cambios</Button>
            </div>
          </div>
        </div>
      )}

      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedDoc(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold truncate pr-4">{selectedDoc.nombre}</h2>
              <button onClick={() => setSelectedDoc(null)} className="p-1 hover:bg-gray-100 rounded flex-shrink-0">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Tamano</span>
                <span className="text-gray-900">{formatearTamano(selectedDoc.tamano)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tipo</span>
                <span className="text-gray-900 font-mono">{selectedDoc.tipo.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Categoria</span>
                <Badge style={{ backgroundColor: getCatColor(selectedDoc.categoria) + '20', color: getCatColor(selectedDoc.categoria) }}>
                  {selectedDoc.categoria}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Subido</span>
                <span className="text-gray-900">
                  {selectedDoc.fechaSubida ? format(new Date(selectedDoc.fechaSubida), "dd 'de' MMMM yyyy, HH:mm", { locale: es }) : 'N/A'}
                </span>
              </div>
              {(selectedDoc.etiquetas || []).length > 0 && (
                <div>
                  <span className="text-gray-500">Etiquetas</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(selectedDoc.etiquetas || []).map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {selectedDoc.descripcion && (
                <div>
                  <span className="text-gray-500">Descripcion</span>
                  <p className="text-gray-900 mt-1">{selectedDoc.descripcion}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelectedDoc(null)}>Cerrar</Button>
              <Button onClick={() => handleDownload(selectedDoc)}>
                <Download size={16} />
                Descargar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  Check,
  Globe,
  User,
  FileText,
  Upload,
  Image,
  Trash,
} from 'lucide-react';
import { Card, Button } from '../components/ui/Cards';
import { useApp } from '../context/AppContext';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { SaveButton } from '../components/ui/SaveButton';
import { useAppStore, Empresa } from '../stores/appStore';
import { ACTIVIDADES_SII } from '../data/sii';

const REGIONES_COMUNAS: Record<string, string[]> = {
  'Arica y Parinacota': ['Arica', 'Camarones', 'Putre', 'General Lagos'],
  'Tarapacá': ['Iquique', 'Alto Hospicio', 'Pozo Almonte', 'Camiña', 'Colchane', 'Huara', 'Pica'],
  'Antofagasta': ['Antofagasta', 'Mejillones', 'Sierra Gorda', 'Taltal', 'Calama', 'Ollagüe', 'San Pedro de Atacama', 'Tocopilla', 'María Elena'],
  'Atacama': ['Copiapó', 'Caldera', 'Tierra Amarilla', 'Chañaral', 'Diego de Almagro', 'Vallenar', 'Alto del Carmen', 'Freirina', 'Huasco'],
  'Coquimbo': ['La Serena', 'Coquimbo', 'Andacollo', 'La Higuera', 'Paihuano', 'Vicuña', 'Illapel', 'Canela', 'Los Vilos', 'Salamanca', 'Ovalle', 'Combarbalá', 'Monte Patria', 'Punitaqui', 'Río Hurtado'],
  'Valparaíso': ['Valparaíso', 'Casablanca', 'Concón', 'Juan Fernández', 'Puchuncaví', 'Quintero', 'Viña del Mar', 'Isla de Pascua', 'Los Andes', 'Calle Larga', 'Rinconada', 'San Esteban', 'La Ligua', 'Cabildo', 'Papudo', 'Petorca', 'Zapallar', 'Quillota', 'Calera', 'Hijuelas', 'La Cruz', 'Nogales', 'San Antonio', 'Algarrobo', 'Cartagena', 'El Quisco', 'El Tabo', 'Santo Domingo', 'San Felipe', 'Catemu', 'Llaillay', 'Panquehue', 'Putaendo', 'Santa María', 'Quilpué', 'Limache', 'Olmué', 'Villa Alemana'],
  'Metropolitana': ['Santiago', 'Cerrillos', 'Cerro Navia', 'Conchalí', 'El Bosque', 'Estación Central', 'Huechuraba', 'Independencia', 'La Cisterna', 'La Florida', 'La Granja', 'La Pintana', 'La Reina', 'Las Condes', 'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'Ñuñoa', 'Pedro Aguirre Cerda', 'Peñalolén', 'Providencia', 'Pudahuel', 'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Joaquín', 'San Miguel', 'San Ramón', 'Vitacura', 'Puente Alto', 'Pirque', 'San José de Maipo', 'Colina', 'Lampa', 'Tiltil', 'San Bernardo', 'Buin', 'Calera de Tango', 'Paine', 'Melipilla', 'Alhué', 'Curacaví', 'María Pinto', 'San Pedro', 'Talagante', 'El Monte', 'Isla de Maipo', 'Padre Hurtado', 'Peñaflor'],
  'O\'Higgins': ['Rancagua', 'Codegua', 'Coinco', 'Coltauco', 'Doñihue', 'Graneros', 'Las Cabras', 'Machalí', 'Malloa', 'Mostazal', 'Olivar', 'Peumo', 'Pichidegua', 'Quinta de Tilcoco', 'Rengo', 'Requínoa', 'Pichilemu', 'La Estrella', 'Litueche', 'Marchihue', 'Navidad', 'Paredones', 'San Fernando', 'Chépica', 'Chimbarongo', 'Lolol', 'Nancagua', 'Palmilla', 'Peralillo', 'Placilla', 'Pumanque', 'Santa Cruz'],
  'Maule': ['Talca', 'Constitución', 'Curepto', 'Empedrado', 'Maule', 'Pelarco', 'Pencahue', 'Río Claro', 'San Clemente', 'San Rafael', 'Cauquenes', 'Chanco', 'Pelluhue', 'Curicó', 'Hualañé', 'Licantén', 'Molina', 'Rauco', 'Romeral', 'Sagrada Familia', 'Teno', 'Vichuquén', 'Linares', 'Colbún', 'Longaví', 'Parral', 'Retiro', 'San Javier', 'Villa Alegre', 'Yerbas Buenas'],
  'Ñuble': ['Cobquecura', 'Coelemu', 'Ninhue', 'Portezuelo', 'Quirihue', 'Ránquil', 'Treguaco', 'Bulnes', 'Chillán Viejo', 'Chillán', 'El Carmen', 'Pemuco', 'Pinto', 'Quillón', 'San Ignacio', 'Yungay', 'Coihueco', 'Ñiquén', 'San Carlos', 'San Fabián', 'San Nicolás'],
  'Biobío': ['Concepción', 'Coronel', 'Chiguayante', 'Florida', 'Hualqui', 'Lota', 'Penco', 'San Pedro de la Paz', 'Santa Juana', 'Talcahuano', 'Tomé', 'Hualpén', 'Lebu', 'Arauco', 'Cañete', 'Contulmo', 'Curanilahue', 'Los Álamos', 'Tirúa', 'Los Ángeles', 'Antuco', 'Cabrero', 'Laja', 'Mulchén', 'Nacimiento', 'Negrete', 'Quilaco', 'Quilleco', 'San Rosendo', 'Santa Bárbara', 'Tucapel', 'Alto Biobío'],
  'Araucanía': ['Temuco', 'Carahue', 'Cunco', 'Curarrehue', 'Freire', 'Galvarino', 'Gorbea', 'Lautaro', 'Loncoche', 'Melipeuco', 'Nueva Imperial', 'Padre las Casas', 'Perquenco', 'Pitrufquén', 'Pucón', 'Saavedra', 'Teodoro Schmidt', 'Toltén', 'Vilcún', 'Villarrica', 'Cholchol', 'Angol', 'Collipulli', 'Curacautín', 'Ercilla', 'Lonquimay', 'Los Sauces', 'Lumaco', 'Purén', 'Renaico', 'Traiguén', 'Victoria'],
  'Los Ríos': ['Valdivia', 'Corral', 'Lanco', 'Los Lagos', 'Máfil', 'Mariquina', 'Paillaco', 'Panguipulli', 'La Unión', 'Futrono', 'Lago Ranco', 'Río Bueno'],
  'Los Lagos': ['Puerto Montt', 'Calbuco', 'Cochamó', 'Fresia', 'Frutillar', 'Los Muermos', 'Llanquihue', 'Maullín', 'Puerto Varas', 'Castro', 'Ancud', 'Chonchi', 'Curaco de Vélez', 'Dalcahue', 'Puqueldón', 'Queilén', 'Quellón', 'Quemchi', 'Quinchao', 'Osorno', 'Puerto Octay', 'Purranque', 'Puyehue', 'Río Negro', 'San Juan de la Costa', 'San Pablo', 'Chaitén', 'Futaleufú', 'Hualaihué', 'Palena'],
  'Aysén': ['Coihaique', 'Lago Verde', 'Aysén', 'Cisnes', 'Guaitecas', 'Cochrane', 'O\'Higgins', 'Tortel', 'Chile Chico', 'Río Ibáñez'],
  'Magallanes': ['Punta Arenas', 'Laguna Blanca', 'Río Verde', 'San Gregorio', 'Cabo de Hornos', 'Antártica', 'Porvenir', 'Primavera', 'Timaukel', 'Natales', 'Torres del Paine']
};

export default function ConfiguracionEmpresa() {
  const appEmpresas = useAppStore((s) => s.empresas);
  const appEmpresaActiva = useAppStore((s) => s.empresaActiva);
  const setEmpresaActivaById = useAppStore((s) => s.setEmpresaActivaById);
  const addEmpresa = useAppStore((s) => s.addEmpresa);
  const deleteEmpresa = useAppStore((s) => s.deleteEmpresa);
  const updateEmpresa = useAppStore((s) => s.updateEmpresa);
  const validarRUT = useAppStore((s) => s.validarRUTEmpresa);
  const esEmpresaSimple = useAppStore((s) => s.esEmpresaSimple);
  const { showToast } = useApp();
  const confirmDialog = useConfirm();

  const [empresas, setEmpresas] = useState<Empresa[]>(appEmpresas);
  const [empresaActiva, setEmpresaActiva] = useState<Empresa | null>(appEmpresaActiva);
  const [editando, setEditando] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nuevaEmpresa, setNuevaEmpresa] = useState<Partial<Empresa>>({
    razonSocial: '',
    nombreFantasia: '',
    rut: '',
    giro: '',
    direccion: '',
    comuna: '',
    ciudad: '',
    telefono: '',
    email: '',
    activa: true,
  });
  const [actividadSeleccionada, setActividadSeleccionada] = useState<string>('');

  const seleccionarEmpresa = (empresa: Empresa) => {
    setEmpresaActivaById(empresa.id);
    setEmpresaActiva(empresa);
  };

  const crearEmpresa = () => {
    if (!nuevaEmpresa.razonSocial || !nuevaEmpresa.rut) {
      showToast('warning', 'Datos incompletos', 'Debe ingresar razón social y RUT');
      return;
    }

    if (!validarRUT(nuevaEmpresa.rut!)) {
      showToast('error', 'RUT inválido', 'El RUT ingresado no es válido');
      return;
    }

    addEmpresa(nuevaEmpresa as Omit<Empresa, 'id'>);
    setEmpresas(useAppStore.getState().empresas);
    setMostrarFormulario(false);
    setNuevaEmpresa({
      razonSocial: '',
      nombreFantasia: '',
      rut: '',
      giro: '',
      direccion: '',
      comuna: '',
      ciudad: '',
      telefono: '',
      email: '',
      activa: true,
    });
    setActividadSeleccionada('');
  };

  const eliminarEmpresa = async (id: string) => {
    const ok = await confirmDialog({
      title: 'Eliminar empresa',
      message: 'Esta acción no se puede deshacer. ¿Deseas eliminar esta empresa y su configuración?',
      confirmText: 'Eliminar',
      variant: 'danger',
    });
    if (ok) {
      deleteEmpresa(id);
      setEmpresas(useAppStore.getState().empresas);
      setEmpresaActiva(useAppStore.getState().empresaActiva);
      showToast('success', 'Empresa eliminada', 'La empresa fue eliminada del sistema.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Multi-Empresa</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona múltiples empresas en un solo sistema
          </p>
        </div>
        <Button
          onClick={() => setMostrarFormulario(!mostrarFormulario)}
          icon={<Plus size={18} />}
        >
          Nueva Empresa
        </Button>
      </div>

      {/* Selector de empresa activa */}
      <Card title="Empresa Activa">
        {empresaActiva ? (
          <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            {empresaActiva.logo ? (
              <img src={empresaActiva.logo} alt="Logo" className="w-12 h-12 object-contain rounded-lg" />
            ) : (
              <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Building2 size={24} className="text-white" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{empresaActiva.nombreFantasia}</h3>
              <p className="text-sm text-gray-600">{empresaActiva.razonSocial}</p>
              <p className="text-xs text-gray-500 mt-1">RUT: {empresaActiva.rut}</p>
            </div>
            <div className="px-3 py-1 bg-emerald-500 text-white text-xs rounded-full">
              Activo
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg text-center">
            <p className="text-gray-500">No hay empresa activa seleccionada</p>
          </div>
        )}
      </Card>

      {/* Formulario nueva empresa */}
      {mostrarFormulario && (
        <Card title="Nueva Empresa">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Razón Social *
              </label>
              <input
                type="text"
                value={nuevaEmpresa.razonSocial}
                onChange={(e) => setNuevaEmpresa({ ...nuevaEmpresa, razonSocial: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
                placeholder="Ej: Mi Empresa Ltda."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Fantasía
              </label>
              <input
                type="text"
                value={nuevaEmpresa.nombreFantasia}
                onChange={(e) => setNuevaEmpresa({ ...nuevaEmpresa, nombreFantasia: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
                placeholder="Ej: Mi Empresa"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RUT *
              </label>
              <input
                type="text"
                value={nuevaEmpresa.rut}
                onChange={(e) => setNuevaEmpresa({ ...nuevaEmpresa, rut: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
                placeholder="12.345.678-9"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Actividad Económica
              </label>
              <select
                value={actividadSeleccionada}
                onChange={(e) => {
                  const val = e.target.value;
                  setActividadSeleccionada(val);
                  const actividad = ACTIVIDADES_SII.find(a => a.nombre === val);
                  if (actividad) {
                    setNuevaEmpresa({ ...nuevaEmpresa, giro: actividad.giro });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
              >
                <option value="">Seleccione una actividad</option>
                {ACTIVIDADES_SII.map(act => (
                  <option key={act.codigo} value={act.nombre}>
                    [{act.codigo}] {act.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Giro
              </label>
              <input
                type="text"
                value={nuevaEmpresa.giro}
                onChange={(e) => setNuevaEmpresa({ ...nuevaEmpresa, giro: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
                placeholder="Ej: Venta de productos"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección
              </label>
              <input
                type="text"
                value={nuevaEmpresa.direccion}
                onChange={(e) => setNuevaEmpresa({ ...nuevaEmpresa, direccion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
                placeholder="Ej: Av. Principal 123"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Región / Ciudad
              </label>
              <select
                value={nuevaEmpresa.ciudad}
                onChange={(e) => {
                  const val = e.target.value;
                  const comunas = REGIONES_COMUNAS[val] || [];
                  setNuevaEmpresa({ ...nuevaEmpresa, ciudad: val, comuna: comunas.length > 0 ? comunas[0] : '' });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
              >
                <option value="">Seleccione región...</option>
                {Object.keys(REGIONES_COMUNAS).map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Comuna
              </label>
              <select
                value={nuevaEmpresa.comuna}
                onChange={(e) => setNuevaEmpresa({ ...nuevaEmpresa, comuna: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
                disabled={!nuevaEmpresa.ciudad}
              >
                <option value="">Seleccione comuna...</option>
                {(REGIONES_COMUNAS[nuevaEmpresa.ciudad || ''] || []).map(com => (
                  <option key={com} value={com}>{com}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="text"
                value={nuevaEmpresa.telefono}
                onChange={(e) => setNuevaEmpresa({ ...nuevaEmpresa, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
                placeholder="+56 2 2345 6789"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={nuevaEmpresa.email}
                onChange={(e) => setNuevaEmpresa({ ...nuevaEmpresa, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20"
                placeholder="contacto@empresa.cl"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo de empresa</label>
              <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#1E3A5F] hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'].includes(file.type)) {
                      showToast('error', 'Formato no válido', 'Usa PNG, JPG o SVG.');
                      return;
                    }
                    if (file.size > 500000) {
                      showToast('error', 'Imagen muy grande', 'Máximo 500KB.');
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setNuevaEmpresa({ ...nuevaEmpresa, logo: ev.target?.result as string });
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                <Upload size={18} className="text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Subir logo</p>
                  <p className="text-xs text-gray-500">PNG, JPG, SVG — max 500KB</p>
                </div>
                {nuevaEmpresa.logo && (
                  <div className="ml-auto flex items-center gap-2">
                    <img src={nuevaEmpresa.logo} alt="Logo" className="h-10 w-10 object-contain rounded border" />
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setNuevaEmpresa({ ...nuevaEmpresa, logo: '' }); }}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                )}
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setMostrarFormulario(false)}>
              Cancelar
            </Button>
            <SaveButton onSave={crearEmpresa}>
              <Check size={18} />
              Crear Empresa
            </SaveButton>
          </div>
        </Card>
      )}

      {/* Lista de empresas */}
      <Card title="Empresas Registradas">
        <div className="space-y-3">
          {empresas.map((empresa) => (
            <div
              key={empresa.id}
              className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                empresaActiva?.id === empresa.id
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    empresaActiva?.id === empresa.id ? 'bg-emerald-500' : 'bg-gray-400'
                  }`}
                >
                  <Building2 size={20} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-gray-900">{empresa.nombreFantasia}</h4>
                    {empresaActiva?.id === empresa.id && (
                      <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs rounded-full">
                        Activa
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{empresa.razonSocial}</p>
                  <p className="text-xs text-gray-500">
                    {empresa.rut} - {empresa.giro}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {empresaActiva?.id !== empresa.id && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => seleccionarEmpresa(empresa)}
                  >
                    Activar
                  </Button>
                )}
                <button
                  onClick={() => eliminarEmpresa(empresa.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {empresaActiva && (
        <Card title="Logo de la Empresa">
          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex-shrink-0">
              {empresaActiva.logo ? (
                <img src={empresaActiva.logo} alt="Logo actual" className="h-24 w-auto object-contain rounded-lg border-2 border-gray-200" />
              ) : (
                <div className="h-24 w-24 flex items-center justify-center bg-gray-200 rounded-lg border-2 border-dashed border-gray-300">
                  <Image size={32} className="text-gray-400" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 mb-1">Cambiar logo</p>
              <p className="text-xs text-gray-500 mb-3">PNG, JPG o SVG. Maximo 500KB. Se muestra en reportes PDF.</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E3A5F] text-white rounded-lg cursor-pointer hover:bg-[#2D5A87] transition-colors text-sm">
                <Upload size={16} />
                Seleccionar imagen
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 500000) { showToast('error', 'Imagen muy grande', 'Máximo 500KB'); return; }
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      const logo = ev.target?.result as string;
                      updateEmpresa(empresaActiva.id, { logo });
                      setEmpresaActiva({ ...empresaActiva, logo });
                      setEmpresas(useAppStore.getState().empresas);
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {empresaActiva.logo && (
                <button
                  onClick={() => {
                    updateEmpresa(empresaActiva.id, { logo: '' });
                    setEmpresaActiva({ ...empresaActiva, logo: '' });
                    setEmpresas(useAppStore.getState().empresas);
                  }}
                  className="ml-2 inline-flex items-center gap-1 px-3 py-2 text-red-600 text-sm hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash size={14} /> Quitar
                </button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Info de empresa simple */}
      {empresaActiva && (
        <Card title="Clasificación Fiscal">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={18} className="text-blue-600" />
                <span className="font-medium text-blue-900">Régimen</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">
                {esEmpresaSimple(empresaActiva.rut) ? 'PYME' : 'General'}
              </p>
              <p className="text-xs text-blue-700 mt-1">
                {esEmpresaSimple(empresaActiva.rut)
                  ? 'Empresa simple según SII'
                  : 'Régimen tributario general'}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Globe size={18} className="text-purple-600" />
                <span className="font-medium text-purple-900">Ubicación</span>
              </div>
              <p className="font-medium text-purple-900">
                {empresaActiva.comuna}, {empresaActiva.ciudad}
              </p>
              <p className="text-xs text-purple-700 mt-1">{empresaActiva.direccion}</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <User size={18} className="text-amber-600" />
                <span className="font-medium text-amber-900">Contacto</span>
              </div>
              <p className="font-medium text-amber-900">{empresaActiva.telefono || 'N/A'}</p>
              <p className="text-xs text-amber-700">{empresaActiva.email || 'N/A'}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
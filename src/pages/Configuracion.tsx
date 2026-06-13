import React, { useState } from 'react';
import { FileText, Plus, Edit2, Trash2, Save, Building2, Palette, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/Cards';
import { Button, Input, Textarea } from '../components/ui/FormElements';
import { SaveButton } from '../components/ui/SaveButton';
import { formatRUT } from '../utils/calculos';
import { ACTIVIDADES_SII } from '../data/sii';
import { useTheme, ThemeConfig } from '../context/ThemeContext';

// ── Swatches de colores predefinidos ───────────────────────────────────────
const COLOR_SWATCHES: Array<{ name: string; primary: string; accent: string }> = [
  { name: 'Azul marino',  primary: '#1E3A5F', accent: '#10B981' },
  { name: 'Índigo',       primary: '#3730A3', accent: '#F59E0B' },
  { name: 'Violeta',      primary: '#5B21B6', accent: '#EC4899' },
  { name: 'Verde bosque', primary: '#065F46', accent: '#3B82F6' },
  { name: 'Gris grafito', primary: '#374151', accent: '#10B981' },
  { name: 'Rojo corporat.',primary: '#991B1B', accent: '#F59E0B' },
];

const RADIUS_OPTIONS: Array<{ value: ThemeConfig['borderRadius']; label: string; preview: string }> = [
  { value: 'sm', label: 'Cuadrado',   preview: 'rounded' },
  { value: 'md', label: 'Suave',      preview: 'rounded-lg' },
  { value: 'lg', label: 'Redondo',    preview: 'rounded-2xl' },
];

const FONT_OPTIONS: Array<{ value: ThemeConfig['fontScale']; label: string }> = [
  { value: 'sm', label: 'Pequeño' },
  { value: 'md', label: 'Normal' },
  { value: 'lg', label: 'Grande' },
];

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

export default function Configuracion() {
  const { state, dispatch, showToast } = useApp();
  const { theme, setTheme, resetTheme } = useTheme();
  const [formData, setFormData] = useState(state.configuracion);
  const [hasChanges, setHasChanges] = useState(false);
  const [actividadSeleccionada, setActividadSeleccionada] = useState<string>(formData.actividadEconomica || '');

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    setHasChanges(true);
  };

  const handleSave = () => {
    dispatch({ type: 'SET_CONFIGURACION', payload: formData });
    showToast('success', 'Éxito', 'Configuración guardada correctamente');
    setHasChanges(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-sm text-gray-500 mt-1">
            Datos de la empresa y configuración general del sistema
          </p>
        </div>
        {hasChanges && (
          <SaveButton onSave={handleSave}>
            <Save size={16} />
            Guardar Cambios
          </SaveButton>
        )}
      </div>

      {/* Datos de la Empresa */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Building2 size={20} />
            Datos de la Empresa
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Razón Social"
            value={formData.razonSocial}
            onChange={(e) => handleChange('razonSocial', e.target.value)}
          />
          <Input
            label="Nombre de Fantasía"
            value={formData.nombreFantasia}
            onChange={(e) => handleChange('nombreFantasia', e.target.value)}
          />
          <Input
            label="RUT"
            value={formData.rut}
            onChange={(e) => handleChange('rut', e.target.value)}
            placeholder="12.345.678-9"
          />
          <Input
            label="Giro"
            value={formData.giro}
            onChange={(e) => handleChange('giro', e.target.value)}
          />
          <div className="w-full md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Actividad Económica (CIIU)
            </label>
            <select
              value={actividadSeleccionada}
              onChange={(e) => {
                const val = e.target.value;
                setActividadSeleccionada(val);
                const actividad = ACTIVIDADES_SII.find(a => a.nombre === val);
                if (actividad) {
                  setFormData({ ...formData, actividadEconomica: val, giro: actividad.giro });
                  setHasChanges(true);
                } else {
                  handleChange('actividadEconomica', val);
                }
              }}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] transition-all duration-200"
            >
              <option value="">Seleccione una actividad</option>
              {ACTIVIDADES_SII.map(act => (
                <option key={act.codigo} value={act.nombre}>
                  [{act.codigo}] {act.nombre}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Dirección"
            value={formData.direccion}
            onChange={(e) => handleChange('direccion', e.target.value)}
            className="md:col-span-2"
          />
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Ciudad / Región
            </label>
            <select
              value={formData.ciudad}
              onChange={(e) => {
                const val = e.target.value;
                const comunas = REGIONES_COMUNAS[val] || [];
                setFormData({ ...formData, ciudad: val, comuna: comunas.length > 0 ? comunas[0] : '' });
                setHasChanges(true);
              }}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] transition-all duration-200"
            >
              <option value="">Seleccione región...</option>
              {Object.keys(REGIONES_COMUNAS).map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Comuna
            </label>
            <select
              value={formData.comuna}
              onChange={(e) => handleChange('comuna', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] transition-all duration-200 disabled:bg-gray-50"
              disabled={!formData.ciudad}
            >
              <option value="">Seleccione comuna...</option>
              {(REGIONES_COMUNAS[formData.ciudad || ''] || []).map(com => (
                <option key={com} value={com}>{com}</option>
              ))}
            </select>
          </div>
          <Input
            label="Teléfono"
            value={formData.telefono}
            onChange={(e) => handleChange('telefono', e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
          />
          <Input
            label="Sitio Web"
            value={formData.web}
            onChange={(e) => handleChange('web', e.target.value)}
          />
        </div>
      </Card>

      {/* Resoluciones SII */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <FileText size={20} />
            Resoluciones SII
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Input
            label="Facturas"
            value={formData.resoluciones.factura}
            onChange={(e) =>
              setFormData({
                ...formData,
                resoluciones: { ...formData.resoluciones, factura: e.target.value },
              })
            }
          />
          <Input
            label="Boletas"
            value={formData.resoluciones.boleta}
            onChange={(e) =>
              setFormData({
                ...formData,
                resoluciones: { ...formData.resoluciones, boleta: e.target.value },
              })
            }
          />
          <Input
            label="Guías"
            value={formData.resoluciones.guia}
            onChange={(e) =>
              setFormData({
                ...formData,
                resoluciones: { ...formData.resoluciones, guia: e.target.value },
              })
            }
          />
        </div>
      </Card>

      {/* Vista Previa */}
      <Card title="Vista Previa del Encabezado">
        <div className="bg-gray-50 p-6 rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{formData.razonSocial}</h3>
              <p className="text-sm text-gray-600">{formData.giro}</p>
              <p className="text-sm text-gray-500 mt-2">
                {formData.direccion}, {formData.comuna}, {formData.ciudad}
              </p>
              <p className="text-sm text-gray-500">RUT: {formatRUT(formData.rut)}</p>
            </div>
            <div className="text-right text-sm text-gray-600">
              <p>{formData.telefono}</p>
              <p>{formData.email}</p>
              <p>{formData.web}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Personalización visual ─────────────────────────────────────────── */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Palette size={20} />
            Personalización Visual
          </div>
        }
        action={
          <button
            onClick={() => { resetTheme(); showToast('info', 'Tema', 'Tema restablecido a valores por defecto'); }}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <RotateCcw size={13} />
            Restablecer
          </button>
        }
      >
        <div className="space-y-6">

          {/* Color scheme swatches */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Esquema de color
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {COLOR_SWATCHES.map(s => {
                const isActive = theme.primaryColor === s.primary;
                return (
                  <button
                    key={s.primary}
                    onClick={() => setTheme({ primaryColor: s.primary, accentColor: s.accent })}
                    title={s.name}
                    className={`relative group flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all
                      ${isActive ? 'border-gray-900 dark:border-gray-200 shadow-md' : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'}`}
                  >
                    <div className="flex gap-0.5">
                      <div className="w-5 h-8 rounded-l-md" style={{ background: s.primary }} />
                      <div className="w-5 h-8 rounded-r-md" style={{ background: s.accent }} />
                    </div>
                    <span className="text-[10px] text-gray-500 text-center leading-tight truncate w-full">{s.name}</span>
                    {isActive && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center">
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                          <path d="M1.5 4.5l2 2 4-4" stroke={theme.primaryColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom color inputs */}
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="w-24">Color primario</span>
                <input
                  type="color"
                  value={theme.primaryColor}
                  onChange={e => setTheme({ primaryColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                />
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded font-mono">
                  {theme.primaryColor}
                </code>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="w-24">Color acento</span>
                <input
                  type="color"
                  value={theme.accentColor}
                  onChange={e => setTheme({ accentColor: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                />
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded font-mono">
                  {theme.accentColor}
                </code>
              </label>
            </div>
          </div>

          {/* Border radius */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Radio de esquinas
            </label>
            <div className="flex gap-2">
              {RADIUS_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setTheme({ borderRadius: o.value })}
                  className={`flex-1 flex flex-col items-center gap-2 py-3 px-2 rounded-xl border-2 transition-all
                    ${theme.borderRadius === o.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
                >
                  <div
                    className={`w-8 h-8 bg-gray-300 dark:bg-gray-600 ${o.preview}`}
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">{o.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Font scale */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Tamaño de texto
            </label>
            <div className="flex gap-2">
              {FONT_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setTheme({ fontScale: o.value })}
                  className={`flex-1 py-2 px-3 rounded-lg border-2 text-sm transition-all
                    ${theme.fontScale === o.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview strip */}
          <div
            className="p-4 rounded-xl border border-gray-200 dark:border-gray-700"
            style={{ borderRadius: 'var(--radius-card)' }}
          >
            <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-semibold">Vista previa</p>
            <div className="flex items-center gap-3">
              <button
                className="px-4 py-2 text-sm font-medium text-white rounded-lg"
                style={{ background: theme.primaryColor, borderRadius: 'var(--radius-card)' }}
              >
                Botón primario
              </button>
              <button
                className="px-4 py-2 text-sm font-medium text-white rounded-lg"
                style={{ background: theme.accentColor, borderRadius: 'var(--radius-card)' }}
              >
                Acento
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Texto de ejemplo Aa Bb
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

# Sistema Contable Chile - Especificación Técnica

## 1. Concepto & Visión

Sistema contable profesional diseñado específicamente para empresas chilenas, incorporando todas las normativas tributarias del SII, cálculos de remuneraciones conforme a la legislación laboral chilena, y gestión documental según normativa chilena vigente. Interfaz elegante que combina la seriedad contable con una experiencia de usuario moderna e intuitiva.

## 2. Design Language

### Aesthetic Direction
Estilo "Corporate Precision" - minimalista profesional con acentos azules profundos que evocan confianza y solidez financiera. Inspirado en aplicaciones bancarias suizas con toque latinoamericano.

### Color Palette
- **Primary**: #1E3A5F (Azul Profundo)
- **Secondary**: #2D5A87 (Azul Medio)
- **Accent**: #10B981 (Verde Éxito)
- **Background**: #F8FAFC (Gris Muy Claro)
- **Surface**: #FFFFFF (Blanco Puro)
- **Text Primary**: #1F2937
- **Text Secondary**: #6B7280
- **Danger**: #EF4444 (Rojo Error)
- **Warning**: #F59E0B (Amarillo Alerta)

### Typography
- **Headers**: Inter (700, 600) - Professionalidad sin esfuerzo
- **Body**: Inter (400, 500) - Legibilidad óptima
- **Numbers/Data**: JetBrains Mono - Claridad en cifras

### Spatial System
- Base unit: 4px
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px
- Border radius: 8px (cards), 6px (buttons), 4px (inputs)
- Shadows: Subtle, 3 niveles de elevación

### Motion Philosophy
- Transiciones suaves: 200ms ease-out para interacciones
- Animaciones de entrada: fade + slide, 300ms
- Micro-interacciones en hover sobre elementos interactivos
- Sin animaciones excesivas - transmite seriedad profesional

## 3. Layout & Structure

### Arquitectura de Página
```
┌─────────────────────────────────────────────────────────┐
│  HEADER: Logo + Navegación Principal + Usuario         │
├──────────┬────────────────────────────────────────────┤
│          │                                            │
│  SIDEBAR │           MAIN CONTENT AREA                │
│  (220px) │                                            │
│          │  ┌────────────────────────────────────┐    │
│  Módulos │  │  Page Header + Acciones            │    │
│          │  ├────────────────────────────────────┤    │
│          │  │                                    │    │
│          │  │  Content Cards / Tables / Forms   │    │
│          │  │                                    │    │
│          │  └────────────────────────────────────┘    │
│          │                                            │
└──────────┴────────────────────────────────────────────┘
```

### Páginas del Sistema
1. **Dashboard** - Resumen ejecutivo con KPIs principales
2. **Plan de Cuentas** - Gestión del catálogo de cuentas
3. **Asientos Contables** - Registro y búsqueda de asientos
4. **Remuneraciones** - Cálculo de sueldo líquido, AFP, Salud
5. **Facturación** - Emisión de documentos tributarios (SII)
6. **Libro Ventas** - Registro y consulta de ventas
7. **Libro Compras** - Registro y consulta de compras
8. **Honorarios** - Cálculo de boletas de honorarios
9. **Estados Financieros** - Balance y Estado de Resultados

## 4. Features & Interactions

### 4.1 Dashboard
- **KPIs Cards**: Ventas mensuales, Compras, Remuneraciones, Impuestos pendientes
- **Gráficos**: Evolución mensual de ventas/gastos, Distribución por categoría
- **Alertas**: Documentos pendientes, vencimientos próximo mes

### 4.2 Plan de Cuentas (NIC Chile)
Estructura conforme a la normativa chilena:
- **1xx**: Activos (Corrientes y No Corrientes)
- **2xx**: Pasivos (Corrientes y No Corrientes)
- **3xx**: Patrimonio
- **4xx**: Ingresos
- **5xx**: Costos y Gastos
- **6xx**: Otros Ingresos y Gastos

Cada cuenta incluye:
- Código (numérico jerárquico)
- Nombre
- Tipo (Activo/Pasivo/Patrimonio/Ingreso/Gasto)
- Naturaleza (Deudora/Acreedora)
- Permite movimiento (Sí/No)

### 4.3 Remuneraciones (Normativa Chilena)

#### Cotizaciones Obligatorias (2024-2025):
- **AFP**: 10% ahorro individual + comisión
- **Seguro de Invalidez y Sobrevivencia (SIS):** 1.53% (independientes: 1.97%?)
- **Salud (FONASA/ISAPRE)**: 7% cotización legal
- **AFC (Desempleo)**: 0.6% imponible (contrata) / 2.4% (plazo)
- **APVC**: Ahorro voluntario (opcional)

#### Cálculo de Sueldo Líquido:
```
Sueldo Bruto
- Cotización AFP (10% + comisión)
- Cotización Salud (7%)
- Cotización SIS (1.53%)
- Cotización AFC (0.6% o 2.4%)
= Sueldo Imponible
- Impuesto Único (según escala)
= Sueldo Líquido
```

#### Impuestos Único (Escala 2024):
| Tramo | Renta Imponible | Tasa | Deducción |
|-------|------------------|------|-----------|
| 1 | 0 - 13,5 UIT | Exento | - |
| 2 | 13,5 - 27 UIT | 4% | 0,54 UIT |
| 3 | 27 - 54 UIT | 8% | 1,62 UIT |
| 4 | 54 - 81 UIT | 13,5% | 4,86 UIT |
| 5 | 81 - 108 UIT | 23% | 11,88 UIT |
| 6 | 108 - 144 UIT | 30% | 23,52 UIT |
| 7 | 144+ UIT | 35% | 37,08 UIT |

*UIT 2024 = $65.446*

### 4.4 Facturación (SII)

#### Documentos Tributarios Electrónicos:
- **Factura**: Venta de bienes/servicios
- **Factura Exenta**: Ventas exentas de IVA
- **Boleta**: Venta minorista (no da crédito fiscal)
- **Nota de Crédito**: Corrección de documento anterior
- **Nota de Débito**: Cargos adicionales
- **Guía de Despacho**: Traslado de mercaderías

#### Campos obligatorios según normativa SII:
- RUT emisor/receptor
- Giro (para empresas)
- Dirección
- Comuna/Ciudad
- Condición de pago
- Detalle de productos/servicios
- IVA (19%)
- Total

### 4.5 Libros de Ventas/Compras
- Registros con resumen mensual
- Totales por tipo de documento
- Cálculo automático de IVA
- Exportación a Excel/Libro SII

### 4.6 Honorarios
Cálculo según normativa ART. 42 N°2 LIR:
```
Honorario Bruto
- Retención 10% (si empresa)
= Líquido a pagar

Para calcular desde líquido:
Líquido / 0,9 = Honorario Bruto
Retención = Honorario Bruto × 10%
```

## 5. Component Inventory

### Navigation
- **Sidebar**: Fondo oscuro (#1E3A5F), íconos Lucide, estados hover con highlight
- **Header**: Logo + breadcrumb + avatar usuario

### Cards
- **KPI Card**: Número grande, label, variación %, ícono contextual
- **Transaction Card**: Fecha, descripción, monto, tipo (ingreso/gasto)
- **Document Card**: Tipo, número, fecha, estado, monto

### Tables
- **Data Table**: Sorting, pagination, zebra striping
- **Actions**: Editar, eliminar, ver detalle

### Forms
- **Input Fields**: Labels flotantes, validación en tiempo real
- **Selects**: Dropdowns estilizados con búsqueda
- **Date Pickers**: Calendario con formato dd/mm/yyyy
- **Currency Inputs**: Formato automático CLP

### Buttons
- **Primary**: Fondo azul, texto blanco
- **Secondary**: Borde azul, fondo transparente
- **Danger**: Fondo rojo para eliminaciones
- **States**: Default, hover (darken 10%), active, disabled (opacity 50%)

### Feedback
- **Toast Notifications**: Slide-in desde arriba derecha
- **Loading Spinner**: Spinner azul con mensaje
- **Empty States**: Ícono + mensaje + acción sugerida
- **Error States**: Fondo rojo claro + ícono + mensaje

## 6. Technical Approach

### Stack
- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State**: React Context + useReducer
- **Routing**: React Router v6
- **Charts**: Recharts
- **Icons**: Lucide React
- **Storage**: LocalStorage (persistência demo)

### Data Model
```typescript
interface Cuenta {
  id: string;
  codigo: string;
  nombre: string;
  tipo: 'activo' | 'pasivo' | 'patrimonio' | 'ingreso' | 'gasto';
  naturaleza: 'deudora' | 'acreedora';
  permiteMovimiento: boolean;
  nivel: number;
  padreId?: string;
}

interface AsientoContable {
  id: string;
  fecha: string;
  glosa: string;
  detalles: DetalleAsiento[];
  totalDebe: number;
  totalHaber: number;
}

interface Trabajador {
  id: string;
  rut: string;
  nombre: string;
  cargo: string;
  sueldoBase: number;
  afp: string;
  isapre: string;
  tipoContrato: 'indefinido' | 'plazo' | 'honorarios';
}

interface DocumentoTributario {
  id: string;
  tipo: 'factura' | 'factura_exenta' | 'boleta' | 'nota_credito' | 'nota_debito';
  numero: number;
  fecha: string;
  receptor: {
    rut: string;
    razonSocial: string;
    giro?: string;
    direccion: string;
    comuna: string;
  };
  detalles: LineaDetalle[];
  subtotal: number;
  iva: number;
  total: number;
}
```

### Cálculos Normativos
- Cotizaciones AFP: Tabla dinámica de comisiones por AFP
- Impuestos: Escala progresiva ART. 52 LIR
- IVA: 19% sobre base imponible
- Honorarios: Retención 10% ART. 42 N°2

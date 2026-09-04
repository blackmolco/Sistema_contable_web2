-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'contador',
    "passwordHash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcceso" TIMESTAMP(3),
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresaId" TEXT,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sesion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "refreshToken" TEXT,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaExpiracion" TIMESTAMP(3) NOT NULL,
    "ipOrigen" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreFantasia" TEXT,
    "giro" TEXT,
    "direccion" TEXT,
    "comuna" TEXT,
    "ciudad" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "representanteLegal" TEXT,
    "rutRepresentante" TEXT,
    "logo" TEXT,
    "configuracion" TEXT DEFAULT '{}',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuenta" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "naturaleza" TEXT NOT NULL DEFAULT 'deudora',
    "nivel" INTEGER NOT NULL DEFAULT 1,
    "padreId" TEXT,
    "afectaIva" BOOLEAN NOT NULL DEFAULT false,
    "descripcion" TEXT,
    "refSII" TEXT,
    "permiteMovimiento" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "empresaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsientoContable" (
    "id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "glosa" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "tipo" TEXT,
    "usuarioId" TEXT,
    "empresaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsientoContable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleAsiento" (
    "id" TEXT NOT NULL,
    "asientoId" TEXT NOT NULL,
    "cuentaId" TEXT,
    "cuentaCodigo" TEXT,
    "cuentaNombre" TEXT,
    "debe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "haber" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "glosa" TEXT,

    CONSTRAINT "DetalleAsiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trabajador" (
    "id" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "email" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "cargo" TEXT,
    "departamento" TEXT,
    "fechaIngreso" TIMESTAMP(3) NOT NULL,
    "fechaTermino" TIMESTAMP(3),
    "tipoContrato" TEXT NOT NULL,
    "sueldoBase" DOUBLE PRECISION NOT NULL,
    "colacion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "movilizacion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonificacion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "afp" TEXT NOT NULL,
    "isapre" TEXT,
    "saludPactado" DOUBLE PRECISION NOT NULL DEFAULT 7,
    "afc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cargasFamiliares" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "empresaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trabajador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidacionSueldo" (
    "id" TEXT NOT NULL,
    "trabajadorId" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "sueldoBase" DOUBLE PRECISION NOT NULL,
    "bonos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "horasExtras" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoHorasExtras" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gratificacion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalImponible" DOUBLE PRECISION NOT NULL,
    "colacion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "movilizacion" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuentoAFP" DOUBLE PRECISION NOT NULL,
    "descuentoSalud" DOUBLE PRECISION NOT NULL,
    "descuentoAFC" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "descuentoImpuesto" DOUBLE PRECISION NOT NULL,
    "otrosDescuentos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDescuentos" DOUBLE PRECISION NOT NULL,
    "asignacionFamiliar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sueldoLiquido" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'calculada',
    "fechaPago" TIMESTAMP(3),
    "ufValor" DOUBLE PRECISION,
    "utmValor" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiquidacionSueldo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoTributario" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "folio" INTEGER NOT NULL,
    "rutEmisor" TEXT NOT NULL,
    "rutReceptor" TEXT NOT NULL,
    "razonSocialReceptor" TEXT NOT NULL,
    "giroReceptor" TEXT,
    "direccionReceptor" TEXT,
    "comunaReceptor" TEXT,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3),
    "montoNeto" DOUBLE PRECISION NOT NULL,
    "iva" DOUBLE PRECISION NOT NULL,
    "montoExento" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoTotal" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'emitido',
    "tipoTransaccion" TEXT NOT NULL,
    "glosa" TEXT,
    "numeroAutorizacion" TEXT,
    "fechaRecepcionSII" TIMESTAMP(3),
    "empresaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentoTributario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibroCompra" (
    "id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "rutProveedor" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "montoNeto" DOUBLE PRECISION NOT NULL,
    "montoExento" DOUBLE PRECISION NOT NULL,
    "iva" DOUBLE PRECISION NOT NULL,
    "ivaNoRecuperable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoTotal" DOUBLE PRECISION NOT NULL,
    "empresaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibroCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibroVenta" (
    "id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "rutCliente" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "montoNeto" DOUBLE PRECISION NOT NULL,
    "montoExento" DOUBLE PRECISION NOT NULL,
    "iva" DOUBLE PRECISION NOT NULL,
    "montoTotal" DOUBLE PRECISION NOT NULL,
    "empresaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibroVenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Honorario" (
    "id" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "periodo" TEXT NOT NULL,
    "montoBruto" DOUBLE PRECISION NOT NULL,
    "retencion" DOUBLE PRECISION NOT NULL,
    "montoLiquido" DOUBLE PRECISION NOT NULL,
    "fechaPago" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "empresaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Honorario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivoFijo" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "fechaAdquisicion" TIMESTAMP(3) NOT NULL,
    "valorAdquisicion" DOUBLE PRECISION NOT NULL,
    "vidaUtilMeses" INTEGER NOT NULL,
    "depreciacionMensual" DOUBLE PRECISION NOT NULL,
    "depreciacionAcumulada" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "valorNeto" DOUBLE PRECISION NOT NULL,
    "ubicacion" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "empresaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivoFijo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TesoreriaMovimiento" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "origen" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'proyectado',
    "empresaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TesoreriaMovimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "empresaId" TEXT,
    "trabajadorId" TEXT,
    "asientoId" TEXT,
    "usuarioId" TEXT,
    "ruta" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "etiquetas" TEXT,
    "descripcion" TEXT,
    "fechaDoc" TIMESTAMP(3),
    "fechaSubida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchivoVersion" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "ruta" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tamano" INTEGER NOT NULL,

    CONSTRAINT "ArchivoVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaDocumento" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icono" TEXT NOT NULL,

    CONSTRAINT "CategoriaDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfiguracionNormativa" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descripcion" TEXT,
    "vigenteDesde" TIMESTAMP(3) NOT NULL,
    "vigenteHasta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfiguracionNormativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TablaSII" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "valor" TEXT,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TablaSII_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "detalles" TEXT,
    "ipOrigen" TEXT,
    "userAgent" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Backup" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "ruta" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'completado',
    "creadoPor" TEXT,

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Sesion_token_key" ON "Sesion"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Sesion_refreshToken_key" ON "Sesion"("refreshToken");

-- CreateIndex
CREATE INDEX "Sesion_token_idx" ON "Sesion"("token");

-- CreateIndex
CREATE INDEX "Sesion_refreshToken_idx" ON "Sesion"("refreshToken");

-- CreateIndex
CREATE INDEX "Sesion_usuarioId_idx" ON "Sesion"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_rut_key" ON "Empresa"("rut");

-- CreateIndex
CREATE INDEX "Cuenta_empresaId_idx" ON "Cuenta"("empresaId");

-- CreateIndex
CREATE INDEX "Cuenta_tipo_idx" ON "Cuenta"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Cuenta_codigo_empresaId_key" ON "Cuenta"("codigo", "empresaId");

-- CreateIndex
CREATE INDEX "AsientoContable_empresaId_idx" ON "AsientoContable"("empresaId");

-- CreateIndex
CREATE INDEX "AsientoContable_fecha_idx" ON "AsientoContable"("fecha");

-- CreateIndex
CREATE INDEX "AsientoContable_estado_idx" ON "AsientoContable"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "AsientoContable_numero_empresaId_fecha_key" ON "AsientoContable"("numero", "empresaId", "fecha");

-- CreateIndex
CREATE INDEX "DetalleAsiento_asientoId_idx" ON "DetalleAsiento"("asientoId");

-- CreateIndex
CREATE INDEX "Trabajador_empresaId_idx" ON "Trabajador"("empresaId");

-- CreateIndex
CREATE INDEX "Trabajador_rut_idx" ON "Trabajador"("rut");

-- CreateIndex
CREATE INDEX "LiquidacionSueldo_trabajadorId_idx" ON "LiquidacionSueldo"("trabajadorId");

-- CreateIndex
CREATE INDEX "LiquidacionSueldo_periodo_idx" ON "LiquidacionSueldo"("periodo");

-- CreateIndex
CREATE UNIQUE INDEX "LiquidacionSueldo_trabajadorId_periodo_key" ON "LiquidacionSueldo"("trabajadorId", "periodo");

-- CreateIndex
CREATE INDEX "DocumentoTributario_empresaId_idx" ON "DocumentoTributario"("empresaId");

-- CreateIndex
CREATE INDEX "DocumentoTributario_tipo_idx" ON "DocumentoTributario"("tipo");

-- CreateIndex
CREATE INDEX "DocumentoTributario_fechaEmision_idx" ON "DocumentoTributario"("fechaEmision");

-- CreateIndex
CREATE INDEX "DocumentoTributario_estado_idx" ON "DocumentoTributario"("estado");

-- CreateIndex
CREATE INDEX "DocumentoTributario_folio_idx" ON "DocumentoTributario"("folio");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoTributario_tipo_folio_empresaId_key" ON "DocumentoTributario"("tipo", "folio", "empresaId");

-- CreateIndex
CREATE INDEX "LibroCompra_empresaId_idx" ON "LibroCompra"("empresaId");

-- CreateIndex
CREATE INDEX "LibroCompra_periodo_idx" ON "LibroCompra"("periodo");

-- CreateIndex
CREATE INDEX "LibroVenta_empresaId_idx" ON "LibroVenta"("empresaId");

-- CreateIndex
CREATE INDEX "LibroVenta_periodo_idx" ON "LibroVenta"("periodo");

-- CreateIndex
CREATE INDEX "Honorario_empresaId_idx" ON "Honorario"("empresaId");

-- CreateIndex
CREATE INDEX "Honorario_periodo_idx" ON "Honorario"("periodo");

-- CreateIndex
CREATE INDEX "ActivoFijo_empresaId_idx" ON "ActivoFijo"("empresaId");

-- CreateIndex
CREATE INDEX "TesoreriaMovimiento_empresaId_idx" ON "TesoreriaMovimiento"("empresaId");

-- CreateIndex
CREATE INDEX "TesoreriaMovimiento_fecha_idx" ON "TesoreriaMovimiento"("fecha");

-- CreateIndex
CREATE INDEX "Documento_empresaId_idx" ON "Documento"("empresaId");

-- CreateIndex
CREATE INDEX "Documento_trabajadorId_idx" ON "Documento"("trabajadorId");

-- CreateIndex
CREATE INDEX "Documento_categoria_idx" ON "Documento"("categoria");

-- CreateIndex
CREATE INDEX "ArchivoVersion_documentoId_idx" ON "ArchivoVersion"("documentoId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaDocumento_nombre_key" ON "CategoriaDocumento"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ConfiguracionNormativa_clave_key" ON "ConfiguracionNormativa"("clave");

-- CreateIndex
CREATE INDEX "ConfiguracionNormativa_clave_idx" ON "ConfiguracionNormativa"("clave");

-- CreateIndex
CREATE INDEX "ConfiguracionNormativa_vigenteDesde_idx" ON "ConfiguracionNormativa"("vigenteDesde");

-- CreateIndex
CREATE INDEX "TablaSII_tipo_idx" ON "TablaSII"("tipo");

-- CreateIndex
CREATE INDEX "TablaSII_codigo_idx" ON "TablaSII"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "TablaSII_tipo_codigo_key" ON "TablaSII"("tipo", "codigo");

-- CreateIndex
CREATE INDEX "AuditLog_usuarioId_idx" ON "AuditLog"("usuarioId");

-- CreateIndex
CREATE INDEX "AuditLog_entidad_idx" ON "AuditLog"("entidad");

-- CreateIndex
CREATE INDEX "AuditLog_fecha_idx" ON "AuditLog"("fecha");

-- CreateIndex
CREATE INDEX "AuditLog_entidadId_idx" ON "AuditLog"("entidadId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsientoContable" ADD CONSTRAINT "AsientoContable_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleAsiento" ADD CONSTRAINT "DetalleAsiento_asientoId_fkey" FOREIGN KEY ("asientoId") REFERENCES "AsientoContable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiquidacionSueldo" ADD CONSTRAINT "LiquidacionSueldo_trabajadorId_fkey" FOREIGN KEY ("trabajadorId") REFERENCES "Trabajador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_trabajadorId_fkey" FOREIGN KEY ("trabajadorId") REFERENCES "Trabajador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivoVersion" ADD CONSTRAINT "ArchivoVersion_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


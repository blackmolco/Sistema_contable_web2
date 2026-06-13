/**
 * sii-rcv.js — Scraper real del Registro de Compras y Ventas del SII
 *
 * APIs reales confirmadas (Mayo 2026):
 *   Portal : https://www4.sii.cl/consdcvinternetui/
 *   Resumen: POST .../services/data/facadeService/getResumen
 *   Detalle: POST .../services/data/facadeService/getDetalleVenta
 *            POST .../services/data/facadeService/getDetalleCompra
 *
 * Flujo:
 *   1. GET RCV_URL → redirige al login AUT2000
 *   2. Llenar #rutcntr (RUT sin puntos+DV) y #clave → ejecuta_opcion()
 *   3. Navegar de vuelta al portal RCV
 *   4. Seleccionar mes/año con page.selectOption() (AngularJS)
 *   5. Clic en "Consultar" → interceptar getResumen
 *   6. Para cada tipo con rsmnLink=true, clic en la fila → interceptar getDetalle*
 */

const { chromium } = require('playwright');
const { logger }   = require('./logger');

const SII = {
  LOGIN_URL  : 'https://zeusr.sii.cl/AUT2000/InicioAutenticacion/IngresoRutClave.html',
  RCV_URL    : 'https://www4.sii.cl/consdcvinternetui/',
  BASE_URL   : 'https://www4.sii.cl',
  TIMEOUT_MS : 30_000,
  NAV_TIMEOUT: 45_000,
};

const TIPO_DTE = {
  '29': 'factura_inicio',  '30': 'factura',         '32': 'factura_exenta',
  '33': 'factura',         '34': 'factura_exenta',   '39': 'boleta',
  '41': 'boleta_exenta',   '43': 'liquidacion',      '46': 'factura_compra',
  '52': 'guia_despacho',   '56': 'nota_debito',      '61': 'nota_credito',
  '110': 'factura_exportacion',
};

/** "76.543.210-K" → "766204872" (sin puntos, sin guión) */
function rutParaLogin(rut) {
  return rut.replace(/\./g, '').replace('-', '').toUpperCase();
}

/** "76543210" + "K" → "76.543.210-K" */
function rutConFormato(numero, dv) {
  const n = String(numero);
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
}

function parseMonto(v) {
  if (!v && v !== 0) return 0;
  const s = String(v).replace(/[$\s"]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(s) || 0;
}

// ─── Función principal ────────────────────────────────────────────────────────
/**
 * @param {string}  rut        RUT empresa "76.543.210-K"
 * @param {string}  clave      Clave tributaria SII
 * @param {string}  periodo    "2026-05"
 * @param {'ventas'|'compras'} tipoLibro
 */
async function obtenerRCV(rut, clave, periodo, tipoLibro = 'ventas') {
  const [anio, mes]  = periodo.split('-');
  const periodoSII   = anio + mes;              // "202605"
  const operacion    = tipoLibro === 'ventas' ? 'VENTA' : 'COMPRA';
  const rutLogin     = rutParaLogin(rut);        // "766204872"
  const [rutNum, dv] = rut.replace(/\./g, '').split('-');  // ["76620487","2"]

  // No loguear RUT completo por privacidad — solo los primeros 4 dígitos enmascarados
  const rutMask = rutLogin.slice(0, 4) + '****';
  logger.info({ rut: rutMask, periodo, tipoLibro }, 'Iniciando scraping RCV SII');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale  : 'es-CL',
  });

  // Acumular respuestas de APIs internas del RCV
  let resumenData   = null;
  const detalleData = [];   // Todos los getDetalle* capturados

  context.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('facadeService')) return;
    try {
      const text = await response.text();
      if (!text.startsWith('{')) return;
      const json = JSON.parse(text);
      const endpoint = url.split('/').pop();

      if (endpoint === 'getResumen') {
        logger.info({ url, items: json?.data?.length }, 'getResumen capturado');
        resumenData = json;
      }
      if (endpoint === 'getDetalleVenta' || endpoint === 'getDetalleCompra') {
        logger.info({ url, items: json?.data?.length }, 'getDetalle* capturado');
        detalleData.push({ operacion: endpoint === 'getDetalleVenta' ? 'VENTA' : 'COMPRA', data: json });
      }
    } catch { /* ignorar */ }
  });

  const page = await context.newPage();

  try {
    // ── 1. Navegar al RCV → redirige al login ───────────────────────────────
    logger.info('Navegando al portal RCV...');
    await page.goto(SII.RCV_URL, { waitUntil: 'domcontentloaded', timeout: SII.NAV_TIMEOUT });
    await page.waitForTimeout(1500);

    // ── 2. Login ─────────────────────────────────────────────────────────────
    const urlActual = page.url();
    if (urlActual.includes('AUT2000') || urlActual.includes('zeusr') || urlActual.includes('IngresoRutClave')) {
      logger.info('Formulario de login detectado');

      if (await detectarCaptcha(page)) {
        throw Object.assign(new Error('CAPTCHA'), {
          code   : 'CAPTCHA',
          mensaje: 'El SII requiere captcha. Use "Importar CSV" con el archivo descargado manualmente.',
        });
      }

      await page.waitForSelector('#rutcntr', { timeout: SII.TIMEOUT_MS });
      await page.fill('#rutcntr', rutLogin);
      await page.fill('#clave',   clave);

      await page.evaluate(() => {
        try { if (typeof ejecuta_opcion === 'function') return ejecuta_opcion(); }
        catch { /* ignorar */ }
        const form = document.getElementById('myform') || document.querySelector('form');
        if (form) form.submit();
      });

      await page.waitForFunction(
        () => !location.href.includes('AUT2000') && !location.href.includes('IngresoRutClave'),
        { timeout: SII.TIMEOUT_MS }
      ).catch(() => {});
      await page.waitForTimeout(2000);

      const urlPostLogin = page.url();
      logger.info({ url: urlPostLogin }, 'URL post-login');

      const contenido = (await page.content()).toLowerCase();
      if (
        contenido.includes('clave incorrecta') ||
        contenido.includes('error de autenticacion') ||
        contenido.includes('no fue posible autenticar') ||
        urlPostLogin.includes('IngresoRutClave')
      ) {
        throw Object.assign(new Error('CREDENCIALES_INVALIDAS'), {
          code   : 'CREDENCIALES_INVALIDAS',
          mensaje: 'RUT o clave tributaria incorrectos. Verifique sus credenciales en sii.cl.',
        });
      }
    }

    // ── 3. Cargar portal RCV y esperar el formulario ─────────────────────────
    logger.info('Cargando portal RCV...');
    await page.goto(SII.RCV_URL, { waitUntil: 'networkidle', timeout: SII.NAV_TIMEOUT });
    await page.waitForTimeout(3000);

    // Esperar el selector de mes (confirma que el portal cargó)
    await page.waitForSelector('#periodoMes', { timeout: SII.TIMEOUT_MS });

    // ── 4. Seleccionar período con selectOption (AngularJS) ──────────────────
    logger.info({ mes, anio }, 'Seleccionando período');
    await page.selectOption('#periodoMes', mes.padStart(2, '0'));  // "05"
    await page.waitForTimeout(300);

    // El select de año es el tercer <select> de la página
    const selects = await page.$$('select');
    if (selects.length >= 3) {
      await selects[2].selectOption(anio);
    } else {
      logger.warn({ count: selects.length }, 'No se encontró el select de año');
    }
    await page.waitForTimeout(300);

    // Verificar que los valores quedaron bien
    const valMes = await page.$eval('#periodoMes', el => el.value);
    logger.info({ valMes, anio }, 'Período seleccionado');

    // ── 5. Hacer clic en "Consultar" (dispara getResumen COMPRA por defecto) ─
    logger.info('Clickeando Consultar...');
    await page.click('button:has-text("Consultar")');
    await page.waitForTimeout(5000);   // Esperar respuesta del servidor

    // ── 6. Si queremos VENTA, hacer clic en el tab VENTA ─────────────────────
    if (operacion === 'VENTA') {
      logger.info('Navegando al tab VENTA...');
      const ventaClicked = await page.evaluate(() => {
        const a = Array.from(document.querySelectorAll('a')).find(el => el.textContent?.trim() === 'VENTA');
        if (a) { a.click(); return true; }
        return false;
      });
      if (ventaClicked) {
        await page.waitForTimeout(5000);
        logger.info('Tab VENTA activado');
      } else {
        logger.warn('No se encontró el tab VENTA');
      }
    }

    // Ahora resumenData debería tener datos
    logger.info({ tieneResumen: !!resumenData, items: resumenData?.data?.length }, 'Estado tras consultar');

    // ── 7. Para cada tipo con rsmnLink=true, hacer clic para ver el detalle ──
    if (resumenData?.data) {
      const tiposConLink = resumenData.data.filter(t => t.rsmnLink === true);
      logger.info({ count: tiposConLink.length }, `Tipos con detalle disponible`);

      for (const tipo of tiposConLink) {
        const codTipo = String(tipo.rsmnTipoDocInteger);
        logger.info({ tipo: codTipo, nombre: tipo.dcvNombreTipoDoc }, 'Cargando detalle...');

        // Hacer clic en la fila de la tabla para ese tipo
        const clicked = await page.evaluate((cod) => {
          // Buscar link con href #detalle/XX
          const a = document.querySelector(`a[href*="detalle/${cod}"], a[href*="detalle%2F${cod}"]`);
          if (a) { a.click(); return 'link'; }
          // Fallback: buscar por texto en la tabla
          const links = Array.from(document.querySelectorAll('table a, td a'));
          const match = links.find(l => l.href?.includes(`/${cod}`) || l.textContent?.includes(`(${cod})`));
          if (match) { match.click(); return 'table-link'; }
          return 'no-click';
        }, codTipo);

        logger.info({ tipo: codTipo, clicked }, 'Clic en fila detalle');

        if (clicked !== 'no-click') {
          await page.waitForTimeout(4000);

          // Volver al resumen para poder hacer clic en el siguiente tipo
          await page.evaluate((op) => {
            const backLink = Array.from(document.querySelectorAll('a')).find(
              el => el.textContent?.trim() === 'Volver' || el.href?.includes(`#/${op.toLowerCase()}/`)
            );
            if (backLink) backLink.click();
          }, operacion);
          await page.waitForTimeout(2000);
        }
      }
    }

    // ── 8. Construir documentos desde los detalles capturados ─────────────────
    const documentos = parsearDetalles(detalleData, tipoLibro, rutNum, dv);

    const totalMonto = documentos.reduce((s, d) => s + (d.total || 0), 0);
    logger.info({ count: documentos.length, totalMonto }, 'RCV obtenido');

    return {
      success   : true,
      documentos,
      total     : documentos.length,
      totalMonto,
      debug     : `RCV ${tipoLibro} ${periodo}: ${documentos.length} docs, $${totalMonto.toLocaleString('es-CL')}`,
    };

  } finally {
    await browser.close();
  }
}

// ─── Detectar captcha ─────────────────────────────────────────────────────────
async function detectarCaptcha(page) {
  for (const sel of ['.g-recaptcha', '[data-sitekey]', 'iframe[src*="recaptcha"]', '#captcha']) {
    if (await page.isVisible(sel).catch(() => false)) return true;
  }
  return false;
}

// ─── Parsear respuestas de getDetalleVenta / getDetalleCompra ─────────────────
function parsearDetalles(detalleData, tipoLibro, rutEmisorNum, dvEmisor) {
  const docs = [];

  for (const captura of detalleData) {
    const items = captura?.data?.data || [];
    for (const item of items) {
      const tipoCode = String(item.detTipoDoc || 33);
      const rutDoc   = item.detRutDoc ? rutConFormato(item.detRutDoc, item.detDvDoc || '') : '';
      const neto     = parseMonto(item.detMntNeto  || 0);
      const exento   = parseMonto(item.detMntExe   || 0);
      const iva      = parseMonto(item.detMntIVA   || 0);
      const total    = parseMonto(item.detMntTotal || 0);
      if (!total && !neto) continue;   // Omitir filas vacías

      docs.push({
        tipoDoc      : tipoCode,
        tipoDocNombre: TIPO_DTE[tipoCode] || 'factura',
        folio        : parseInt(item.detNroDoc  || 0),
        rut          : rutDoc,
        razonSocial  : item.detRznSoc || '',
        fecha        : item.detFchDoc  || '',   // "DD/MM/YYYY"
        neto,
        exento,
        iva,
        total,
        tipo         : tipoLibro,
      });
    }
  }

  return docs;
}

// ─── Convertir al formato DocumentoTributario del frontend ───────────────────
function convertirADocumentoTributario(docRCV, generateId) {
  const neto  = docRCV.neto  || Math.round(docRCV.total / 1.19);
  const iva   = docRCV.iva   || Math.round(neto * 0.19);
  const total = docRCV.total || neto + iva;

  let fecha = new Date().toISOString();
  if (docRCV.fecha) {
    const s = docRCV.fecha.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [d, m, y] = s.split('/');
      fecha = new Date(`${y}-${m}-${d}`).toISOString();
    } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      fecha = new Date(s).toISOString();
    }
  }

  return {
    id                : generateId(),
    tipo              : docRCV.tipoDocNombre || 'factura',
    numero            : docRCV.folio || 0,
    serie             : '',
    fecha,
    rutCliente        : docRCV.rut,
    razonSocialCliente: docRCV.razonSocial,
    receptor: {
      rut: docRCV.rut, razonSocial: docRCV.razonSocial,
      giro: '', direccion: '', comuna: '', ciudad: '', contacto: '', email: '',
    },
    condicionesPago : docRCV.tipo === 'compras' ? 'credito' : 'contado',
    detalles        : [],
    subtotal        : neto,
    neto,
    descuentoGlobal : 0,
    iva,
    totalExento     : docRCV.exento || 0,
    total,
    estado          : 'emitido',
    libro           : docRCV.tipo === 'compras' ? 'compras' : 'ventas',
  };
}

module.exports = { obtenerRCV, convertirADocumentoTributario };

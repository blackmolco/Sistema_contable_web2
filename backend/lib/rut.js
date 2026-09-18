function validarRut(rut) {
    if (!rut || typeof rut !== 'string') return false;

    const limpio = rut.replace(/[.\s\-]/g, '').toUpperCase();

    if (!/^[\dkK]$/.test(limpio.slice(-1))) return false;

    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);

    if (!/^\d{7,8}$/.test(cuerpo)) return false;

    let suma = 0;
    let multiplo = 2;

    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += parseInt(cuerpo[i], 10) * multiplo;
        multiplo = multiplo < 7 ? multiplo + 1 : 2;
    }

    const dvEsperado = 11 - (suma % 11);
    let dvCalculado;

    if (dvEsperado === 11) {
        dvCalculado = '0';
    } else if (dvEsperado === 10) {
        dvCalculado = 'K';
    } else {
        dvCalculado = dvEsperado.toString();
    }

    return dv === dvCalculado;
}

// Clave de comparacion: sin puntos, espacios ni guion, en mayuscula. Dos
// entradas del mismo RUT escritas distinto ("12.345.678-9", "12345678-9",
// "12.345.678 9") deben resolver al mismo registro.
function normalizarRut(rut) {
    if (!rut || typeof rut !== 'string') return '';
    return rut.replace(/[.\s-]/g, '').toUpperCase();
}

function formatearRut(rut) {
    const limpio = rut.replace(/[.\s\-]/g, '').toUpperCase();
    if (!validarRut(limpio)) return rut;

    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `${cuerpoFormateado}-${dv}`;
}

module.exports = { validarRut, formatearRut, normalizarRut };

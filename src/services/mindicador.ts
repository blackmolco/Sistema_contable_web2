export interface IndicadorData {
  codigo: string;
  nombre: string;
  unidad_medida: string;
  fecha: string;
  valor: number;
}

export interface MindicadorResponse {
  version: string;
  autor: string;
  fecha: string;
  uf: IndicadorData;
  ivp: IndicadorData;
  dolar: IndicadorData;
  dolar_intercambio: IndicadorData;
  euro: IndicadorData;
  ipc: IndicadorData;
  utm: IndicadorData;
  imacec: IndicadorData;
  tpm: IndicadorData;
  libra_cobre: IndicadorData;
  tasa_desempleo: IndicadorData;
  bitcoin: IndicadorData;
}

/**
 * Obtiene los indicadores económicos del día desde la API mindicador.cl
 */
export const fetchIndicadores = async (): Promise<MindicadorResponse | null> => {
  try {
    const response = await fetch('https://mindicador.cl/api');
    if (!response.ok) {
      throw new Error('Error al obtener indicadores económicos');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching indicadores:', error);
    return null;
  }
};

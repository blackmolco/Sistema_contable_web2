import { useState, useEffect } from 'react';
import { fetchIndicadores, MindicadorResponse } from '../services/mindicador';

export function useIndicadores() {
  const [indicadores, setIndicadores] = useState<MindicadorResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await fetchIndicadores();
      if (data) {
        setIndicadores(data);
      }
      setLoading(false);
    }
    load();
  }, []);

  return { indicadores, loading };
}

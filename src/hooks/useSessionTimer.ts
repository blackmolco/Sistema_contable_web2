// src/hooks/useSessionTimer.ts
// Decodifica el exp del JWT y devuelve los minutos restantes de sesión,
// actualizado cada minuto. Retorna null si no hay token válido.
import { useEffect, useState } from 'react';
import { getToken } from '../services/apiAuth';

function getMinutosRestantes(): number | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return null;
    const msRestantes = payload.exp * 1000 - Date.now();
    return Math.max(0, Math.floor(msRestantes / 60000));
  } catch {
    return null;
  }
}

export function useSessionTimer(): number | null {
  const [minutos, setMinutos] = useState<number | null>(getMinutosRestantes);

  useEffect(() => {
    const interval = setInterval(() => setMinutos(getMinutosRestantes()), 60_000);
    return () => clearInterval(interval);
  }, []);

  return minutos;
}

export default useSessionTimer;

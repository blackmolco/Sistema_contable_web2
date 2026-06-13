import { useEffect, useRef, useState } from "react";

interface UseCountUpOptions {
  start?: number;
  end: number;
  duration?: number;   // ms
  decimals?: number;
  enabled?: boolean;
}

/** Anima un número desde start hasta end durante duration ms */
export function useCountUp({ start = 0, end, duration = 900, decimals = 0, enabled = true }: UseCountUpOptions) {
  const [value, setValue] = useState(enabled ? start : end);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) { setValue(end); return; }
    // Reiniciar si cambia el valor final
    startTimeRef.current = 0;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = time - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const current = start + (end - start) * easeOut(progress);
      setValue(parseFloat(current.toFixed(decimals)));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [end, start, duration, decimals, enabled]);

  return value;
}

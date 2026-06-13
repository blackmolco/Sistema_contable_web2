import React from 'react';
import { formatCLP, formatCLPContable } from '../../utils/formatoMoneda';

interface MontoProps {
  value: number;
  /** Si es true, los negativos se muestran entre paréntesis y en rojo */
  contable?: boolean;
  className?: string;
}

/** Monto en CLP con tabular-nums, alineado a la derecha. */
export function Monto({ value, contable = false, className = '' }: MontoProps) {
  if (contable) {
    const { texto, esNegativo } = formatCLPContable(value);
    return (
      <span className={`tnum text-right ${esNegativo ? 'text-red-600 dark:text-red-400' : ''} ${className}`}>
        {texto}
      </span>
    );
  }
  return <span className={`tnum text-right ${className}`}>{formatCLP(value)}</span>;
}

export default Monto;

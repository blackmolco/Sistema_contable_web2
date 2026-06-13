import React, { ReactNode, ButtonHTMLAttributes } from 'react';
import { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { useCountUp } from '../../hooks/useCountUp';
import { Sparkline } from './Sparkline';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  loading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg ' +
    'transition-all duration-150 active:scale-[0.98] disabled:active:scale-100 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: 'bg-primary text-white hover:bg-primary/90 active:bg-primary/80 shadow-sm hover:shadow-md focus:ring-primary/30',
    secondary: 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 focus:ring-gray-300/30',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm hover:shadow-md focus:ring-red-500/30',
    ghost: 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 focus:ring-gray-300/30',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
  };

  return (
    <button
      className={clsx(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

/** Extrae el valor numérico de un string como "$1.234.567" o "42%" */
function parseNumericValue(str: string): number {
  const cleaned = str.replace(/[^0-9,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/** Detecta si el valor contiene un prefijo de moneda */
function detectPrefix(str: string): string {
  if (str.startsWith('$')) return '$';
  if (str.startsWith('UF')) return 'UF ';
  if (str.startsWith('USD')) return 'USD ';
  return '';
}

/** Detecta si hay sufijo (%) */
function detectSuffix(str: string): string {
  if (str.endsWith('%')) return '%';
  return '';
}

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  /** Datos para mini sparkline (últimos 6-12 períodos) */
  sparklineData?: number[];
  /** Anima el número al montar con useCountUp */
  animateValue?: boolean;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  sparklineData,
  animateValue = false,
}: KPICardProps) {
  const gradientMap: Record<string, string> = {
    default: 'kpi-gradient-blue',
    success: 'kpi-gradient-green',
    warning: 'kpi-gradient-amber',
    danger: 'kpi-gradient-red',
    info: 'kpi-gradient-blue',
    purple: 'kpi-gradient-purple',
  };

  const iconColorMap: Record<string, string> = {
    default: 'text-blue-600 dark:text-blue-400',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-red-600 dark:text-red-400',
    info: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
  };

  const numericEnd = parseNumericValue(value);
  const prefix = detectPrefix(value);
  const suffix = detectSuffix(value);
  const hasMeaningfulNumber = animateValue && numericEnd !== 0;

  // useCountUp siempre se llama (regla de hooks), pero enabled controla si anima
  const animated = useCountUp({
    end: numericEnd,
    duration: 900,
    decimals: numericEnd % 1 !== 0 ? 2 : 0,
    enabled: hasMeaningfulNumber,
  });

  const displayValue = hasMeaningfulNumber
    ? `${prefix}${animated.toLocaleString('es-CL')}${suffix}`
    : (value || '$0');

  return (
    <div className={`card-modern p-5 ${gradientMap[variant]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1 truncate">{title}</p>
          <p className={`cc-kpi-value text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1 tracking-tight tnum ${hasMeaningfulNumber ? 'tabular-nums' : ''}`}>
            {displayValue}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={`text-sm font-semibold ${
                  trend.value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}
              >
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`icon-circle flex-shrink-0 ${iconColorMap[variant]}`}>
          <Icon size={20} />
        </div>
      </div>

      {/* Mini sparkline */}
      {sparklineData && sparklineData.length >= 3 && (
        <div className="mt-3 -mx-1">
          <Sparkline data={sparklineData} height={36} showTooltip={false} />
        </div>
      )}
    </div>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className = '', title, action, padding = 'md' }: CardProps) {
  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  };

  return (
    <div className={`card-modern ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          {title && <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={paddingStyles[padding]}>{children}</div>
    </div>
  );
}

interface DataTableProps<T> {
  columns: Array<{
    key: string;
    header: string;
    render?: (item: T) => ReactNode;
    className?: string;
  }>;
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No hay datos disponibles',
  emptyIcon,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200/60 dark:border-gray-800/60 bg-white dark:bg-gray-900">
      <table className="w-full table-modern">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider
                  ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-16 text-center">
                <div className="flex flex-col items-center gap-3">
                  {emptyIcon || (
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                    </div>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={`transition-colors duration-150 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 ${
                  index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/30 dark:bg-gray-900/30'
                } ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-sm text-gray-700 dark:text-gray-300 ${col.className || ''}`}>
                    {col.render ? col.render(item) : (item as Record<string, unknown>)[col.key] as ReactNode}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  dot?: boolean;
  dotPulse?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Badge({ children, variant = 'default', size = 'sm', dot = false, dotPulse = false, className = '', style }: BadgeProps) {
  const variantClasses: Record<string, string> = {
    default: 'badge-neutral',
    success: 'badge-success',
    warning: 'badge-warning',
    danger: 'badge-danger',
    info: 'badge-info',
  };

  const dotColorClasses: Record<string, string> = {
    default: 'badge-dot bg-gray-400',
    success: 'badge-dot-success',
    warning: 'badge-dot-warning',
    danger: 'badge-dot-danger',
    info: 'badge-dot-info',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      style={style}
    >
      {dot && <span className={`${dotColorClasses[variant]} ${dotPulse ? 'badge-dot-pulse' : ''}`} />}
      {children}
    </span>
  );
}

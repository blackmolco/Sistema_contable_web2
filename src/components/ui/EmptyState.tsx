import React from 'react';
import { LucideIcon } from 'lucide-react';

export type EmptyStateType =
  | 'accounting'
  | 'documents'
  | 'users'
  | 'search'
  | 'invoice'
  | 'chart'
  | 'generic';

// ── SVG illustrations ───────────────────────────────────────────────────────
const SVG_ACCOUNTING = (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    <rect x="10" y="12" width="60" height="56" rx="4" fill="#EFF6FF" stroke="#BFDBFE" strokeWidth="1.5"/>
    <rect x="18" y="22" width="18" height="4" rx="2" fill="#93C5FD"/>
    <rect x="18" y="30" width="14" height="4" rx="2" fill="#BFDBFE"/>
    <rect x="18" y="38" width="16" height="4" rx="2" fill="#BFDBFE"/>
    <rect x="44" y="22" width="18" height="4" rx="2" fill="#93C5FD"/>
    <rect x="44" y="30" width="14" height="4" rx="2" fill="#BFDBFE"/>
    <rect x="44" y="38" width="16" height="4" rx="2" fill="#BFDBFE"/>
    <rect x="18" y="50" width="44" height="2" rx="1" fill="#DBEAFE"/>
    <rect x="18" y="56" width="30" height="2" rx="1" fill="#DBEAFE"/>
    <circle cx="62" cy="58" r="10" fill="#3B82F6"/>
    <path d="M57 58l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SVG_DOCUMENTS = (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    <rect x="16" y="8" width="44" height="56" rx="4" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="1.5"/>
    <rect x="24" y="20" width="24" height="3" rx="1.5" fill="#86EFAC"/>
    <rect x="24" y="28" width="32" height="3" rx="1.5" fill="#BBF7D0"/>
    <rect x="24" y="35" width="28" height="3" rx="1.5" fill="#BBF7D0"/>
    <rect x="24" y="42" width="20" height="3" rx="1.5" fill="#BBF7D0"/>
    <path d="M50 4l14 14H50V4z" fill="#D1FAE5" stroke="#86EFAC" strokeWidth="1.5"/>
    <circle cx="60" cy="60" r="10" fill="#10B981"/>
    <path d="M55 60h10M60 55v10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const SVG_USERS = (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    <circle cx="32" cy="28" r="12" fill="#FEF3C7" stroke="#FDE68A" strokeWidth="1.5"/>
    <path d="M32 22a6 6 0 1 1 0 12 6 6 0 0 1 0-12z" fill="#FCD34D"/>
    <path d="M14 56c0-9.94 8.06-18 18-18s18 8.06 18 18" stroke="#FDE68A" strokeWidth="1.5" fill="#FEF9EE"/>
    <circle cx="54" cy="34" r="8" fill="#FEF3C7" stroke="#FDE68A" strokeWidth="1.5"/>
    <path d="M44 56c0-6.627 4.477-12 10-12s10 5.373 10 12" stroke="#FDE68A" strokeWidth="1.5"/>
    <circle cx="60" cy="62" r="9" fill="#F59E0B"/>
    <path d="M56 62l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SVG_SEARCH = (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    <circle cx="35" cy="35" r="20" fill="#F5F3FF" stroke="#DDD6FE" strokeWidth="1.5"/>
    <circle cx="35" cy="35" r="12" fill="#EDE9FE" stroke="#C4B5FD" strokeWidth="1.5"/>
    <path d="M51 51l12 12" stroke="#7C3AED" strokeWidth="3" strokeLinecap="round"/>
    <path d="M30 35h10M35 30v10" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const SVG_INVOICE = (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    <rect x="12" y="10" width="44" height="58" rx="4" fill="#FFF7ED" stroke="#FED7AA" strokeWidth="1.5"/>
    <rect x="20" y="20" width="28" height="4" rx="2" fill="#FDBA74"/>
    <rect x="20" y="28" width="20" height="3" rx="1.5" fill="#FED7AA"/>
    <rect x="20" y="38" width="28" height="2" rx="1" fill="#FEF3C7"/>
    <rect x="20" y="44" width="28" height="2" rx="1" fill="#FEF3C7"/>
    <rect x="20" y="50" width="28" height="2" rx="1" fill="#FEF3C7"/>
    <rect x="20" y="58" width="18" height="3" rx="1.5" fill="#FDBA74"/>
    <circle cx="62" cy="60" r="10" fill="#F97316"/>
    <path d="M62 55v4l3 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const SVG_CHART = (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    <rect x="8" y="8" width="64" height="64" rx="6" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="1.5"/>
    <rect x="18" y="44" width="8" height="18" rx="2" fill="#34D399"/>
    <rect x="30" y="34" width="8" height="28" rx="2" fill="#10B981"/>
    <rect x="42" y="24" width="8" height="38" rx="2" fill="#059669"/>
    <rect x="54" y="38" width="8" height="24" rx="2" fill="#34D399"/>
    <path d="M18 40 L30 30 L42 20 L54 34" stroke="#065F46" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <circle cx="18" cy="40" r="3" fill="#065F46"/>
    <circle cx="30" cy="30" r="3" fill="#065F46"/>
    <circle cx="42" cy="20" r="3" fill="#065F46"/>
    <circle cx="54" cy="34" r="3" fill="#065F46"/>
  </svg>
);

const SVG_GENERIC = (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    <rect x="10" y="10" width="60" height="60" rx="8" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1.5"/>
    <path d="M40 28v12M40 48v4" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="40" cy="40" r="22" stroke="#CBD5E1" strokeWidth="1.5" fill="none"/>
  </svg>
);

const ILLUSTRATIONS: Record<EmptyStateType, JSX.Element> = {
  accounting: SVG_ACCOUNTING,
  documents:  SVG_DOCUMENTS,
  users:      SVG_USERS,
  search:     SVG_SEARCH,
  invoice:    SVG_INVOICE,
  chart:      SVG_CHART,
  generic:    SVG_GENERIC,
};

// ────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: LucideIcon;
  /** Tipo de ilustración SVG temática */
  type?: EmptyStateType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, type, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 ${className}`}>
      {/* SVG illustration */}
      {type && !Icon && (
        <div className="mb-4 select-none pointer-events-none">
          {ILLUSTRATIONS[type]}
        </div>
      )}

      {/* Lucide icon fallback */}
      {Icon && !type && (
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <Icon size={32} className="text-gray-400 dark:text-gray-500" />
        </div>
      )}

      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm mb-4">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="btn-primary"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

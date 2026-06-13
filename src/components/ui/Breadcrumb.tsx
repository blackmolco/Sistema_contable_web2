import React from "react";
import { ChevronRight, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  const navigate = useNavigate();
  return (
    <nav aria-label="breadcrumb" className={`flex items-center gap-1.5 text-sm ${className}`}>
      <button
        onClick={() => navigate("/")}
        className="flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Dashboard"
      >
        <Home size={13} />
      </button>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <ChevronRight size={13} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
          {item.path && i < items.length - 1 ? (
            <button
              onClick={() => navigate(item.path!)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors truncate max-w-[160px]"
            >
              {item.label}
            </button>
          ) : (
            <span className="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[200px]">
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

import React, { ReactNode } from "react";

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  subtitle?: string;
  detail?: string;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  icon?: ReactNode;
}

interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

const DOT_COLORS: Record<string, string> = {
  default: "bg-gray-400 dark:bg-gray-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger:  "bg-red-500",
  info:    "bg-blue-500",
};

const BADGE_COLORS: Record<string, string> = {
  default: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  danger:  "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  info:    "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export function Timeline({ events, className = "" }: TimelineProps) {
  if (events.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-gray-400">
        Sin eventos en el timeline
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Línea vertical */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-800" />

      <div className="space-y-0">
        {events.map((event, i) => {
          const variant = event.variant ?? "default";
          return (
            <div key={event.id} className="relative flex gap-4 pb-5 animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
              {/* Dot */}
              <div className="relative z-10 flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-950 ${DOT_COLORS[variant]}`}>
                  {event.icon ? (
                    <span className="text-white w-3.5 h-3.5">{event.icon}</span>
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-white opacity-80" />
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {event.title}
                    </p>
                    {event.subtitle && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{event.subtitle}</p>
                    )}
                    {event.detail && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">{event.detail}</p>
                    )}
                  </div>
                  <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_COLORS[variant]}`}>
                    {event.date}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

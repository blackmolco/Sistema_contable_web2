import React, { useState, useRef, useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  delay?: number;
  placement?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({ content, children, delay = 400, placement = "top", className = "" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const show = () => {
    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      const gap = 8;
      let top = 0, left = 0;
      switch (placement) {
        case "top":    top = r.top - gap + window.scrollY;  left = r.left + r.width / 2 + window.scrollX; break;
        case "bottom": top = r.bottom + gap + window.scrollY; left = r.left + r.width / 2 + window.scrollX; break;
        case "left":   top = r.top + r.height / 2 + window.scrollY; left = r.left - gap + window.scrollX; break;
        case "right":  top = r.top + r.height / 2 + window.scrollY; left = r.right + gap + window.scrollX; break;
      }
      setPos({ top, left });
      setVisible(true);
    }, delay);
  };

  const hide = () => {
    clearTimeout(timerRef.current);
    setVisible(false);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const transformMap = {
    top:    "translateX(-50%) translateY(-100%)",
    bottom: "translateX(-50%)",
    left:   "translateX(-100%) translateY(-50%)",
    right:  "translateY(-50%)",
  };

  return (
    <>
      <span ref={triggerRef} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} className={`inline-flex ${className}`}>
        {children}
      </span>
      {visible && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ top: pos.top, left: pos.left, transform: transformMap[placement] }}
        >
          <div className="px-2.5 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap max-w-xs animate-fade-in">
            {content}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

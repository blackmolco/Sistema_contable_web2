import React, { ReactNode, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionState, setTransitionState] = useState<"idle" | "out" | "in">("idle");
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname === prevPathRef.current) return;
    prevPathRef.current = location.pathname;

    setTransitionState("out");
    const t1 = setTimeout(() => {
      setDisplayChildren(children);
      setTransitionState("in");
    }, 60);
    const t2 = setTimeout(() => setTransitionState("idle"), 250);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [location.pathname, children]);

  // Sincronizar children cuando estamos idle
  useEffect(() => {
    if (transitionState === "idle") setDisplayChildren(children);
  }, [children, transitionState]);

  const cls =
    transitionState === "out" ? "opacity-0 translate-y-1 transition-all duration-75" :
    transitionState === "in"  ? "opacity-0 translate-y-2 animate-page-in" :
    "";

  return <div className={cls}>{displayChildren}</div>;
}

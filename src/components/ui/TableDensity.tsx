import React, { createContext, useContext, useState, ReactNode } from "react";

type Density = "compact" | "normal" | "spacious";

interface DensityContextType {
  density: Density;
  setDensity: (d: Density) => void;
  rowClass: string;
}

const DensityContext = createContext<DensityContextType>({
  density: "normal",
  setDensity: () => {},
  rowClass: "py-3",
});

const ROW_PADDING: Record<Density, string> = {
  compact:  "py-1.5",
  normal:   "py-3",
  spacious: "py-4",
};

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<Density>(() => {
    return (localStorage.getItem("scc_table_density") as Density) ?? "normal";
  });

  const setDensity = (d: Density) => {
    setDensityState(d);
    localStorage.setItem("scc_table_density", d);
  };

  return (
    <DensityContext.Provider value={{ density, setDensity, rowClass: ROW_PADDING[density] }}>
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity() {
  return useContext(DensityContext);
}

interface DensityToggleProps {
  className?: string;
}

export function DensityToggle({ className = "" }: DensityToggleProps) {
  const { density, setDensity } = useDensity();
  const options: { value: Density; label: string; icon: string }[] = [
    { value: "compact",  label: "Compacta",   icon: "≡" },
    { value: "normal",   label: "Normal",     icon: "☰" },
    { value: "spacious", label: "Espaciada",  icon: "⊟" },
  ];
  return (
    <div className={`flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 ${className}`}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => setDensity(o.value)}
          title={o.label}
          className={`px-2.5 py-1.5 text-sm rounded-md transition-colors font-mono ${
            density === o.value
              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}

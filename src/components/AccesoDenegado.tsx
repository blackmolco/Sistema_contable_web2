import { ShieldAlert } from 'lucide-react';

// Se muestra cuando el usuario entra a una URL de un modulo que tiene
// bloqueado por permiso puntual (ej. Remuneraciones) — no solo se oculta del
// menu, tambien se bloquea la ruta directa. El backend igual rechaza
// cualquier llamada a la API con 403; esto es la pantalla equivalente.
export default function AccesoDenegado({ modulo }: { modulo: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <ShieldAlert size={48} className="text-red-400" />
      <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">No tiene acceso a {modulo}</p>
      <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
        Su usuario no tiene permiso para ver este módulo. Si cree que es un error, contacte al administrador de su empresa.
      </p>
    </div>
  );
}

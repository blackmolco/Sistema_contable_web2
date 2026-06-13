// src/components/SessionExpiredModal.tsx
// Modal que aparece cuando la sesión expira (refresh de token fallido).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onSessionExpired } from '../services/httpClient';
import { clearSession } from '../services/apiAuth';

export default function SessionExpiredModal() {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onSessionExpired(() => setVisible(true));
    return unsubscribe;
  }, []);

  if (!visible) return null;

  const irAlLogin = () => {
    clearSession();
    setVisible(false);
    navigate('/login');
    // La app muestra el Login cuando no hay sesión; forzar recarga garantiza estado limpio
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Sesión expirada</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Tu sesión ha caducado por seguridad. Vuelve a iniciar sesión para continuar.
        </p>
        <button
          onClick={irAlLogin}
          className="w-full py-2.5 bg-[#1E3A5F] text-white rounded-xl font-semibold hover:bg-[#2D5A87] transition-colors"
        >
          Ir al login
        </button>
      </div>
    </div>
  );
}

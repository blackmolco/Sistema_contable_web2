import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import './index.css'
import App from './App.tsx'
import { initIDBSync } from './services/idbSync'
import { queryClient } from './lib/queryClient'

// Inicializar sincronización IndexedDB en background (no bloquea el render)
initIDBSync();

// Tras cada deploy, los archivos JS de la build anterior dejan de existir en
// el servidor. Una pestaña que ya estaba abierta, al navegar a una pagina
// que todavia no habia cargado (lazy import), pide ese chunk viejo y falla
// con "Failed to fetch dynamically imported module" — eso es lo que se veia
// como un error atascado en cualquier pantalla a la que se navegara. Vite
// dispara este evento especificamente para ese caso; una recarga completa
// trae la build nueva. El guard en sessionStorage evita un bucle si el
// deploy mismo esta roto (recarga como maximo una vez por sesion de pestaña).
window.addEventListener('vite:preloadError', () => {
  const yaRecargo = sessionStorage.getItem('scc_reload_por_chunk_viejo');
  if (yaRecargo) return;
  sessionStorage.setItem('scc_reload_por_chunk_viejo', '1');
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
)

// Si esta carga quedo estable unos segundos, se limpia el guard: un deploy
// *futuro* en esta misma pestaña (dejada abierta dias) tambien debe poder
// disparar su propia recarga automatica, no solo la primera vez.
window.setTimeout(() => sessionStorage.removeItem('scc_reload_por_chunk_viejo'), 5000);

'use client';

import { useEffect } from 'react';

// Último recurso: si falla hasta el armado general de la app, se muestra esto (en castellano) en vez de la pantalla en inglés.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  const code = `E-${(error.digest ?? 'CLIENTE').slice(0, 12).toUpperCase()}`;
  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#E9ECEA', color: '#121A19', margin: 0 }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
          <div role="alert" style={{ maxWidth: 360, background: '#fff', borderRadius: 16, padding: 24, textAlign: 'center' }}>
            <h1 style={{ fontSize: 20, margin: 0 }}>Algo salió mal</h1>
            <p style={{ fontSize: 14, color: '#555' }}>No se perdió nada de lo que tenías guardado. Probá de nuevo en un momento.</p>
            <p style={{ fontFamily: 'monospace', background: '#f2f2f2', borderRadius: 8, padding: '6px 10px' }}>Código: {code}</p>
            <button type="button" onClick={() => retry()} style={{ marginTop: 8, padding: '10px 16px', borderRadius: 12, border: 0, background: '#1E4D44', color: '#fff', fontWeight: 600 }}>Probar de nuevo</button>
          </div>
        </main>
      </body>
    </html>
  );
}

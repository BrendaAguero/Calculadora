'use client';

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next';

// Vercel Web Analytics: cuenta visitas por página, sin cookies ni datos personales.
// Por privacidad se borra todo lo que va después de «?» o «#» (a veces hay mensajes o emails)
// y no se mide la administración ni el ingreso del equipo.
function clean(event: BeforeSendEvent): BeforeSendEvent | null {
  try {
    const url = new URL(event.url);
    if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/equipo-ingreso') || url.pathname.startsWith('/moderacion')) return null;
    url.search = '';
    url.hash = '';
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
}

export function WebAnalytics() {
  return <Analytics beforeSend={clean} />;
}

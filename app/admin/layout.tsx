import { requireAdmin } from '@/lib/admin';

export const metadata = { robots: { index: false, follow: false } };

// Toda la administración pide ser administradora y haber entrado por el ingreso del equipo.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}

import { createAdminClient } from '@/lib/supabase/admin';
import { SignUpForm } from './signup-form';

export const metadata = { title: 'Probá gratis · Calculadora Emprender', description: 'Creá tu cuenta gratis de Calculadora Emprender: calculá materiales, costos y precios de tus piezas de yeso, resina, Jesmonite y cemento.' };

// Si se llenó el tope de cuentas gratis, la página ofrece crear la cuenta para contratar Personal Plus.
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const admin = createAdminClient();
  const status = admin ? ((await admin.rpc('free_accounts_status')).data as { open?: boolean } | null) : null;
  const full = status?.open === false;
  return <SignUpForm forPlus={full || plan === 'plus'} freeFull={full} />;
}

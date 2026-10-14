'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DEVICE_LIMIT_MESSAGE, registerCurrentDevice } from '@/lib/devices';
import { allowAttempt, TOO_MANY } from '@/lib/rate-limit';
import { openStaffSession } from '@/lib/staff';

export type StaffState = { error?: string };

const WRONG = 'Email o contraseña incorrectos.';
const safeNext = (value: string) => (/^\/(admin|moderacion|comunidad)(\/[\w\-/?=&%]*)?$/.test(value) ? value : '');

// Ingreso del equipo: email + contraseña, y solo para administradoras y moderadoras.
// A cualquier otra cuenta le responde lo mismo que a una contraseña equivocada (no confirma que esto exista).
export async function staffSignIn(_prev: StaffState, formData: FormData): Promise<StaffState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Ingresá tu email y contraseña.' };
  if (!(await allowAttempt('staff-login', 5, 900, email)) || !(await allowAttempt('staff-login-ip', 20, 900))) return { error: TOO_MANY };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: WRONG };
  const [{ data: isModerator }, { data: isAdmin }] = await Promise.all([supabase.rpc('is_moderator'), supabase.rpc('is_admin')]);
  if (!isModerator) {
    await supabase.auth.signOut({ scope: 'local' });
    return { error: WRONG };
  }
  if (!(await registerCurrentDevice())) return { error: DEVICE_LIMIT_MESSAGE };
  await openStaffSession(data.user.id);
  redirect(safeNext(String(formData.get('next') ?? '')) || (isAdmin ? '/admin' : '/moderacion'));
}

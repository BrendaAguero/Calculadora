'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { DEVICE_LIMIT_MESSAGE, registerCurrentDevice } from '@/lib/devices';
import { isLeakedPassword, weakPasswordReason } from '@/lib/password';
import { allowAttempt, TOO_MANY } from '@/lib/rate-limit';

export type SignUpState = { error?: string; email?: string };

// Registro para la versión gratis: email y contraseña, al instante y sin mandar correos.
// La cuenta se crea desde el servidor ya confirmada y queda abierta en este aparato.
export async function signUpFree(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('full_name') ?? '').trim().slice(0, 80);
  const password = String(formData.get('password') ?? '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return { error: 'Revisá que el email esté bien escrito.', email };
  if (formData.get('terms_accepted') !== 'on') return { error: 'Tenés que aceptar los términos para continuar.', email };
  if (password.length < 8) return { error: 'La contraseña tiene que tener al menos 8 caracteres.', email };
  if (password !== String(formData.get('password_confirmation') ?? '')) return { error: 'Las contraseñas no coinciden.', email };
  if (!(await allowAttempt('registro', 3, 3600, email)) || !(await allowAttempt('registro-ip', 10, 3600))) return { error: TOO_MANY, email };
  const weak = weakPasswordReason(password, email);
  if (weak) return { error: weak, email };
  if (await isLeakedPassword(password)) return { error: 'Esa contraseña apareció en filtraciones de otros sitios. Elegí otra que no uses en ningún otro lado.', email };

  const admin = createAdminClient();
  if (!admin) return { error: 'El registro no está disponible en este momento. Probá más tarde.', email };
  const created = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { terms_accepted: 'true', password_set: true, ...(fullName ? { full_name: fullName } : {}) },
  });
  if (created.error) {
    if (/already|registered|exists/i.test(created.error.message)) return { error: 'Ya hay una cuenta con ese email. Entrá con tu contraseña o tu clave.', email };
    console.error('[registro] no se pudo crear la cuenta', created.error.message);
    return { error: 'No se pudo crear la cuenta. Probá de nuevo en un rato.', email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'La cuenta se creó, pero no se pudo abrir la sesión. Entrá con tu email y contraseña.', email };
  if (!(await registerCurrentDevice())) return { error: DEVICE_LIMIT_MESSAGE, email };
  redirect('/');
}

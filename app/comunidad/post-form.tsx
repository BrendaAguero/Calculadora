import { PhotoInput } from '@/components/photo-input';
import { SubmitButton } from '@/components/submit-button';
import { CATEGORIES, LIMITS } from '@/lib/community';
import { inputClass, labelClass, primaryButton } from '@/lib/ui';

type Post = { id: string; category: string; title: string; body: string; link: string | null; has_photo: boolean };

// Formulario del equipo para publicar o editar en la Comunidad.
export function PostForm({ action, post, submitLabel }: { action: (formData: FormData) => Promise<void>; post?: Post; submitLabel: string }) {
  return (
    <form action={action} className="grid gap-3">
      {post && <input type="hidden" name="post_id" value={post.id} />}
      <label className={labelClass}>Tema
        <select name="category" defaultValue={post?.category ?? 'consejo'} className={inputClass}>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
        </select>
      </label>
      <label className={labelClass}>Título<input name="title" defaultValue={post?.title} required minLength={3} maxLength={LIMITS.title} placeholder="Ej.: Cómo evitar burbujas en la resina" className={inputClass} /></label>
      <label className={labelClass}>Texto<textarea name="body" defaultValue={post?.body} required maxLength={LIMITS.body} rows={6} placeholder="Contá paso a paso, qué materiales usaste, qué funciona…" className={inputClass} /></label>
      <label className={labelClass}>Enlace a un video (opcional)<input name="link" type="url" defaultValue={post?.link ?? ''} maxLength={LIMITS.link} placeholder="https://www.youtube.com/…" className={inputClass} /></label>
      {post?.has_photo && (
        <label className={labelClass}>Foto
          <select name="photo_action" defaultValue="keep" className={inputClass}><option value="keep">Dejar la foto que tiene</option><option value="replace">Cambiarla o sacarla (usa la de abajo)</option></select>
        </label>
      )}
      <PhotoInput />
      <div><SubmitButton className={primaryButton}>{submitLabel}</SubmitButton></div>
    </form>
  );
}

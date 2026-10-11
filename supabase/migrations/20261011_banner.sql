-- Banner propio de la versión gratis (decisión del 11/10/2026): una imagen o aviso fijo que elige la administración
-- (promoción de Básico/Avanzado o un sponsor). Sin cookies ni anuncios de terceros.
-- Se guarda en content_entries (content_type 'banner', slug 'free'); content = JSON {text, link, button, image}.

create or replace function public.admin_save_banner(p_title text, p_text text, p_link text, p_button text, p_image text, p_active boolean)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_link text := nullif(btrim(coalesce(p_link, '')), '');
  v_image text := nullif(btrim(coalesce(p_image, '')), '');
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if char_length(btrim(coalesce(p_title, ''))) < 2 then raise exception 'Escribí un título.'; end if;
  -- Enlaces e imágenes: solo direcciones seguras (https) o páginas de la app (empiezan con /).
  if v_link is not null and v_link !~ '^(https://|/)' then raise exception 'El enlace tiene que empezar con https:// o con /.'; end if;
  if v_image is not null and v_image !~ '^https://' then raise exception 'La imagen tiene que ser una dirección https://.'; end if;

  insert into content_entries (content_type, slug, title, content, status, updated_by)
  values ('banner', 'free', left(btrim(p_title), 120),
          jsonb_build_object('text', left(btrim(coalesce(p_text, '')), 300), 'link', v_link, 'button', left(btrim(coalesce(p_button, '')), 40), 'image', v_image)::text,
          case when p_active then 'published' else 'draft' end, auth.uid())
  on conflict (content_type, slug) do update
    set title = excluded.title, content = excluded.content, status = excluded.status, updated_by = excluded.updated_by, updated_at = now();
  perform public.log_audit('banner.save', 'content_entry', null, null, jsonb_build_object('title', p_title, 'active', p_active));
end;
$$;

revoke all on function public.admin_save_banner(text, text, text, text, text, boolean) from public, anon;
grant execute on function public.admin_save_banner(text, text, text, text, text, boolean) to authenticated;

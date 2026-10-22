-- Etapa 2: las fotos van al almacenamiento de archivos (Storage) y en la base queda solo una referencia corta
-- («sb:<depósito>/<ruta>»). Las fotos viejas en formato data: siguen siendo válidas.
-- Solo el servidor de la app sube, borra y firma archivos (con la clave de servicio): no hacen falta
-- reglas para el público. «publicas» se ve por dirección pública; «privadas» solo con un enlace firmado.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publicas', 'publicas', true, 400000, array['image/jpeg', 'image/png', 'image/webp']),
       ('privadas', 'privadas', false, 400000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

alter table public.color_recipes drop constraint if exists color_recipes_photo_check;
alter table public.color_recipes add constraint color_recipes_photo_check check (
  photo is null
  or (photo ~ '^data:image/(jpeg|png|webp);base64,' and octet_length(photo) <= 300000)
  or photo ~ '^sb:privadas/[A-Za-z0-9/_.-]{1,200}$');

alter table public.test_logs drop constraint if exists test_logs_photo_check;
alter table public.test_logs add constraint test_logs_photo_check check (
  photo is null
  or (photo ~ '^data:image/(jpeg|png|webp);base64,' and octet_length(photo) <= 300000)
  or photo ~ '^sb:privadas/[A-Za-z0-9/_.-]{1,200}$');

alter table public.community_posts drop constraint if exists community_posts_photo_check;
alter table public.community_posts add constraint community_posts_photo_check check (
  photo is null
  or (photo ~ '^data:image/(jpeg|png|webp);base64,' and char_length(photo) <= 300000)
  or photo ~ '^sb:publicas/[A-Za-z0-9/_.-]{1,200}$');

alter table public.announcements drop constraint if exists announcements_image_check;
alter table public.announcements add constraint announcements_image_check check (
  image is null
  or (image ~ '^data:image/(jpeg|png|webp);base64,' and char_length(image) <= 300000)
  or image ~ '^sb:publicas/[A-Za-z0-9/_.-]{1,200}$');

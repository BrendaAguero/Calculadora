-- Módulos para el taller: Recetas de color, Cuaderno de pruebas y Temporizadores de curado.
-- Se compran como extras de la Edición Personal; la Mensualidad Plus los incluye.

insert into public.modules (code, name, description, price, currency, active) values
  ('COLORES', 'Recetas de color', 'Guardá tus colores con la cantidad de pigmento y repetilos en cualquier cantidad.', 6000, 'ARS', true),
  ('CUADERNO', 'Cuaderno de pruebas', 'Anotá cada colada y cómo salió para repetir lo que funciona.', 5000, 'ARS', true),
  ('TEMPORIZADORES', 'Temporizadores de curado', 'Avisos para desmoldar y curar cada pieza.', 4000, 'ARS', true)
on conflict (code) do update set name = excluded.name, description = excluded.description, active = true;

create or replace function public.sellable_module(p_code text) returns boolean
language sql immutable set search_path to 'public'
as $$ select p_code in ('PACK_VENTAS', 'EXTRA_DEVICE', 'COLORES', 'CUADERNO', 'TEMPORIZADORES') $$;

-- Mismo criterio que hasFeature en la app: administración y cuenta de prueba siempre; si no, Edición Personal
-- activa y (Mensualidad Plus vigente o el módulo comprado).
create or replace function public.has_module(p_code text) returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select auth.uid() is not null and exists (select 1 from profiles where id = auth.uid() and account_status = 'active') and (
    exists (select 1 from profiles where id = auth.uid() and (role = 'admin' or is_tester))
    or (
      exists (select 1 from licenses l join plans p on p.id = l.plan_id where l.user_id = auth.uid() and l.status = 'active' and p.code in ('BASIC', 'ADVANCED'))
      and (
        exists (select 1 from subscriptions s where s.user_id = auth.uid() and s.status = 'active' and s.expires_at > now())
        or exists (select 1 from user_modules um join modules m on m.id = um.module_id where um.user_id = auth.uid() and um.status = 'active' and m.code = p_code)
      )
    )
  );
$$;
revoke all on function public.has_module(text) from public, anon;
grant execute on function public.has_module(text) to authenticated;

-- Fotos: imagen chica (la app la achica antes de guardar), como data URL de hasta ~300 KB.
create table if not exists public.color_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  material text check (material is null or char_length(material) <= 60),
  base_grams numeric not null check (base_grams > 0 and base_grams <= 1000000),
  pigments jsonb not null default '[]'::jsonb check (jsonb_typeof(pigments) = 'array' and jsonb_array_length(pigments) <= 12),
  notes text check (notes is null or char_length(notes) <= 1000),
  photo text check (photo is null or (photo like 'data:image/%' and octet_length(photo) <= 300000)),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists color_recipes_user_idx on public.color_recipes (user_id, created_at desc);
alter table public.color_recipes enable row level security;
create policy color_recipes_select on public.color_recipes for select to authenticated using (user_id = auth.uid());
create policy color_recipes_insert on public.color_recipes for insert to authenticated with check (user_id = auth.uid() and public.has_module('COLORES'));
create policy color_recipes_update on public.color_recipes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_module('COLORES'));
create policy color_recipes_delete on public.color_recipes for delete to authenticated using (user_id = auth.uid());

create table if not exists public.test_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  made_on date not null default current_date,
  title text check (title is null or char_length(title) <= 120),
  material text check (material is null or char_length(material) <= 60),
  mix text check (mix is null or char_length(mix) <= 300),
  color_recipe_id uuid references public.color_recipes(id) on delete set null,
  temperature numeric check (temperature is null or temperature between -20 and 60),
  cure_hours numeric check (cure_hours is null or (cure_hours >= 0 and cure_hours <= 10000)),
  result text not null check (result in ('perfecta', 'buena', 'regular', 'mala')),
  problems text[] not null default '{}' check (cardinality(problems) <= 12),
  notes text check (notes is null or char_length(notes) <= 2000),
  photo text check (photo is null or (photo like 'data:image/%' and octet_length(photo) <= 300000)),
  created_at timestamptz not null default now()
);
create index if not exists test_logs_user_idx on public.test_logs (user_id, made_on desc, created_at desc);
alter table public.test_logs enable row level security;
create policy test_logs_select on public.test_logs for select to authenticated using (user_id = auth.uid());
create policy test_logs_insert on public.test_logs for insert to authenticated with check (
  user_id = auth.uid() and public.has_module('CUADERNO')
  and (color_recipe_id is null or exists (select 1 from public.color_recipes c where c.id = color_recipe_id and c.user_id = auth.uid())));
create policy test_logs_update on public.test_logs for update to authenticated using (user_id = auth.uid()) with check (
  user_id = auth.uid() and public.has_module('CUADERNO')
  and (color_recipe_id is null or exists (select 1 from public.color_recipes c where c.id = color_recipe_id and c.user_id = auth.uid())));
create policy test_logs_delete on public.test_logs for delete to authenticated using (user_id = auth.uid());

create table if not exists public.cure_timers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 160),
  ends_at timestamptz not null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists cure_timers_user_idx on public.cure_timers (user_id, ends_at);
alter table public.cure_timers enable row level security;
create policy cure_timers_select on public.cure_timers for select to authenticated using (user_id = auth.uid());
create policy cure_timers_insert on public.cure_timers for insert to authenticated with check (user_id = auth.uid() and public.has_module('TEMPORIZADORES'));
create policy cure_timers_update on public.cure_timers for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cure_timers_delete on public.cure_timers for delete to authenticated using (user_id = auth.uid());

-- Menú: las secciones del taller aparecen si la persona las usa o tiene el módulo (o Plus).
create or replace function public.my_menu_state() returns jsonb
language sql stable set search_path to 'public'
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'used', jsonb_build_object(
      'produccion', exists (select 1 from productions where user_id = auth.uid()),
      'compras', exists (select 1 from supplier_purchases where user_id = auth.uid()),
      'proveedores', exists (select 1 from suppliers where user_id = auth.uid()),
      'resumen', exists (select 1 from sales where user_id = auth.uid()),
      'lista-precios', exists (select 1 from product_prices pp join products p on p.id = pp.product_id where p.user_id = auth.uid()),
      'revendedora', exists (select 1 from reseller_accounts where user_id = auth.uid()),
      'colores', exists (select 1 from color_recipes where user_id = auth.uid()) or public.has_module('COLORES'),
      'cuaderno', exists (select 1 from test_logs where user_id = auth.uid()) or public.has_module('CUADERNO'),
      'temporizadores', exists (select 1 from cure_timers where user_id = auth.uid()) or public.has_module('TEMPORIZADORES')
    ),
    'choices', coalesce((select menu_sections from user_preferences where user_id = auth.uid()), '{}'::jsonb)
  ) end;
$$;

-- Administración: precio de un módulo vendible.
create or replace function public.admin_set_module_price(p_code text, p_price numeric) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.is_admin() then raise exception 'Solo la administración puede hacer esto.'; end if;
  if not public.sellable_module(p_code) then raise exception 'Ese módulo no se vende.'; end if;
  if not (p_price > 0) then raise exception 'El precio tiene que ser mayor a cero.'; end if;
  update modules set price = p_price, updated_at = now() where code = p_code;
  perform public.log_audit('prices.module', 'module', null, null, jsonb_build_object('code', p_code, 'price', p_price));
end;
$$;
revoke all on function public.admin_set_module_price(text, numeric) from public, anon;
grant execute on function public.admin_set_module_price(text, numeric) to authenticated;

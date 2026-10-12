-- 1) Menú a medida: cada persona ve en el menú solo las secciones que usa (o que eligió ver).
alter table public.user_preferences add column if not exists menu_sections jsonb not null default '{}'::jsonb;

-- Qué secciones ya usó (tiene datos cargados) y qué eligió mostrar u ocultar. SECURITY INVOKER: RLS aplica.
create or replace function public.my_menu_state()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'used', jsonb_build_object(
      'produccion', exists (select 1 from productions where user_id = auth.uid()),
      'compras', exists (select 1 from supplier_purchases where user_id = auth.uid()),
      'proveedores', exists (select 1 from suppliers where user_id = auth.uid()),
      'resumen', exists (select 1 from sales where user_id = auth.uid()),
      'lista-precios', exists (select 1 from product_prices pp join products p on p.id = pp.product_id where p.user_id = auth.uid()),
      'revendedora', exists (select 1 from reseller_accounts where user_id = auth.uid())
    ),
    'choices', coalesce((select menu_sections from user_preferences where user_id = auth.uid()), '{}'::jsonb)
  ) end;
$$;
revoke all on function public.my_menu_state() from public, anon;
grant execute on function public.my_menu_state() to authenticated;

-- 2) Uso de la app sin datos personales: solo cuántas veces se abre cada pantalla por día
--    (sin quién), y si fue con el Modo simple. Solo la administración lo puede leer.
create table if not exists public.usage_daily (
  day date not null,
  path text not null,
  simple boolean not null,
  views integer not null default 0,
  primary key (day, path, simple)
);
alter table public.usage_daily enable row level security;
create policy usage_daily_admin_read on public.usage_daily for select to authenticated using (public.is_admin());

create or replace function public.track_view(p_path text, p_simple boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  if p_path is null or p_path !~ '^/[a-z0-9/:\-]{0,80}$' then return; end if;
  insert into usage_daily (day, path, simple, views)
  values ((now() at time zone 'America/Argentina/Buenos_Aires')::date, p_path, coalesce(p_simple, true), 1)
  on conflict (day, path, simple) do update set views = usage_daily.views + 1;
end;
$$;
revoke all on function public.track_view(text, boolean) from public, anon;
grant execute on function public.track_view(text, boolean) to authenticated;

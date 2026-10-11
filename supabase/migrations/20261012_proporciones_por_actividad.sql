-- Proporciones y precios propios de cada usuaria para las calculadoras de Resina, Jesmonite y Cemento
-- (decisión del 11/10/2026: valores de fábrica editables y cada una guarda los suyos).
create table if not exists public.activity_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_code text not null check (activity_code in ('RESINA', 'JESMONITE', 'CEMENTO_DECORATIVO')),
  settings jsonb not null default '{}'::jsonb check (pg_column_size(settings) < 8192),
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_code)
);
alter table public.activity_settings enable row level security;
create policy activity_settings_select on public.activity_settings for select to authenticated using (user_id = auth.uid());
create policy activity_settings_insert on public.activity_settings for insert to authenticated with check (user_id = auth.uid());
create policy activity_settings_update on public.activity_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.activity_settings to authenticated;

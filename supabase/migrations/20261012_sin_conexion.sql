-- Modo sin conexión (Mensualidad Plus): lo que se carga sin internet se guarda en el aparato y se sube
-- al volver la conexión. Este registro evita que una misma carga se suba dos veces (por ejemplo, si se
-- corta la conexión justo al responder).
create table if not exists public.offline_sync_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  kind text not null check (kind in ('sale', 'yeso_calc', 'mix_calc')),
  created_at timestamptz not null default now(),
  primary key (user_id, client_id)
);
alter table public.offline_sync_log enable row level security;
create policy offline_sync_log_select on public.offline_sync_log for select to authenticated using (user_id = auth.uid());
create policy offline_sync_log_insert on public.offline_sync_log for insert to authenticated with check (user_id = auth.uid());
create policy offline_sync_log_delete on public.offline_sync_log for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on public.offline_sync_log to authenticated;

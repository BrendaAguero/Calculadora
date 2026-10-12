-- Personalización al entrar: qué se ve en Inicio. Null = todavía no eligió (se le muestra el paso de bienvenida).
alter table public.user_preferences add column if not exists home_widgets jsonb;

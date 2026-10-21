-- Etapa 1 de la auditoría: seguridad de la base.

-- 1) Funciones viejas que la app ya no usa: nadie las puede llamar desde afuera (siguen existiendo por si
--    otra función interna las usa; las internas corren con permisos propios).
revoke execute on function public.create_personal_order(text, text) from public, anon, authenticated;
revoke execute on function public.admin_grant_license(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.admin_list_entrepreneur_requests() from public, anon, authenticated;
revoke execute on function public.admin_save_announcement(uuid, text, text, text, text, boolean, text, text, text, timestamp with time zone, timestamp with time zone, boolean) from public, anon, authenticated;
revoke execute on function public.admin_set_reseller_price(numeric) from public, anon, authenticated;
revoke execute on function public.community_add_comment(uuid, text) from public, anon, authenticated;
revoke execute on function public.community_report(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.community_update_post(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.mod_mute_user(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.mod_resolve_report(uuid) from public, anon, authenticated;
revoke execute on function public.mod_set_comment(uuid, text) from public, anon, authenticated;
revoke execute on function public.quote_license_upgrade() from public, anon, authenticated;

-- 2) Comprar: el mensaje ya no confirma si un email es clienta.
create or replace function public.create_personal_order_v2(p_email text, p_full_name text, p_with_pack boolean)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_price numeric;
  v_pack numeric := 0;
  v_pct integer := 0;
  v_id uuid;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Revisá el email.'; end if;
  if exists (select 1 from approved_emails where lower(email) = v_email and status = 'approved') then
    raise exception 'No pudimos crear el pedido con ese email. Si ya compraste antes, entrá con tu clave de acceso; si no, escribinos y lo vemos.';
  end if;
  if (select count(*) from personal_orders where lower(email) = v_email and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Hiciste muchos pedidos hoy. Si tenés un problema, escribinos.';
  end if;
  select value_numeric into v_price from pricing_config where key = 'personal_price_online';
  v_price := coalesce(v_price, 44900);
  select coalesce(max(o.discount_pct), 0) into v_pct from user_offers o join profiles p on p.id = o.user_id
   where lower(p.email) = v_email and o.expires_at > now();
  if v_pct > 0 then v_price := round(v_price * (100 - v_pct) / 100); end if;
  if coalesce(p_with_pack, false) then
    select coalesce((select value_numeric from pricing_config where key = 'pack_ventas_with_personal'), 7000) into v_pack;
  end if;
  insert into personal_orders (email, full_name, total, with_pack, discount_pct)
  values (v_email, nullif(left(btrim(coalesce(p_full_name, '')), 120), ''), v_price + v_pack, coalesce(p_with_pack, false), v_pct)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'total', v_price + v_pack, 'discount_pct', v_pct);
end;
$$;

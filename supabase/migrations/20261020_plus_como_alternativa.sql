-- La Mensualidad Plus pasa a ser OTRA FORMA DE PAGAR (no se suma a la Edición Personal):
-- cualquier cuenta puede tenerla, con todo incluido mientras esté activa.
-- Recetas de color y Cuaderno de pruebas pasan a venir incluidos en la Edición Personal.
-- En la tienda quedan solo los extras específicos: Pack Ventas y Stock, Aparato extra y actividades.

-- 1) Módulos: Plus (con o sin licencia) desbloquea todo; con licencia, el taller viene incluido.
create or replace function public.has_module(p_code text)
returns boolean
language sql stable security definer set search_path to 'public'
as $$
  select auth.uid() is not null and exists (select 1 from profiles where id = auth.uid() and account_status = 'active') and (
    exists (select 1 from profiles where id = auth.uid() and (role = 'admin' or is_tester))
    or exists (select 1 from subscriptions s where s.user_id = auth.uid() and s.status = 'active' and s.expires_at > now())
    or (
      exists (select 1 from licenses l join plans p on p.id = l.plan_id
               where l.user_id = auth.uid() and l.status = 'active' and p.code in ('BASIC', 'ADVANCED')
                 and (l.expires_at is null or l.expires_at > now()))
      and (
        p_code in ('COLORES', 'CUADERNO')
        or exists (select 1 from user_modules um join modules m on m.id = um.module_id where um.user_id = auth.uid() and um.status = 'active' and m.code = p_code)
      )
    )
  );
$$;

-- Ya no se venden sueltos (vienen con la Edición Personal). Quien los haya comprado los conserva.
update public.modules set active = false where code in ('COLORES', 'CUADERNO');

-- 2) Cotizar y activar Plus no exige la Edición Personal (sin licencia, la suscripción usa el plan completo).
create or replace function public.quote_entrepreneur(p_months integer)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_catalog_id uuid;
  v_price numeric;
  v_plan_id uuid;
  v_plan_code text;
  v_age_days int;
  v_recent_days int;
  v_age_pct numeric := 0;
  v_recent_pct numeric := 0;
  v_pct numeric;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Iniciá sesión.');
  end if;

  select c.id, c.price into v_catalog_id, v_price
  from subscription_plans_catalog c
  where c.duration_months = p_months and c.active and c.valid_from <= now() and (c.valid_until is null or c.valid_until > now())
  order by c.valid_from desc limit 1;
  if v_catalog_id is null then
    return jsonb_build_object('ok', false, 'error', 'Ese plazo no está disponible.');
  end if;

  select l.plan_id, p.code into v_plan_id, v_plan_code
  from licenses l join plans p on p.id = l.plan_id
  where l.user_id = v_uid and l.status = 'active' and p.code in ('BASIC', 'ADVANCED')
  order by (p.code = 'ADVANCED') desc limit 1;
  if v_plan_id is null then
    select id, code into v_plan_id, v_plan_code from plans where code = 'ADVANCED';
  end if;

  select floor(extract(epoch from now() - min(coalesce(l.activated_at, l.acquired_at))) / 86400)::int,
         floor(extract(epoch from now() - max(l.acquired_at)) / 86400)::int
    into v_age_days, v_recent_days
  from licenses l join plans p on p.id = l.plan_id
  where l.user_id = v_uid and p.code in ('BASIC', 'ADVANCED') and l.status in ('active', 'replaced');

  select coalesce(max(percentage), 0) into v_age_pct
  from discount_rules
  where discount_type = 'entrepreneur_age' and active and (duration_months is null or duration_months = p_months)
    and v_age_days >= min_days and (max_days is null or v_age_days <= max_days)
    and valid_from <= now() and (valid_until is null or valid_until > now());

  select coalesce(max(percentage), 0) into v_recent_pct
  from discount_rules
  where discount_type = 'recent_base_purchase' and active and (duration_months is null or duration_months = p_months)
    and v_recent_days >= min_days and (max_days is null or v_recent_days <= max_days)
    and valid_from <= now() and (valid_until is null or valid_until > now());

  v_pct := greatest(coalesce(v_age_pct, 0), coalesce(v_recent_pct, 0));

  return jsonb_build_object(
    'ok', true, 'catalog_id', v_catalog_id, 'months', p_months, 'base_plan_id', v_plan_id, 'base_plan', v_plan_code,
    'price', v_price, 'age_days', v_age_days, 'age_pct', v_age_pct, 'recent_days', v_recent_days, 'recent_pct', v_recent_pct,
    'discount_pct', v_pct, 'final_price', round(v_price * (1 - v_pct / 100), 2)
  );
end;
$$;

create or replace function public.apply_subscription_activation(p_subscription_id uuid)
returns timestamptz
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_sub subscriptions%rowtype;
  v_active_until timestamptz;
  v_start timestamptz;
  v_expires timestamptz;
begin
  select * into v_sub from subscriptions where id = p_subscription_id for update;
  if v_sub.id is null or v_sub.status <> 'pending' then
    raise exception 'El pedido no existe o ya no está pendiente.';
  end if;

  if v_sub.upgraded_from_subscription_id is not null then
    if exists (
      select 1 from subscriptions
      where user_id = v_sub.user_id and status = 'active' and expires_at > now() and id <> v_sub.upgraded_from_subscription_id
    ) then
      raise exception 'La cuenta tiene otro plan activo además del que se actualiza; revisalo antes de activar.';
    end if;
    update subscriptions
      set status = 'expired', expires_at = least(expires_at, now()),
          auto_renew = false, auto_renew_canceled_at = case when auto_renew then now() else auto_renew_canceled_at end,
          updated_at = now()
      where id = v_sub.upgraded_from_subscription_id and user_id = v_sub.user_id;
    v_start := now();
  else
    select max(expires_at) into v_active_until
    from subscriptions
    where user_id = v_sub.user_id and status = 'active' and expires_at > now();
    if v_sub.duration_months = 1 and v_active_until is not null then
      raise exception 'Es una suscripción mensual y la cuenta ya tiene Plus hasta el %. La mensual no se suma: activala cuando venza.',
        to_char(v_active_until at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY');
    end if;
    v_start := greatest(now(), coalesce(v_active_until, now()));
    update subscriptions set auto_renew = false, auto_renew_canceled_at = now(), updated_at = now()
    where user_id = v_sub.user_id and status = 'active' and auto_renew and id <> v_sub.id;
  end if;

  v_expires := v_start + make_interval(months => v_sub.duration_months);
  update subscriptions set status = 'active', start_at = v_start, expires_at = v_expires, updated_at = now() where id = v_sub.id;
  update purchases set payment_status = 'approved', completed_at = now(), updated_at = now() where id = v_sub.purchase_id;
  perform public.create_commission_for_purchase(v_sub.purchase_id);
  return v_expires;
end;
$$;

-- 3) Avisos automáticos de la versión gratis: no se muestran a quien tiene Plus (aunque no tenga licencia).
create or replace function public.my_auto_notice() returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_profile profiles%rowtype;
  v_prev_open timestamptz;
  v_license record;
  v_has_license boolean;
  v_plus_end timestamptz;
  v_rule auto_notices%rowtype;
  v_hit boolean;
  v_vars jsonb;
  v_offer_end timestamptz;
  v_count integer;
begin
  if v_uid is null then return null; end if;
  select * into v_profile from profiles where id = v_uid;
  if v_profile.id is null or v_profile.account_status <> 'active' then return null; end if;

  select opened_at into v_prev_open from user_last_open where user_id = v_uid;
  insert into user_last_open (user_id, opened_at) values (v_uid, now())
  on conflict (user_id) do update set opened_at = now() where user_last_open.opened_at < now() - interval '10 minutes';

  -- El equipo y las cuentas de prueba no reciben avisos automáticos.
  if v_profile.role in ('admin', 'moderator') or v_profile.is_tester then return null; end if;

  select l.expires_at, l.dev_grant_id into v_license from licenses l join plans p on p.id = l.plan_id
   where l.user_id = v_uid and l.status = 'active' and p.code in ('BASIC', 'ADVANCED') and (l.expires_at is null or l.expires_at > now())
   order by l.expires_at nulls first limit 1;
  v_has_license := found;
  select max(s.expires_at) into v_plus_end from subscriptions s where s.user_id = v_uid and s.status = 'active' and s.expires_at > now();

  for v_rule in select * from auto_notices where active order by sort loop
    -- ¿Ya se mostró? Solo se repite si la regla lo permite y pasó ese tiempo.
    continue when exists (select 1 from auto_notice_log g where g.user_id = v_uid and g.code = v_rule.code
                          and (v_rule.repeat_days = 0 or g.shown_at > now() - make_interval(days => v_rule.repeat_days)));
    v_hit := false;
    v_vars := jsonb_build_object('dias', v_rule.days);

    if v_rule.code = 'free_discount' then
      v_hit := not v_has_license and v_plus_end is null and v_profile.created_at <= now() - make_interval(days => v_rule.days);
      v_vars := jsonb_build_object('dias', floor(extract(epoch from now() - v_profile.created_at) / 86400)::int);
    elsif v_rule.code = 'free_limit' then
      if not v_has_license and v_plus_end is null then
        select count(*) into v_count from materials where user_id = v_uid and status <> 'archived';
        v_hit := v_count >= coalesce((select pl.limit_value from plan_limits pl join plans p on p.id = pl.plan_id where p.code = 'FREE' and pl.resource = 'materials'), 5);
        if not v_hit then
          select count(*) into v_count from products where user_id = v_uid and status <> 'archived';
          v_hit := v_count >= coalesce((select pl.limit_value from plan_limits pl join plans p on p.id = pl.plan_id where p.code = 'FREE' and pl.resource = 'products'), 2);
        end if;
      end if;
    elsif v_rule.code = 'courtesy_ending' then
      v_hit := v_has_license and v_license.dev_grant_id is not null and v_license.expires_at is not null
               and v_license.expires_at <= now() + make_interval(days => v_rule.days);
      if v_hit then v_vars := jsonb_build_object('fin', to_char(v_license.expires_at at time zone 'America/Argentina/Buenos_Aires', 'DD/MM')); end if;
    elsif v_rule.code = 'plus_ending' then
      v_hit := v_plus_end is not null and v_plus_end <= now() + make_interval(days => v_rule.days)
               and not exists (select 1 from subscriptions s where s.user_id = v_uid and s.status = 'active' and s.auto_renew);
      if v_hit then v_vars := jsonb_build_object('fin', to_char(v_plus_end at time zone 'America/Argentina/Buenos_Aires', 'DD/MM')); end if;
    elsif v_rule.code = 'pack_suggest' then
      if v_has_license and v_plus_end is null and not public.has_module('PACK_VENTAS') then
        select count(*) into v_count from calculations where user_id = v_uid;
        v_hit := v_count >= greatest(v_rule.days, 1);
        v_vars := jsonb_build_object('calculos', v_count);
      end if;
    elsif v_rule.code = 'welcome_back' then
      v_hit := v_prev_open is not null and v_prev_open <= now() - make_interval(days => v_rule.days);
      if v_hit then v_vars := jsonb_build_object('dias', floor(extract(epoch from now() - v_prev_open) / 86400)::int); end if;
    elsif v_rule.code = 'anniversary' then
      v_hit := v_profile.created_at <= now() - make_interval(days => greatest(v_rule.days, 1));
    end if;
    continue when not v_hit;

    -- Descuento personal (si la regla lo da y la persona todavía puede comprar).
    v_offer_end := null;
    if v_rule.discount_pct > 0 and v_rule.code in ('free_discount', 'courtesy_ending') then
      v_offer_end := now() + make_interval(days => v_rule.offer_days);
      insert into user_offers (user_id, source, discount_pct, expires_at) values (v_uid, v_rule.code, v_rule.discount_pct, v_offer_end);
      v_vars := v_vars || jsonb_build_object('descuento', v_rule.discount_pct, 'vence', to_char(v_offer_end at time zone 'America/Argentina/Buenos_Aires', 'DD/MM'));
    end if;

    insert into auto_notice_log (user_id, code) values (v_uid, v_rule.code)
    on conflict (user_id, code) do update set shown_at = now(), times = auto_notice_log.times + 1;

    return jsonb_build_object('code', v_rule.code, 'kind', v_rule.kind, 'title', v_rule.title, 'body', v_rule.body,
                              'button_label', v_rule.button_label, 'button_link', v_rule.button_link, 'vars', v_vars);
  end loop;
  return null;
end;
$$;
revoke all on function public.my_auto_notice() from public, anon;
grant execute on function public.my_auto_notice() to authenticated;

-- 4) Con Mensualidad Plus (sin Edición Personal) también se puede comprar un «Aparato extra»; el resto ya viene incluido.
create or replace function public.request_module_purchase(p_module_code text)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_module modules%rowtype;
  v_purchase uuid;
begin
  if v_uid is null then raise exception 'Iniciá sesión para comprar.'; end if;
  select * into v_module from modules where code = p_module_code and active;
  if v_module.id is null or not public.sellable_module(v_module.code) then raise exception 'Este módulo todavía no está disponible.'; end if;
  if not exists (select 1 from licenses l join plans p on p.id = l.plan_id where l.user_id = v_uid and l.status = 'active' and p.code in ('BASIC', 'ADVANCED'))
     and not (v_module.code = 'EXTRA_DEVICE' and exists (select 1 from subscriptions s where s.user_id = v_uid and s.status = 'active' and s.expires_at > now())) then
    raise exception 'Los extras se suman a la Edición Personal.';
  end if;
  if v_module.code <> 'EXTRA_DEVICE' and exists (select 1 from user_modules where user_id = v_uid and module_id = v_module.id and status = 'active') then
    raise exception 'Ya tenés este módulo.';
  end if;
  select id into v_purchase from purchases
   where user_id = v_uid and product_type = 'module' and product_id = v_module.id and payment_status = 'pending'
   order by created_at desc limit 1;
  if v_purchase is not null then return v_purchase; end if;
  insert into purchases (user_id, product_type, product_id, quantity, subtotal, discount_amount, total, currency, payment_provider, payment_status)
  values (v_uid, 'module', v_module.id, 1, v_module.price, 0, v_module.price, 'ARS', 'manual', 'pending')
  returning id into v_purchase;
  return v_purchase;
end;
$$;

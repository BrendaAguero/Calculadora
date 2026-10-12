# SUPABASE_SCHEMA.md

## Objetivo

Especificación inicial de la base de datos Supabase para la aplicación de cálculo y gestión de emprendimientos.

La arquitectura debe permitir múltiples actividades con lógicas de cálculo diferentes.

## Entidades principales

### profiles
- id UUID PK = auth.users.id
- full_name
- email
- role
- account_status
- created_at
- updated_at

### user_preferences
- user_id PK/FK
- theme
- language
- currency
- default_unit
- default_margin
- default_markup
- default_waste_percentage
- auto_deduct_stock
- low_stock_notifications
- business_summary_notifications
- subscription_notifications
- tutorial_completed
- show_contextual_help
- created_at
- updated_at

### plans
- id
- code
- name
- type
- price
- currency
- active
- description
- created_at
- updated_at

Planes base:
- BASIC
- ADVANCED

Emprendedor es una suscripción, no una licencia base.

### plan_limits
- id
- plan_id
- resource
- limit_value
- unlimited
- created_at
- updated_at

Límites:
BASIC: materials 30, products 10, formulas 5, molds 5.
ADVANCED: materials 100, products 50, formulas 30, molds 30.
Calculations e history: unlimited.

### licenses
- id UUID
- user_id
- plan_id
- purchase_id
- status
- acquired_at
- activated_at
- upgraded_from_license_id
- created_at
- updated_at

Estados:
active, revoked, refunded, replaced.

### activities
- id
- code
- name
- description
- icon
- active
- sort_order
- calculation_engine
- created_at
- updated_at

Iniciales:
YESO, RESINA, JESMONITE, CEMENTO_DECORATIVO.

### user_activities
- id
- user_id
- activity_id
- purchase_id
- is_primary
- acquired_at
- status
- created_at

Actividades compradas son permanentes.

### modules
- id
- code
- name
- description
- price
- currency
- active
- created_at
- updated_at

Iniciales:
CALCULO_INVERSO, ESCALADO_AVANZADO, MOLDES_AVANZADOS, STOCK_BASICO, PROVEEDORES_BASICO.

### user_modules
- id
- user_id
- module_id
- purchase_id
- acquired_at
- status
- created_at

Módulos comprados son permanentes. Emprendedor otorga acceso temporal sin crear una compra falsa.

### subscriptions
- id
- user_id
- base_plan_id
- purchase_id
- duration_months
- start_at
- expires_at
- status
- auto_renew
- price_before_discount
- base_discount_percentage
- recent_purchase_discount_percentage
- total_discount_percentage
- final_price
- currency
- upgraded_from_subscription_id (si es una actualización: el plan que reemplaza)
- upgrade_credit (crédito descontado por lo que quedaba del plan anterior)
- created_at
- updated_at

Estados:
pending, active, expired, canceled, refunded.

Cuando vence, el usuario vuelve a su licencia base permanente.

### discount_rules
- id
- discount_type
- name
- min_days
- max_days
- duration_months
- percentage
- max_total_discount
- active
- created_at
- updated_at

Tipos:
entrepreneur_age, recent_base_purchase, base_upgrade, first_activity_purchase, promotional.

Los descuentos aplicados deben conservarse en la compra.

### purchases
Representa compras dentro de la plataforma.

- id UUID
- user_id
- product_type
- product_id
- quantity
- subtotal
- discount_amount
- total
- currency
- payment_provider
- payment_reference
- payment_status
- purchased_at
- completed_at
- refunded_at
- created_at
- updated_at

### purchase_items
Snapshot del producto comprado:
- id
- purchase_id
- item_type
- item_reference
- name_snapshot
- unit_price
- quantity
- discount_amount
- total
- metadata
- created_at

### payment_transactions
- id
- purchase_id
- provider
- external_payment_id
- external_preference_id
- status
- amount
- currency
- raw_status
- approved_at
- refunded_at
- created_at
- updated_at

Mercado Pago procesa tarjetas/datos sensibles. No almacenarlos en Supabase.

Los webhooks deben ser idempotentes.

Mercado Pago (migración `20261011_mercadopago.sql`):
- Índice único `(provider, external_payment_id)`: el mismo pago no se registra dos veces (idempotencia).
- `mp_record_payment(p jsonb)`: solo `service_role`. Lo llama el servidor después de consultar el pago a la API de Mercado Pago (nunca con datos que lleguen por URL o webhook sin verificar). Aprobado + monto y moneda correctos → activa la suscripción; reembolso o contracargo → compra `refunded` y suscripción `refunded`; rechazado o pendiente → solo se registra.
- `apply_subscription_activation(id)`: la lógica de activación (suma de plazos, actualizaciones), solo `service_role`; `admin_activate_subscription` la usa después de comprobar que es administradora.

### materials
- id
- user_id
- activity_id nullable
- name
- default_unit
- current_price_id nullable
- status
- created_at
- updated_at

Estados: active, archived.

### material_prices
- id
- material_id
- purchase_price
- purchase_quantity
- purchase_unit
- unit_cost
- currency
- is_estimated
- supplier_id nullable
- valid_from
- valid_until nullable
- created_at

Nunca modificar precios históricos usados en cálculos.

### formulas
- id
- user_id
- activity_id
- product_id nullable
- mold_id nullable
- name
- category
- photo_url nullable
- notes
- current_version_id nullable
- status
- created_at
- updated_at

Estados: active, archived.

### formula_versions
- id
- formula_id
- version_number
- water_percentage nullable
- yield_quantity
- notes
- created_at
- created_by

El porcentaje de agua pertenece a la fórmula/version, no al molde.

### formula_items
- id
- formula_version_id
- material_id nullable
- ingredient_type
- quantity
- unit
- percentage nullable
- notes

Tipos posibles:
material, water, additive, pigment, hardener, other.

### molds
- id
- user_id
- activity_id
- name
- photo_url
- reference_measurement_value nullable
- reference_measurement_unit nullable (g, kg, ml, l)
- cost
- estimated_uses
- notes
- status
- created_at
- updated_at

La medición es genérica; su interpretación depende de la actividad. Para Yeso, si la medición del molde es 300 g de agua, se toma como 300 g de yeso por pieza salvo que el usuario indique otra cosa.

(Verificado contra la base real el 2026-10-10: no existen las columnas water_capacity, water_unit ni plaster_per_piece.)

### mold_usage
- id
- mold_id
- production_id nullable
- quantity_used
- used_at
- notes

### products
- id
- user_id
- activity_id
- name
- photo_url
- default_formula_id nullable
- default_mold_id nullable
- status
- notes
- created_at
- updated_at

Estados: active, paused, archived.

### product_prices
- id
- product_id
- price_type
- quantity_min
- quantity_max nullable
- price
- currency
- valid_from
- valid_until
- created_at

Tipos:
retail, wholesale, manual, promotional.

### calculations
- id
- user_id
- activity_id
- product_id nullable
- formula_id nullable
- formula_version_id nullable
- mold_id nullable
- calculation_mode
- quantity
- total_cost
- unit_cost
- suggested_price
- profit_per_unit
- margin_percentage
- created_at

Modos:
easy, standard, personalized.

### calculation_items
Debe congelar los datos usados por el cálculo:
- id
- calculation_id
- material_id nullable
- material_name_snapshot
- quantity
- unit
- unit_cost_snapshot
- total_cost
- metadata

También deben conservarse snapshots de merma, packaging, molde, mano de obra, electricidad, gas, comisiones y otros costos.

### productions
- id
- user_id
- activity_id
- product_id
- formula_id nullable
- formula_version_id nullable
- quantity
- total_cost
- stock_deducted
- produced_at
- notes
- created_at

### production_items
- id
- production_id
- material_id
- quantity
- unit
- unit_cost_snapshot
- total_cost
- created_at

### stock_items
- id
- user_id
- material_id nullable
- product_id nullable
- stock_type
- quantity
- unit
- minimum_quantity
- updated_at

stock_type:
material, finished_product.

### stock_movements
- id
- user_id
- stock_item_id
- movement_type
- quantity
- unit
- reference_type
- reference_id
- notes
- created_at

Tipos:
purchase, production_consumption, production_output, sale, adjustment, return, other.

Reglas (migración `20261011_stock.sql`):
- un solo `stock_items` por material y por producto;
- `stock_items.quantity` se crea en 0 y solo cambia con movimientos: un trigger suma `stock_movements.quantity` (positiva entra, negativa sale);
- los movimientos no se editan ni se borran; los errores se corrigen con un `adjustment`;
- la unidad del stock es la del material (`default_unit`) o `unidad` para productos; la app convierte kg↔g, l↔ml.

Producción (migración `20261011_produccion_compras.sql`): `register_production(p jsonb)` guarda la producción, sus materiales (con el costo de ese día) y, si se pide, descuenta el stock (`production_consumption`) y suma el producto terminado (`production_output`) en una sola transacción. Si falta stock no se bloquea: el stock puede quedar negativo. `ensure_stock_item` crea el ítem de stock en cero si no existía.

### suppliers
- id
- user_id
- name
- phone
- email
- notes
- status
- created_at
- updated_at

### supplier_purchases
Representa compras de materiales realizadas a proveedores, no compras de licencias de la plataforma.

- id
- user_id
- supplier_id nullable
- purchase_date
- total
- currency
- stock_updated
- notes
- created_at

### supplier_purchase_items
- id
- supplier_purchase_id
- material_id
- quantity
- unit
- unit_price
- total
- created_at

Compras (misma migración): `register_supplier_purchase(p jsonb)` guarda la compra y sus ítems; opcionalmente crea un precio nuevo por material (con `supplier_id`, cerrando el anterior con `valid_until`) y suma al stock (`purchase`). Todas son SECURITY INVOKER: RLS sigue aplicando.

### sales
- id
- user_id
- product_id
- quantity
- unit_price
- subtotal
- discount
- commission
- total
- net_income
- currency
- sale_date
- customer_name nullable
- payment_method nullable
- created_at

Las ventas conservan sus valores históricos.

Ventas (migración `20261011_ventas.sql`):
- `voided_at`: una venta anulada no se borra; queda marcada y deja de contar en totales y en el resumen.
- `register_sale(p jsonb)` guarda la venta y, si se pide, descuenta del stock de productos terminados (`sale`).
- `void_sale(id)` anula y devuelve al stock lo descontado con un movimiento `return`.
- Ganancia (`net_income`) = total − comisión − costo; `total` = subtotal − descuento. El costo por pieza es el más reciente entre el último cálculo y la última producción del producto.

Afiliados y administración (migración `20261011_afiliados_admin.sql`):
- Flujo: `apply_affiliate` (solicitud) → `admin_review_affiliate` (aprueba con 15/20 %, crea el código) → `attribute_purchase` (la compra pendiente queda asociada; antifraude: código activo, afiliada aprobada, no propio, una sola por compra) → al activarse la compra, `create_commission_for_purchase` crea la comisión `held` por 11 días → `refresh_affiliate` la pasa a `available` y evalúa PRO (10 ventas válidas/mes, 3 meses seguidos → 25 %) → `request_withdrawal` (mínimo $20.000, PRO $10.000) → `admin_update_withdrawal` (pagado/rechazado). Un reembolso anula la comisión (`reversed`).
- `commissions.withdrawal_id` vincula cada comisión con su retiro; índice único por compra.
- Administradoras: políticas `admin_select_all` (solo lectura) en perfiles, compras, suscripciones, licencias, pagos, afiliados, comisiones, retiros, dev_grants y auditoría. Las escrituras van por funciones `admin_*` que verifican `is_admin()` y registran en `audit_logs` (`log_audit`).
- `admin_set_account_status` (no sobre la propia cuenta) y `admin_grant_license` (licencia de cortesía vía `dev_grants`). El trigger de perfiles ahora también permite estos cambios a administradoras.

### affiliates
- id
- user_id
- status
- commission_percentage
- is_pro
- pro_started_at
- valid_sales_count
- approved_at
- created_at
- updated_at

Estados:
pending, approved, suspended, rejected.

### affiliate_codes
- id
- affiliate_id
- code
- active
- created_at

El código debe ser globalmente único.

### affiliate_attributions
- id
- affiliate_id
- user_id
- purchase_id
- attribution_type
- created_at

### commissions
- id
- affiliate_id
- purchase_id
- percentage
- gross_sale_amount
- commission_amount
- hold_until
- status
- created_at
- released_at
- reversed_at

Estados:
pending, held, available, withdrawal_requested, paid, reversed, canceled.

### withdrawals
- id
- affiliate_id
- amount
- payout_method
- payout_reference nullable
- status
- requested_at
- paid_at
- notes

Estados:
requested, reviewing, approved, paid, rejected.

### notifications
- id
- user_id
- type
- title
- message
- read_at
- created_at

### content_entries
- id
- content_type
- slug
- title
- content
- status
- updated_by
- created_at
- updated_at

Tipos:
faq, tutorial, contextual_help, announcement, banner, affiliate_material, legal_document.

### audit_logs
- id
- actor_user_id nullable
- action
- entity_type
- entity_id
- old_data nullable
- new_data nullable
- metadata
- created_at

### error_logs
- id
- error_code
- category
- severity
- user_id nullable
- request_id nullable
- message
- technical_details
- path
- created_at
- resolved_at
- resolved_by

## Reglas RLS

Todas las tablas privadas deben usar RLS.

Regla base:
`auth.uid() = user_id`

Las tablas relacionadas deben impedir acceso indirecto a registros de otros usuarios.

Administración debe usar permisos de servidor/roles seguros, no solamente botones ocultos.

## Integridad

Usar:
- foreign keys;
- unique constraints;
- check constraints;
- not null cuando corresponda;
- UUID;
- timestamps;
- estados controlados.

## Historial

Nunca sobrescribir:
- precios históricos;
- cálculos;
- ventas;
- producciones;
- versiones de fórmulas;
- compras;
- comisiones.

Preferir archive en lugar de delete cuando exista historial.

## Emprendedor

No duplicar datos al activar la suscripción.

Emprendedor modifica permisos temporalmente sobre los mismos datos.

Funciones (migración `supabase/migrations/20261011_emprendedor.sql`, todas SECURITY DEFINER y solo para `authenticated`):

- `is_admin()`: si quien llama es administradora activa.
- `quote_entrepreneur(meses)`: precio, descuentos y precio final para quien llama (se aplica el mayor de los dos descuentos).
- `request_entrepreneur(meses)`: crea la compra (`payment_provider = 'manual'`) y la suscripción, ambas pendientes. Un solo pedido pendiente por persona.
- `cancel_entrepreneur_request(id)`: la persona cancela su pedido pendiente.
- `admin_list_entrepreneur_requests()` y `admin_activate_subscription(id)`: solo administradoras. Al activar, el plazo empieza al terminar el Emprendedor vigente (si hay) y la compra pasa a `approved`.
- 1 mes = suscripción mensual (`auto_renew = true`). `cancel_entrepreneur_auto_renew(id)`: la persona cancela la renovación (`auto_renew_canceled_at`). La suscripción mensual no se suma: solo se pide y activa sin Emprendedor vigente. Al activar 6 o 12 meses se cancela la renovación de la mensual (migración vigente: `20261011_emprendedor_mensual_no_suma.sql`; reemplaza las reglas de `20261011_emprendedor_mensual.sql` y `20261011_emprendedor_suscripcion_mensual.sql`).
- Actualizar a un plan más largo (migración `20261011_emprendedor_actualizar.sql`): `quote_entrepreneur_upgrade(meses)` calcula el crédito proporcional y el precio; `request_entrepreneur_upgrade(meses)` crea el pedido. `subscriptions.upgraded_from_subscription_id` y `subscriptions.upgrade_credit` registran de qué plan viene y cuánto se descontó. Al activarlo, el plan anterior pasa a `expired` ese día. La pantalla de administración usa `admin_list_entrepreneur_requests_v2()`, que agrega esos datos.

Vencimiento: no hay proceso que cambie el estado; la app considera vigente solo lo que tiene `expires_at` en el futuro.

## Botón de arrepentimiento (Etapa 21)

`regret_requests`: pedidos para revocar una compra dentro de los 10 días (Res. 424/2020). Código de trámite `ARR-XXXXXXXX`, nombre, email, referencia y fecha de compra opcionales, estado `received` / `refunded` / `rejected`.
- RLS: solo lectura para la dueña del pedido (si tenía sesión) y la administración. Nadie inserta ni modifica directo.
- `submit_regret_request(...)`: SECURITY DEFINER, ejecutable por `anon` y `authenticated` (la ley pide que no haga falta cuenta). Valida datos y limita a 5 pedidos por email por día.
- `admin_resolve_regret_request(id, status, note)`: solo administración; deja auditoría.

## Revisión de seguridad (Etapa 22)

- `bootstrap_calculadora_admin()` y `handle_new_user()` ya no se pueden ejecutar desde la API (anon/authenticated).
- `sync_calculation_item_snapshot_name()` con `search_path` fijo.
- Probado: sin sesión no se lee ninguna tabla privada; una cuenta no ve ni modifica datos de otra, no puede hacerse admin ni tester, no puede llamar funciones admin ni de pagos; un pago repetido no se activa dos veces y una devolución anula plan y comisión (prueba hecha dentro de una transacción deshecha).

## Suscripción mensual con cobro automático

- `subscriptions.external_preapproval_id` (único) y `subscriptions.preapproval_status`: la suscripción en Mercado Pago y su estado (`pending`, `authorized`, `paused`, `cancelled`).
- `mp_update_preapproval(subscription_id, preapproval_id, status)`: guarda el estado; si se pausa o cancela, `auto_renew = false`.
- `mp_record_subscription_payment(p)`: primer cobro → activa el pedido (vía `mp_record_payment`); cobros siguientes → compra `subscription_renewal` aprobada, fila en `subscription_renewals` y un mes más. Idempotente por id de pago.
- `mp_record_payment`: si se devuelve el cobro de una renovación, esa renovación queda `canceled` y se resta el mes.
- Las tres funciones son solo para `service_role`.

## Botón de baja (Res. 316/2018)

- `regret_requests.kind`: `regret` (arrepentimiento) o `cancellation` (baja pedida sin sesión).
- `cancel_my_subscriptions()`: con sesión; cancela la renovación de todas las suscripciones de la persona, deja auditoría `subscription.cancel_button` y devuelve el código `BAJA-…`. La app además cancela la suscripción en Mercado Pago.
- `submit_cancellation_request(nombre, email, detalle)`: sin sesión (anon); crea el pedido con código `BAJA-…` para que lo resuelva la administración.

## Versión gratis, compras online y banner

- Plan `FREE` en `plans` + `plan_limits` (5 materiales, 2 productos, 1 fórmula, 1 molde). Toda cuenta sin licencia lo usa.
- `grant_free_activity(user)`: da Yeso como actividad principal (otorgamiento automático); lo llama `handle_new_user`.
- Compras de pago único con Checkout Pro: `request_license_purchase(plan)`, `quote_license_upgrade()` / `request_license_upgrade()` (precio según `upgrade_price_rules`), `request_module_purchase(code)` (solo `sellable_module`: STOCK_BASICO, PROVEEDORES_BASICO), `cancel_purchase_request(id)`.
- `apply_purchase_activation(purchase)` (interna): crea la licencia (o reemplaza Básico por Avanzado, `status = replaced`) o el módulo, aprueba la compra y genera la comisión. `mp_record_payment` la llama al aprobarse el pago.
- `revoke_purchase_items(purchase)` (interna): al devolverse el pago, la licencia o el módulo pasan a `refunded` (y vuelve la Básico anterior si era un pase).
- Banner: `content_entries` (`banner` / `free`), editado con `admin_save_banner(...)` (solo admin; enlaces https o internos).

## Edición Personal

- `approved_emails` (email único, origen online/transferencia/mercadolibre/revendedora/cortesía, estado, usuario y licencia). RLS: lectura admin o la propia persona.
- `personal_orders`: pedidos online sin cuenta; `create_personal_order(email, nombre)` (anon) y `mp_record_personal_order(p)` (service_role) que al aprobarse aprueba el email.
- `approve_email_internal`, `grant_personal_license` (internas), `admin_approve_email`, `admin_revoke_email`, `login_allowed(email)` (service_role).
- `handle_new_user`: da Yeso y, si el email está aprobado, la Edición Personal (licencia ADVANCED por otorgamiento).
- `user_devices` + `allowed_devices(user)` (2 + aparatos extra comprados), `register_device(device_id, etiqueta)` → 'ok'/'limit', `release_device(id)`.
- `admin_set_prices(...)`: precios de la Edición Personal (online/transferencia/ML), mensualidad y aparato extra.
- Planes BASIC y FREE desactivados; ADVANCED renombrado «Edición Personal»; catálogo 6/12 meses y descuentos desactivados; mensual a $4.900.

## Regla para futuras actividades

No asumir que todas las actividades usan yeso/agua/porcentaje de agua.

La actividad debe poder seleccionar su propio motor de cálculo.

## Antes de crear migraciones

Claude debe:
1. revisar este esquema;
2. detectar redundancias;
3. detectar enums/check constraints necesarios;
4. revisar RLS;
5. proponer mejoras;
6. no eliminar reglas comerciales sin consultar;
7. no inventar funcionalidades.

Después de aprobación:
1. migración inicial;
2. tablas;
3. foreign keys;
4. índices;
5. constraints;
6. RLS;
7. policies;
8. funciones necesarias;
9. triggers solo cuando sean necesarios;
10. pruebas.

### Clave de acceso (20261012_clave_de_acceso)
- `approved_emails.key_hash` (sha256, único), `key_hint`, `key_cipher` (AES-256-GCM con secreto del servidor), `key_created_at`. Las columnas `key_hash` y `key_cipher` no son legibles por `authenticated`.
- `set_email_key` (admin o service_role), `key_lookup(hash)` y `approved_email_for(email)` (solo service_role).
- Se entra en `/login` con la clave (`redeemAccessKey`); la sesión queda abierta en el aparato. La clave se crea y se manda por correo (SMTP propio, `SMTP_USER`/`SMTP_PASS`) al aprobar un email o al aprobarse un pago online.

### Proporciones por actividad (20261012_proporciones_por_actividad)
- `activity_settings (user_id, activity_code, settings jsonb, updated_at)`: proporciones, % de pigmento, merma, densidad y precios por kg propios de cada usuaria para RESINA, JESMONITE y CEMENTO_DECORATIVO. RLS: cada una lee y escribe solo las suyas.
- Los cálculos de estas actividades se guardan en `calculations` (modo `standard`) y `calculation_items`; la primera línea lleva `metadata.kind = 'mix'` con la receta completa.

### Revendedoras (20261012_revendedoras)
- `reseller_accounts(user_id, status)`, `reseller_orders(id, user_id, quantity 5|10|20, unit_price, total, status, payment_reference)`, `reseller_clients(id, reseller_id, email, full_name, status pending|approved|rejected, approved_email_id, note)`. RLS: cada revendedora ve lo suyo; la administración ve todo.
- Saldo = licencias de paquetes aprobados − clientas pendientes o aprobadas (`reseller_balance`, `my_reseller_balance`).
- v2: se compran de 1 a 100 licencias; precio por licencia `reseller_unit_price_for(cantidad)` = precio de a una con descuento desde 5, 10 y 20 (`reseller_discount_5/10/20`); `admin_set_reseller_prices`. Contacto y recursos de venta en `content_entries` (affiliate_material/revendedoras), con `admin_save_reseller_resources`.
- `become_reseller`, `request_reseller_order`, `mp_record_reseller_order` (service_role), `reseller_add_client`, `reseller_cancel_client`, `admin_decide_reseller_client` (aprueba el email con origen «revendedora»), `admin_set_reseller_price`. Precio en `pricing_config.reseller_unit_price`.

### Actividades (20261012_actividad_principal)
- La principal la elige la usuaria (`choose_primary_activity`); la segunda sale a mitad de precio y las siguientes a precio normal (`activity_price_for`, `my_activity_price`, `request_activity_purchase`); `apply_purchase_activation` activa compras `activity`.

### Sin conexión (20261012_sin_conexion)
- `offline_sync_log(user_id, client_id, kind)`: cada venta o cálculo cargado sin conexión tiene un id propio; al subirlo (`/api/sync`, solo Plus) se registra para no repetirlo. RLS: cada una lo suyo.
- El aparato guarda las pantallas visitadas (service worker `sw.js?plus=1`, caché `pantallas-v1`) y la bandeja de salida en IndexedDB (`calculadora` → `salida`). Al ir a /login se borran las pantallas guardadas.

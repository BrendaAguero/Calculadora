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
- water_capacity
- water_unit
- plaster_per_piece nullable
- cost
- estimated_uses
- notes
- status
- created_at
- updated_at

Para Yeso, si la medición del molde es 300 g de agua, se toma como 300 g de yeso por pieza salvo que el usuario indique otra cosa.

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

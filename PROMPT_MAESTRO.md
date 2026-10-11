# PROMPT_MAESTRO.md

# Calculadora y Gestión para Emprendimientos de Yeso

## Objetivo

Aplicación web especializada para emprendedores que fabrican y venden productos, comenzando por YESO.

La aplicación debe resolver:
- cálculo de costos;
- cálculo de precios;
- fórmulas;
- moldes;
- producción;
- stock;
- ventas;
- proveedores;
- estadísticas y gestión del negocio.

No es una calculadora genérica de manualidades.

La arquitectura debe permitir agregar actividades futuras como Resina, Jesmonite y Cemento decorativo sin reescribir el núcleo.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Vercel
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- Supabase Row Level Security
- Mercado Pago

La implementación se realizará por etapas pequeñas y verificables.

La usuaria no es programadora. Toda instrucción técnica debe indicar:
- archivo exacto;
- si se crea o modifica;
- contenido completo cuando corresponda;
- comando exacto y dónde ejecutarlo;
- qué se espera obtener;
- cómo verificar que funciona.

No construir toda la aplicación de una sola vez.

## Planes

Licencia permanente:
- Básico: ARS 12.900, pago único.
- Avanzado: ARS 24.900, pago único.

Suscripción temporal:
- Emprendedor: 1 mes ARS 6.900; 6 meses ARS 34.900; 12 meses ARS 59.900.

Emprendedor requiere tener Básico o Avanzado y temporalmente habilita todas las funciones avanzadas y módulos funcionales.

Descuentos de Emprendedor (tabla `discount_rules`): por antigüedad de la licencia base y por compra/upgrade reciente de licencia. Si corresponden los dos, se aplica solo el mayor (no se suman). Decisión del 11/10/2026.

Renovación: si ya hay Emprendedor vigente, 6 y 12 meses se suman al final del actual. Pagar mes a mes sale más caro que el plazo largo (6 mensualidades > 6 meses), y la pantalla lo muestra.

1 mes es una suscripción mensual: se renueva cada mes y la persona puede cancelar la renovación (sigue activa hasta que vence). No se suma: solo se contrata cuando no hay Emprendedor vigente. Si alguien con la suscripción mensual compra 6 o 12 meses, el plazo largo empieza cuando termina el mes pagado y la renovación mensual se cancela sola. El cobro automático de la renovación llega con Mercado Pago (Etapa 18).

Comprar más tiempo con Emprendedor vigente pide confirmación («¿Seguro querés comprar 6 meses más?») y, si conviene, ofrece actualizar.

Actualizar a un plan más largo (1→6, 1→12, 6→12), con prorrateo: crédito = lo pagado por el plan actual × (tiempo que le queda ÷ duración total). Precio = precio del plan nuevo con su descuento − crédito. El plan nuevo empieza hoy y dura completo; el anterior termina hoy. Solo con un único plan activo y pagado (los de cortesía no dan crédito). Decisión del 11/10/2026.

Pago con Mercado Pago (Checkout Pro): al pedir Emprendedor se va a pagar a Mercado Pago y, al aprobarse, se activa solo. El servidor confirma cada pago consultándolo a Mercado Pago. Si el pago en línea no está configurado, la administradora sigue pudiendo activar pedidos a mano. Renovación automática (11/10/2026): la suscripción mensual usa Suscripciones de Mercado Pago (preapproval). La persona escribe el email de su cuenta de Mercado Pago, autoriza un cobro mensual del mismo monto del primer mes y cada cobro aprobado suma un mes. Cancelar la renovación en la app la cancela también en Mercado Pago; comprar 6 o 12 meses o devolver el pago también. La comisión de afiliada se genera solo con el primer pago. En el panel de Mercado Pago, el webhook debe tener los eventos «Pagos» y «Planes y suscripciones».

Variables de entorno (solo servidor salvo la pública): `MP_ACCESS_TOKEN`, `NEXT_PUBLIC_MP_PUBLIC_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y, opcional, `MP_WEBHOOK_SECRET` para verificar la firma de los avisos.

Cuando vence:
- Básico -> vuelve a Básico.
- Avanzado -> vuelve a Avanzado.

Nunca eliminar datos por vencimiento.

## Actividades

Iniciales:
- Yeso
- Resina
- Jesmonite
- Cemento decorativo

La primera actividad está incluida en el plan base.

Actividad adicional:
- ARS 8.900 junto con la compra inicial.
- ARS 12.900 posteriormente.

Las actividades compradas son permanentes.

## Módulos

- Cálculo inverso: ARS 6.900
- Escalado avanzado: ARS 7.900
- Moldes avanzados: ARS 8.900
- Stock básico: ARS 9.900
- Proveedores básico: ARS 7.900

Los módulos comprados son permanentes.

Emprendedor habilita temporalmente todos los módulos funcionales.

## Límites

Básico:
- 30 materiales
- 10 productos
- 5 fórmulas
- 5 moldes

Avanzado:
- 100 materiales
- 50 productos
- 30 fórmulas
- 30 moldes

Cálculos e historial: ilimitados.

Si durante Emprendedor el usuario supera el límite del plan base, los datos permanecen. Al vencer, no se borran; se restringen las nuevas altas que excedan el límite.

## Calculadora

Tres modos:
- Fácil
- Estándar
- Personalizado

El usuario puede pasar de un modo a otro sin perder datos ingresados.

### Yeso

Si el usuario no conoce la cantidad de yeso necesaria:
1. llena el molde con agua;
2. pesa el agua;
3. el peso del agua en gramos se toma como gramos de yeso por pieza.

Ejemplo:
- agua del molde: 300 g
- yeso por pieza: 300 g
- agua al 60%: 180 g

El porcentaje de agua pertenece a la fórmula, no al molde.

Valores orientativos iniciales:
- 70%
- 75%
- 80%

Deben explicarse como referencias, no como reglas universales. La fórmula guardada debe priorizar su propio porcentaje.

### Materiales

Registrar:
- nombre;
- precio de compra;
- cantidad comprada;
- unidad;
- costo unitario;
- historial de precios;
- proveedor opcional.

Unidades:
- g
- kg
- ml
- L
- unidad

Los cálculos históricos deben conservar el precio utilizado originalmente.

### Costos

Categorías:
- materiales
- merma
- molde
- packaging
- mano de obra
- electricidad
- gas
- comisiones
- otros

### Precio

Métodos:
- porcentaje de ganancia;
- ganancia fija;
- precio manual.

Mostrar:
- costo total;
- costo unitario;
- precio sugerido;
- ganancia;
- margen.

No imponer el precio sugerido.

## Fórmulas

Una fórmula representa una receta técnica.

Debe permitir:
- nombre;
- actividad;
- producto;
- molde;
- ingredientes;
- cantidades;
- porcentaje de agua cuando corresponda;
- notas;
- categoría;
- versiones;
- foto opcional.

Editar una fórmula con historial debe crear una nueva versión.

## Productos

Un producto representa el objeto comercial.

Debe poder relacionarse con:
- actividad;
- fórmula;
- molde;
- precios;
- foto;
- estado.

Avanzado agrega:
- retail;
- mayorista;
- precios por cantidad;
- promociones;
- historial;
- rentabilidad.

## Moldes

Guardar:
- nombre;
- foto;
- capacidad;
- medición con agua;
- yeso por pieza;
- costo;
- usos estimados;
- productos;
- notas.

Moldes avanzados:
- usos reales;
- usos restantes;
- costo por uso;
- historial;
- rendimiento;
- alertas.

## Historial

Los cálculos guardan:
- fecha;
- producto/fórmula;
- cantidad;
- materiales;
- precios utilizados;
- merma;
- costos adicionales;
- precio;
- ganancia;
- margen.

Recalcular con precios actuales crea un cálculo nuevo. No modifica el original.

## Emprendedor

Incluye:
- Avanzado;
- todos los módulos funcionales;
- stock;
- producción;
- compras;
- proveedores;
- ventas;
- estadísticas.

### Stock

Separar:
- materias primas;
- productos terminados.

Registrar:
- cantidad;
- unidad;
- mínimo;
- precio;
- movimientos;
- valor;
- alertas.

### Producción

Desde fórmula/producto:
- elegir cantidad;
- calcular materiales;
- comprobar stock;
- registrar producción;
- opcionalmente descontar stock.

Debe existir configuración global para descuento automático, pero una producción concreta puede decidir no descontar.

Si falta stock:
- informar cuánto falta;
- permitir registrar igualmente;
- permitir registrar sin descontar;
- permitir cancelar.

No bloquear obligatoriamente.

### Ventas

Registrar:
- producto;
- cantidad;
- precio;
- descuento;
- comisión;
- fecha;
- cliente opcional;
- método de pago opcional.

Ganancia:
precio de venta - costo - descuentos - comisiones.

## Navegación

Mobile-first.

Navegación inferior:
- Inicio
- Calcular
- Mis datos
- Gestión
- Más

Gestión se muestra principalmente para Emprendedor.

## Diseño

- moderno;
- limpio;
- profesional;
- accesible;
- mobile-first;
- no infantil;
- no saturado;
- no usar botones gigantes innecesariamente.

Tema:
- diurno;
- nocturno;
- sistema.

Colores sugeridos:
- neutros;
- terracota/clay como color principal;
- verde para éxito;
- amarillo para advertencias;
- rojo para errores;
- violeta/azul para funciones premium.

## Cuenta

Sin contraseña propia.

Registro:
- nombre;
- email;
- aceptación de términos.

Ingreso:
- email;
- código temporal de 6 dígitos.

Licencias asociadas a la cuenta, no al dispositivo.

## Pagos

Mercado Pago.

Flujo:
usuario -> checkout -> pago -> webhook -> validación del servidor -> compra -> activación.

No confiar solamente en una respuesta del frontend.

Estados:
- pending
- approved
- rejected
- canceled
- refunded

## Seguridad

Usar:
- RLS;
- validación del servidor;
- permisos centralizados;
- protección de rutas;
- logs;
- auditoría.

No guardar tarjetas.

Los permisos premium deben verificarse en servidor, no solamente ocultando botones.

## Errores

Mostrar códigos amigables:
- AUTH-XXX
- PAY-XXX
- LIC-XXX
- CALC-XXX
- STK-XXX
- SYNC-XXX
- DB-XXX
- SYS-XXX

Nunca mostrar stack traces al usuario.

## Afiliados

Sistema:
- comisión normal 15% o 20%;
- PRO 25% o 30%;
- retención de 11 días;
- mínimo normal ARS 20.000;
- mínimo PRO ARS 10.000.

PRO:
- 10 ventas válidas/mes durante 3 meses consecutivos;
- estadísticas avanzadas;
- página/catálogo;
- materiales premium;
- acceso anticipado;
- promociones exclusivas.

Debe existir protección contra:
- auto compras;
- cuentas falsas;
- manipulación;
- redistribución de códigos;
- suplantación.

## Administración

Debe permitir:
- usuarios;
- ventas;
- licencias;
- suscripciones;
- afiliados;
- comisiones;
- productos;
- contenido;
- configuración;
- auditoría.

## Privacidad

Datos privados por defecto.

Incluir:
- términos;
- privacidad;
- condiciones de compra;
- suscripciones;
- afiliados;
- reembolsos/cancelaciones;
- botón de arrepentimiento;
- eliminación de cuenta.

El texto legal debe revisarse con normativa argentina vigente antes del lanzamiento.

Etapa 21 (11/10/2026): titular Brenda Agüero, CUIT 27-41713100-6; contacto calculadoraemprender.app@gmail.com (`lib/legal.ts`). Reembolsos: devolución total dentro de los 10 días corridos (botón de arrepentimiento, sin cuenta); después no hay reembolso de licencias, actividades ni módulos, y en Emprendedor se puede cancelar la renovación. Páginas públicas: `/ayuda`, `/legal/*` (términos, privacidad, compras, afiliadas) y `/arrepentimiento`. Eliminación de cuenta: por pedido al email de contacto (5 días hábiles), conservando registros de compras.

## Regla fundamental de desarrollo

No implementar todo de una vez.

Antes de cada etapa:
1. explicar qué se hará;
2. enumerar archivos afectados;
3. implementar;
4. probar;
5. informar cómo verificar;
6. esperar confirmación antes de avanzar.

Si existe una contradicción técnica o comercial, señalarla antes de implementarla.

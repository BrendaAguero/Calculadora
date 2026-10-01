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

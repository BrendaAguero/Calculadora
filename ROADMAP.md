# ROADMAP.md

# Hoja de ruta de construcción

La aplicación se construirá por etapas pequeñas.

Regla:
ETAPA -> IMPLEMENTAR -> PROBAR -> CORREGIR -> CONFIRMAR -> SIGUIENTE ETAPA.

Claude no debe implementar varias etapas a la vez salvo que se indique explícitamente.

## Etapa 1 — Preparación

- Crear repositorio.
- Crear proyecto Next.js + TypeScript + Tailwind.
- Crear proyecto Supabase.
- Conectar Vercel.
- Configurar variables de entorno.
- Crear estructura inicial.
- Verificar despliegue mínimo.

## Etapa 2 — Base de datos

- Revisar SUPABASE_SCHEMA.md.
- Detectar problemas.
- Obtener aprobación.
- Crear migraciones.
- Crear tablas.
- Relaciones.
- Constraints.
- Índices.
- RLS.
- Policies.
- Seed inicial.

## Etapa 3 — Autenticación

- Registro.
- Email.
- Código temporal de 6 dígitos.
- Login.
- Logout.
- Sesión.
- Protección de rutas.
- Perfil.
- Preferencias.

## Etapa 4 — Licencias y permisos

- Básico.
- Avanzado.
- Actividades.
- Módulos.
- Límites.
- Permisos centralizados.
- Validación server-side.

## Etapa 5 — Interfaz base

- Tema claro.
- Tema oscuro.
- Sistema.
- Navegación inferior.
- Inicio.
- Calcular.
- Mis datos.
- Gestión.
- Más.
- Componentes reutilizables.

## Etapa 6 — Materiales

- Crear.
- Editar.
- Archivar.
- Precio.
- Conversión.
- Historial.
- Material compartido.
- Creación rápida desde calculadora.

## Etapa 7 — Moldes

- Registro.
- Foto.
- Capacidad.
- Medición con agua.
- Yeso por pieza.
- Costo.
- Usos.
- Relaciones.

## Etapa 8 — Fórmulas

- Crear.
- Ingredientes.
- Versiones.
- Editar creando nueva versión.
- Duplicar.
- Archivar.
- Escalado normal.

## Etapa 9 — Calculadora Yeso

Primero:
- Fácil.
- Estándar.
- Personalizado.
- medición con agua.
- porcentaje de agua.
- materiales.
- merma.
- costos.
- precio.
- ganancia.
- margen.
- guardar cálculo.

Después:
- cálculo inverso.
- escalado avanzado.

## Etapa 10 — Productos

- Crear producto.
- Fórmula.
- Molde.
- Foto.
- Retail.
- Mayorista.
- Cantidades.
- Promociones.
- Historial.
- Rentabilidad.

## Etapa 11 — Historial

- Listado.
- Filtros.
- Detalle.
- Duplicar.
- Recalcular.
- Mantener originales.

## Etapa 12 — Emprendedor

- Compra de suscripción.
- Activación.
- Expiración.
- Descuentos.
- Retorno al plan base.
- Módulos temporales.

## Etapa 13 — Stock

- Materias primas.
- Productos terminados.
- Cantidades.
- Mínimos.
- Movimientos.
- Alertas.
- Valor.

## Etapa 14 — Producción

- Producción desde fórmula/producto.
- Cálculo de materiales.
- Comprobación de stock.
- Descuento opcional.
- Registro.
- Producto terminado.

## Etapa 15 — Compras y proveedores

- Proveedores.
- Compras de materiales.
- Stock.
- Historial de precios.
- Comparación básica.

## Etapa 16 — Ventas

- Registrar venta.
- Producto terminado.
- Precio.
- Descuento.
- Comisión.
- Ganancia.
- Margen.

## Etapa 17 — Dashboard

- Ventas.
- Costos.
- Ganancias.
- Producción.
- Stock.
- Productos.
- Estadísticas.
- Filtros por período.

## Etapa 18 — Mercado Pago

- Checkout.
- Webhook.
- Validación.
- Idempotencia.
- Estados.
- Activación.
- Suscripciones.
- Upgrades.
- Reembolsos.

## Etapa 19 — Afiliados

- Solicitud.
- Aprobación.
- Código.
- Atribución.
- Comisiones.
- Hold.
- Retiros.
- PRO.
- Antifraude.

## Etapa 20 — Administración

- Usuarios.
- Ventas.
- Licencias.
- Suscripciones.
- Afiliados.
- Comisiones.
- Productos.
- Contenido.
- Configuración.
- Auditoría.

## Etapa 21 — Ayuda y contenido

- Tutorial inicial.
- FAQ.
- Ayudas contextuales.
- Tutoriales.
- Términos.
- Privacidad.
- Condiciones.
- Material afiliados.

## Etapa 22 — Seguridad y pruebas finales

Probar:
- RLS.
- permisos.
- pagos duplicados.
- pagos pendientes.
- reembolsos.
- vencimiento.
- upgrade.
- datos sobre límites.
- errores de red.
- sesiones.
- eliminación de cuenta.
- móvil.
- accesibilidad.
- errores visibles con códigos.

## Regla para Claude

Antes de cada etapa:
1. explicar objetivo;
2. listar archivos que creará/modificará;
3. pedir confirmación si existe una decisión pendiente;
4. implementar solamente la etapa;
5. indicar cómo probar;
6. corregir errores;
7. esperar confirmación antes de continuar.

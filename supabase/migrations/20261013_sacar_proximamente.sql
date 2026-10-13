-- Cálculo inverso, Moldes avanzados y Escalado avanzado figuraban como «Próximamente», pero lo que prometían ya
-- está gratis en la app (Precio rápido, medir el molde, ¿Cuánto preparo?). Se ocultan de la tienda; no se borran.
update public.modules set active = false, updated_at = now()
 where code in ('CALCULO_INVERSO', 'MOLDES_AVANZADOS', 'ESCALADO_AVANZADO');

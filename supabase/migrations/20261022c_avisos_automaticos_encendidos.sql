-- Etapa 2: se encienden los avisos automáticos que no dan descuento.
-- Los que dan descuento (free_discount y courtesy_ending) quedan apagados: dependen del margen de las revendedoras
-- y se encienden a mano desde Administración → Avisos emergentes.

update public.auto_notices set active = true,
  title = 'Tu Personal Plus está por terminar',
  body = 'Tu Personal Plus termina el {fin}. Si querés seguir con todo, elegí si continuás por mes o por año. Si no, tu cuenta vuelve sola a como estaba, sin borrar nada.',
  button_label = 'Ver cómo seguir', button_link = '/access#emprendedor'
 where code = 'plus_ending';

update public.auto_notices set active = true,
  body = 'Ya cargaste todo lo que entra en la versión gratis. Con la Edición Personal guardás hasta 100 materiales, 50 productos, 30 fórmulas y 30 moldes, con un solo pago. También podés probar Personal Plus gratis, sin límites.',
  button_label = 'Ver opciones', button_link = '/access#emprendedor'
 where code = 'free_limit';

update public.auto_notices set active = true where code in ('pack_suggest', 'welcome_back', 'anniversary');

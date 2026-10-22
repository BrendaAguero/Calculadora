-- Se aplica DESPUÉS de publicar el código que llama a estos formularios desde el servidor.
-- Los formularios públicos (comprar, arrepentimiento, baja) solo se pueden usar desde el servidor de la app,
--    donde corre el límite de intentos. Antes se podían llamar directo a la base y saltear ese límite.
revoke execute on function public.create_personal_order_v2(text, text, boolean) from public, anon, authenticated;
revoke execute on function public.submit_regret_request(text, text, text, date, text) from public, anon, authenticated;
revoke execute on function public.submit_cancellation_request(text, text, text) from public, anon, authenticated;
grant execute on function public.create_personal_order_v2(text, text, boolean) to service_role;
grant execute on function public.submit_regret_request(text, text, text, date, text) to service_role;
grant execute on function public.submit_cancellation_request(text, text, text) to service_role;


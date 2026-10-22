// Código de descuento guardado por un enlace /codigo/XXXX o escrito en la tienda.
export const PROMO_COOKIE = 'promo';
export const cleanCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);

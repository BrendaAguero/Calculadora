// Modo simple: menos opciones a la vista, botones grandes y lo opcional plegado.
// Se guarda en una cookie (la leen el servidor y el aparato). Si no hay cookie, está prendido.
export const SIMPLE_COOKIE = "modo-simple";
export const isSimpleValue = (value: string | undefined | null) => value !== "0";

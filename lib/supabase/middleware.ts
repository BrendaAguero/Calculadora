import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas que se pueden abrir sin sesión. /auth/* recibe los enlaces del correo: si se bloquea,
// la persona vuelve a /login sin que se procese el enlace y nunca puede crear su contraseña.
// Ayuda, legales y arrepentimiento son públicos: la ley pide que se puedan usar sin cuenta.
const PUBLIC_PATHS = ["/login", "/registro", "/conocer", "/equipo-ingreso", "/auth/", "/api/mercadopago/", "/api/push/enviar", "/r/", "/codigo/", "/ayuda", "/legal", "/arrepentimiento", "/baja", "/comprar", "/sw.js", "/manifest.webmanifest", "/offline.html", "/icons/"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: no agregar lógica entre createServerClient y getUser().
  // Un error ahí puede romper el refresco de sesión de forma difícil de debuggear.
  // getClaims verifica la sesión (y la renueva si venció) sin consultar al servidor en cada página
  // cuando la firma se puede comprobar acá; si no, consulta igual. Las páginas vuelven a validar con getUser.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: claimsData.claims.sub } : null;

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Si Supabase manda el enlace a otra página (por ejemplo a la raíz, cuando la dirección de
  // retorno no está permitida), se reenvía igual a /auth/callback para no perder el código.
  const authCode = request.nextUrl.searchParams.get("code");
  if (authCode && !request.nextUrl.pathname.startsWith("/auth/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    url.search = `?code=${encodeURIComponent(authCode)}`;
    return NextResponse.redirect(url);
  }

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    // Quien entra a la dirección principal sin cuenta ve la presentación de la app; el resto, el ingreso.
    url.pathname = request.nextUrl.pathname === "/" ? "/conocer" : "/login";
    return NextResponse.redirect(url);
  }

  if (user && (request.nextUrl.pathname.startsWith("/login") || request.nextUrl.pathname.startsWith("/registro"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

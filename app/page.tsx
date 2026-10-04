import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-50 px-6 text-center dark:bg-neutral-950">
      <h1 className="text-3xl font-semibold text-orange-800 dark:text-orange-300">
        Calculadora Emprender
      </h1>
      <p className="max-w-md text-neutral-600 dark:text-neutral-400">
        Sesión iniciada como {user?.email}. Etapa 3 (autenticación) completada.
      </p>
      <div className="flex gap-4 text-sm">
        <a className="underline" href="/profile">
          Mi perfil
        </a>
        <a className="underline" href="/preferences">
          Preferencias
        </a>
      </div>
    </main>
  );
}

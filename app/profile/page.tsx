import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { updateProfile } from "./actions";
import { signOut } from "../login/actions";
import { CONTACT_EMAIL } from "@/lib/legal";
import { AppLockSettings } from "@/components/app-lock-settings";
import { signOutEverywhere } from "../seguridad/actions";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">Mi perfil</h1>
      <form action={updateProfile} className="space-y-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="full_name">
            Nombre
          </label>
          <input
            id="full_name"
            name="full_name"
            defaultValue={profile?.full_name ?? ""}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <span className="block text-sm font-medium">Email</span>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">
            {profile?.email}
          </p>
        </div>
        <button
          type="submit"
          className="rounded-md bg-orange-800 px-4 py-2 text-white"
        >
          Guardar
        </button>
      </form>

      <AppLockSettings name={profile?.email ?? user.email ?? "Calculadora Emprender"} />

      <section className="mt-8 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <h2 className="font-semibold">Cerrar sesión en todos mis aparatos</h2>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">Si perdiste un aparato o creés que alguien más usa tu cuenta. Después entrás de nuevo con tu clave.</p>
        <form action={signOutEverywhere} className="mt-3"><button className="rounded-md border border-red-300 px-3 py-1.5 text-red-700 dark:border-red-900 dark:text-red-300">Cerrar en todos</button></form>
      </section>

      <section className="mt-8 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <h2 className="font-semibold">Eliminar mi cuenta</h2>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">Mandanos el pedido desde el email de tu cuenta. Borramos tus datos en 5 días hábiles; los registros de compras se conservan por obligación legal. <Link href="/legal/privacidad" className="underline">Más información</Link>.</p>
        <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Eliminar mi cuenta")}&body=${encodeURIComponent(`Hola, quiero eliminar mi cuenta de Calculadora Emprender (${user.email ?? ""}).`)}`} className="mt-3 inline-block rounded-md border border-red-300 px-3 py-1.5 text-red-700 dark:border-red-900 dark:text-red-300">Pedir la eliminación</a>
      </section>

      <form action={signOut} className="mt-8">
        <button type="submit" className="text-sm text-neutral-500 underline">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}

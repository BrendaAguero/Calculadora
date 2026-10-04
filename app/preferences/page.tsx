import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { updatePreferences } from "./actions";

export default async function PreferencesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("theme, currency, default_margin, default_markup")
    .eq("user_id", user.id)
    .single();

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">Preferencias</h1>
      <form action={updatePreferences} className="space-y-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="theme">
            Tema
          </label>
          <select
            id="theme"
            name="theme"
            defaultValue={preferences?.theme ?? "system"}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          >
            <option value="light">Diurno</option>
            <option value="dark">Nocturno</option>
            <option value="system">Sistema</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="currency">
            Moneda
          </label>
          <input
            id="currency"
            name="currency"
            defaultValue={preferences?.currency ?? "ARS"}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="default_margin">
            Margen por defecto (%)
          </label>
          <input
            id="default_margin"
            name="default_margin"
            type="number"
            step="0.01"
            defaultValue={preferences?.default_margin ?? ""}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="default_markup">
            Markup por defecto (%)
          </label>
          <input
            id="default_markup"
            name="default_markup"
            type="number"
            step="0.01"
            defaultValue={preferences?.default_markup ?? ""}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-orange-800 px-4 py-2 text-white"
        >
          Guardar
        </button>
      </form>
    </main>
  );
}

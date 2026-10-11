import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { updatePreferences } from "./actions";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function PreferencesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("currency, default_margin, default_markup, auto_deduct_stock")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold">Preferencias</h1>
      <form action={updatePreferences} className="space-y-4">
        <ThemeToggle />
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
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="auto_deduct_stock" defaultChecked={preferences?.auto_deduct_stock ?? false} className="mt-1" />
          <span>Al registrar una producción, proponer descontar los materiales del stock. En cada producción podés elegir no descontar.</span>
        </label>
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

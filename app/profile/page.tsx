import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { updateProfile } from "./actions";
import { signOut } from "../login/actions";

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

      <form action={signOut} className="mt-8">
        <button type="submit" className="text-sm text-neutral-500 underline">
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}

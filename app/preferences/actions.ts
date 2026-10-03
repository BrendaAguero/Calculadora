"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updatePreferences(formData: FormData) {
  const theme = String(formData.get("theme") || "system");
  const currency = String(formData.get("currency") || "ARS");
  const defaultMarginRaw = formData.get("default_margin");
  const defaultMarkupRaw = formData.get("default_markup");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("user_preferences")
    .update({
      theme,
      currency,
      default_margin: defaultMarginRaw ? Number(defaultMarginRaw) : null,
      default_markup: defaultMarkupRaw ? Number(defaultMarkupRaw) : null,
    })
    .eq("user_id", user.id);

  revalidatePath("/preferences");
}

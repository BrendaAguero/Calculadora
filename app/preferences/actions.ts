"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updatePreferences(formData: FormData) {
  const currency = String(formData.get("currency") || "ARS");
  const defaultMarginRaw = formData.get("default_margin");
  const defaultMarkupRaw = formData.get("default_markup");
  const autoDeductStock = formData.get("auto_deduct_stock") === "on";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  // upsert: si la cuenta todavía no tiene fila de preferencias, se crea.
  await supabase
    .from("user_preferences")
    .upsert({
      user_id: user.id,
      currency,
      default_margin: defaultMarginRaw ? Number(defaultMarginRaw) : null,
      default_markup: defaultMarkupRaw ? Number(defaultMarkupRaw) : null,
      auto_deduct_stock: autoDeductStock,
    }, { onConflict: "user_id" });

  revalidatePath("/preferences");
}

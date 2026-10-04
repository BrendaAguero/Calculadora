"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function createFormula(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") || "").trim();
  const category = String(formData.get("category") || "").trim() || null;
  const activityId = String(formData.get("activity_id") || "");
  const notes = String(formData.get("notes") || "").trim() || null;
  const photoUrl = String(formData.get("photo_url") || "").trim() || null;
  const yieldQuantity = Number(formData.get("yield_quantity") || 1);
  const waterPercentageRaw = String(formData.get("water_percentage") || "").trim();
  const waterPercentage = waterPercentageRaw ? Number(waterPercentageRaw) : null;

  if (!name || !activityId || !Number.isFinite(yieldQuantity) || yieldQuantity <= 0) return;

  const { data: formula, error } = await supabase.from("formulas").insert({
    user_id: user.id, activity_id: activityId, name, category, notes, photo_url: photoUrl, status: "active"
  }).select("id").single();
  if (error || !formula) throw new Error(error?.message || "No se pudo crear la fórmula.");

  const { data: version, error: versionError } = await supabase.from("formula_versions").insert({
    formula_id: formula.id, version_number: 1, water_percentage: waterPercentage,
    yield_quantity: yieldQuantity, notes, created_by: user.id
  }).select("id").single();
  if (versionError || !version) throw new Error(versionError?.message || "No se pudo crear la versión.");

  await supabase.from("formulas").update({ current_version_id: version.id }).eq("id", formula.id).eq("user_id", user.id);
  redirect(`/formulas/${formula.id}`);
}

export async function createVersion(formData: FormData) {
  const { supabase, user } = await requireUser();
  const formulaId = String(formData.get("formula_id") || "");
  const notes = String(formData.get("notes") || "").trim() || null;
  const yieldQuantity = Number(formData.get("yield_quantity") || 1);
  const waterPercentageRaw = String(formData.get("water_percentage") || "").trim();
  const waterPercentage = waterPercentageRaw ? Number(waterPercentageRaw) : null;
  if (!formulaId || !Number.isFinite(yieldQuantity) || yieldQuantity <= 0) return;

  const { data: formula } = await supabase.from("formulas").select("id").eq("id", formulaId).eq("user_id", user.id).single();
  if (!formula) throw new Error("Fórmula no encontrada.");
  const { data: last } = await supabase.from("formula_versions").select("version_number").eq("formula_id", formulaId).order("version_number", { ascending: false }).limit(1).maybeSingle();
  const nextNumber = (last?.version_number ?? 0) + 1;
  const { data: version, error } = await supabase.from("formula_versions").insert({ formula_id: formulaId, version_number: nextNumber, water_percentage: waterPercentage, yield_quantity: yieldQuantity, notes, created_by: user.id }).select("id").single();
  if (error || !version) throw new Error(error?.message || "No se pudo crear la versión.");
  await supabase.from("formulas").update({ current_version_id: version.id }).eq("id", formulaId).eq("user_id", user.id);
  redirect(`/formulas/${formulaId}`);
}

export async function archiveFormula(formData: FormData) {
  const { supabase, user } = await requireUser();
  const formulaId = String(formData.get("formula_id") || "");
  await supabase.from("formulas").update({ status: "archived" }).eq("id", formulaId).eq("user_id", user.id);
  redirect("/formulas");
}

export async function duplicateFormula(formData: FormData) {
  const { supabase, user } = await requireUser();
  const formulaId = String(formData.get("formula_id") || "");
  const { data: source } = await supabase.from("formulas").select("*").eq("id", formulaId).eq("user_id", user.id).single();
  if (!source) throw new Error("Fórmula no encontrada.");
  const { data: copy, error } = await supabase.from("formulas").insert({ user_id: user.id, activity_id: source.activity_id, name: `${source.name} (copia)`, category: source.category, photo_url: source.photo_url, notes: source.notes, status: "active" }).select("id").single();
  if (error || !copy) throw new Error(error?.message || "No se pudo duplicar.");
  const { data: version } = await supabase.from("formula_versions").select("*").eq("id", source.current_version_id).single();
  if (version) {
    const { data: newVersion } = await supabase.from("formula_versions").insert({ formula_id: copy.id, version_number: 1, water_percentage: version.water_percentage, yield_quantity: version.yield_quantity, notes: version.notes, created_by: user.id }).select("id").single();
    if (newVersion) {
      await supabase.from("formula_items").select("material_id,ingredient_type,quantity,unit,percentage,notes").eq("formula_version_id", version.id).then(async ({ data: items }) => {
        if (items?.length) await supabase.from("formula_items").insert(items.map(item => ({ ...item, formula_version_id: newVersion.id })));
      });
      await supabase.from("formulas").update({ current_version_id: newVersion.id }).eq("id", copy.id);
    }
  }
  redirect(`/formulas/${copy.id}`);
}

export async function saveVersionItems(formData: FormData) {
  const { supabase, user } = await requireUser();
  const formulaId = String(formData.get("formula_id") || "");
  const versionId = String(formData.get("version_id") || "");
  const { data: formula } = await supabase.from("formulas").select("id").eq("id", formulaId).eq("user_id", user.id).single();
  if (!formula) throw new Error("Fórmula no encontrada.");
  const { error: deleteError } = await supabase.from("formula_items").delete().eq("formula_version_id", versionId);
  if (deleteError) throw new Error(deleteError.message);

  const rows: Record<string, unknown>[] = [];
  const count = Number(formData.get("item_count") || 0);
  for (let i = 0; i < count; i++) {
    const type = String(formData.get(`ingredient_type_${i}`) || "material");
    const quantity = Number(formData.get(`quantity_${i}`) || 0);
    const unit = String(formData.get(`unit_${i}`) || "g");
    const materialId = String(formData.get(`material_id_${i}`) || "").trim() || null;
    const percentageRaw = String(formData.get(`percentage_${i}`) || "").trim();
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    rows.push({ formula_version_id: versionId, material_id: materialId, ingredient_type: type, quantity, unit, percentage: percentageRaw ? Number(percentageRaw) : null });
  }
  if (rows.length) {
    const { error } = await supabase.from("formula_items").insert(rows);
    if (error) throw new Error(error.message);
  }
  redirect(`/formulas/${formulaId}`);
}

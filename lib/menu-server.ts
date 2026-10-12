import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { MENU_SECTIONS, type MenuSection } from "@/lib/nav";

export type MenuState = { used: Partial<Record<MenuSection, boolean>>; choices: Partial<Record<MenuSection, boolean>> };

// Estado del menú a medida (una sola consulta por pantalla).
export const getMenuState = cache(async (): Promise<MenuState | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_menu_state");
  if (error || !data) return null;
  return data as MenuState;
});

// Una sección se ve si la persona eligió verla, o si ya la usó y no eligió ocultarla.
export const isShown = (state: MenuState, section: MenuSection) => state.choices[section] ?? Boolean(state.used[section]);

export async function getHiddenSections(): Promise<MenuSection[]> {
  const state = await getMenuState();
  // Sin sesión o si falla la consulta, no se oculta nada.
  if (!state) return [];
  return MENU_SECTIONS.filter((section) => !isShown(state, section));
}

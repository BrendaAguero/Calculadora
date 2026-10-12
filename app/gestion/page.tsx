import { redirect } from "next/navigation";

// «Gestión» repetía el menú: ahora todo está en el menú y en «Más».
export default function GestionPage() {
  redirect("/mas");
}

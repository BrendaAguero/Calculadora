import { redirect } from "next/navigation";

// «Mis datos» repetía el menú: ahora todo está en el menú y en «Más».
export default function MisDatosPage() {
  redirect("/mas");
}

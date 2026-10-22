import "server-only";
import { CONTACT_EMAIL } from "@/lib/legal";
import { sendMail } from "@/lib/mail";

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const paragraphs = (lines: string[]) => lines.map((line) => `<p>${escape(line)}</p>`).join("");

// Aviso a la administración (llega al correo de contacto de la app).
export async function notifyAdmin(subject: string, lines: string[]) {
  return sendMail({ to: CONTACT_EMAIL, subject: `[Calculadora] ${subject}`, text: lines.join("\n"), html: paragraphs(lines) });
}

const KINDS = {
  arrepentimiento: { title: "Recibimos tu pedido de arrepentimiento", what: "tu pedido para arrepentirte de la compra" },
  baja: { title: "Recibimos tu pedido de baja", what: "tu pedido de baja" },
  bajaHecha: { title: "Tu suscripción quedó dada de baja", what: "la baja de tu suscripción (ya no se renueva)" },
} as const;

// Constancia para la persona, con el código que le mostramos en pantalla.
export async function sendRequestReceipt(to: string, kind: keyof typeof KINDS, code: string) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return false;
  const { title, what } = KINDS[kind];
  const lines = [
    "¡Hola!",
    `Te confirmamos que recibimos ${what} en Calculadora Emprender.`,
    `Tu código de constancia es: ${code}`,
    "Guardá este correo. Si tenés dudas, respondé a este mensaje o escribinos a " + CONTACT_EMAIL + ".",
  ];
  return sendMail({ to, subject: `${title} · código ${code}`, text: lines.join("\n\n"), html: paragraphs(lines) });
}

// Aviso a una afiliada (aprobación, retiros). No incluye datos de quien compró.
export async function notifyAffiliate(to: string | null | undefined, subject: string, lines: string[]) {
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return false;
  const all = ["¡Hola!", ...lines, "Lo ves todo en «Programa de afiliadas», dentro de la app. Si tenés dudas, escribinos a " + CONTACT_EMAIL + "."];
  return sendMail({ to, subject: `${subject} · Calculadora Emprender`, text: all.join("\n\n"), html: paragraphs(all) });
}

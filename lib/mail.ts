import "server-only";
import nodemailer from "nodemailer";

// Correos propios de la app (por ejemplo, la clave de acceso), enviados con el Gmail de la app.
// Usa SMTP_USER y SMTP_PASS (contraseña de aplicación de Gmail): solo en el servidor.
function transport(user: string, pass: string) {
  return nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass: pass.replace(/\s/g, "") } });
}

export async function sendMail(message: { to: string; subject: string; text: string; html: string }) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return false;
  try {
    await transport(user, pass).sendMail({ from: `"Calculadora Emprender" <${user}>`, ...message });
    return true;
  } catch (error) {
    console.error("No se pudo enviar el correo", error instanceof Error ? error.message : error);
    return false;
  }
}

export const mailReady = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

// Prueba la conexión con Gmail sin mandar ningún correo (para el diagnóstico de administración).
export async function verifyMail() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return { configured: false, user: Boolean(user), pass: Boolean(pass) };
  try {
    await transport(user, pass).verify();
    return { configured: true, login: "ok" };
  } catch (error) {
    return { configured: true, login: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

import { LoginForm } from "./login-form";

// Mensajes para los errores que devuelve /auth/callback cuando un enlace del correo no sirve.
const LINK_ERRORS: Record<string, string> = {
  invalid_or_expired_link: "El enlace ya se usó o venció. Pedí uno nuevo.",
  other_browser: "Abriste el enlace en otro navegador o dispositivo. Pedí uno nuevo y abrilo en el mismo navegador donde lo pediste.",
  missing_code: "El enlace está incompleto. Pedí uno nuevo.",
  device_limit: "Ya usás la app en todos tus aparatos. Liberá uno desde «Mi acceso» en otro aparato, comprá un «Aparato extra» o escribinos.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  return <LoginForm linkError={error ? LINK_ERRORS[error] ?? (error.length > 40 ? error.slice(0, 300) : "No se pudo usar el enlace. Pedí uno nuevo.") : null} okMessage={ok ? ok.slice(0, 300) : null} />;
}

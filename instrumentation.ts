import type { Instrumentation } from "next";

// Errores del servidor: quedan guardados en error_logs y avisan por correo a la administración
// (como mucho un correo por hora, para no llenar la casilla). Nunca se guardan cookies ni encabezados.
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { reportServerError } = await import("@/lib/error-report");
    await reportServerError(err, request, context);
  } catch (error) {
    console.error("[errores] no se pudo registrar", error instanceof Error ? error.message : error);
  }
};

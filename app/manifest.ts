import type { MetadataRoute } from "next";

// Permite instalar la app: ícono propio en el celular y ventana propia en la computadora.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Calculadora Emprender",
    short_name: "Calculadora",
    description: "Calculadora y gestión para emprendedoras de yeso, resina y más.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fafafa",
    theme_color: "#c2410c",
    lang: "es-AR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Calcular", url: "/calcular" },
      { name: "Nueva venta", url: "/ventas/nueva" },
      { name: "Stock", url: "/stock" },
    ],
  };
}

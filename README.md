# Calculadora Emprender

Aplicación web para emprendedores que fabrican y venden productos (Yeso, Resina, Jesmonite, Cemento decorativo): cálculo de costos y precios, fórmulas, moldes, producción, stock, ventas, proveedores y estadísticas.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (Auth, Postgres, Storage, Row Level Security)
- Vercel
- Mercado Pago

## Documentación del proyecto

- `PROMPT_MAESTRO.md` — reglas de negocio y producto.
- `SUPABASE_SCHEMA.md` — modelo de datos.
- `ROADMAP.md` — plan de etapas de construcción.

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar con las credenciales reales de Supabase. `.env.local` nunca se sube a git (ya está en `.gitignore`).

## Desarrollo local

\`\`\`
npm install
npm run dev
\`\`\`

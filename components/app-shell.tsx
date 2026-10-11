import { FreeBanner } from "@/components/free-banner";

// Contenedor de las pantallas principales (el menú lo pone AppFrame en el layout).
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto min-h-screen max-w-xl px-4 pb-8 pt-6 sm:px-6 lg:max-w-4xl lg:pt-10">
        <FreeBanner />
        {children}
      </div>
    </div>
  );
}

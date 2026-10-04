import { BottomNav } from "@/components/bottom-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="mx-auto min-h-screen max-w-xl px-4 pb-24 pt-6 sm:px-6">{children}</div>
      <BottomNav />
    </div>
  );
}

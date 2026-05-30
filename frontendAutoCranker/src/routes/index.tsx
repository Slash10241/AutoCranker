import { createFileRoute, Link } from "@tanstack/react-router";
import { Wrench, ArrowRight } from "lucide-react";
import { Brand } from "@/components/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AutoCranker — Your garage. Transparent. On time." },
      { name: "description", content: "Modern garage management. Track repairs, build estimates, manage your shop." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Brand />
        <nav className="hidden gap-6 font-mono text-xs uppercase tracking-widest text-muted-foreground md:flex">
          <span>v1.0</span><span>BETA</span>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-12 pb-24">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber">// Garage management</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-bold leading-[1.05] md:text-7xl">
          Run your shop.<br />
          <span className="text-amber">Transparent.</span> On time.
        </h1>
        <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
          One workspace for mechanics and shop owners. Manage cases on a board,
          build estimates, schedule jobs, and watch your numbers.
        </p>

        <div className="mt-16 max-w-xl">
          <Link
            to="/login"
            className="group relative block overflow-hidden rounded-2xl border border-border bg-surface p-8 transition-all hover:border-amber/60 hover:bg-surface-2"
          >
            <div className="absolute inset-0 grain pointer-events-none" />
            <div className="relative">
              <div className="flex items-start justify-between">
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-amber/10 text-amber ring-1 ring-amber/30">
                  <Wrench className="h-6 w-6" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">For shops</span>
              </div>
              <h2 className="mt-8 text-3xl font-bold">Enter the Garage</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Manage cases on a board, build estimates, schedule jobs, and watch your numbers.
              </p>
              <div className="mt-8 inline-flex items-center gap-2 rounded-md bg-amber px-4 py-2 text-sm font-semibold text-[color:var(--amber-foreground)] transition-transform group-hover:translate-x-1">
                Get Started <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </Link>
        </div>
      </main>

      <footer className="border-t border-border/60 py-6 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Built for grease, gears & good service.
      </footer>
    </div>
  );
}

import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { ThemeToggle } from "./theme-toggle";
import { LogOut, Menu, X, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GARAGE_NAME } from "@/lib/mock-data";

export type NavItem = { to: string; label: string; icon: ReactNode; badge?: number };

export function DashboardShell({ items, title }: { items: NavItem[]; title: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-border bg-sidebar transition-transform md:relative md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Brand />
          <button className="md:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="h-3.5 w-3.5 text-amber" />
            {GARAGE_NAME}
          </div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
        </div>
        <nav className="space-y-1 px-3">
          {items.map((it) => {
            const active = pathname === it.to || (it.to !== "/owner" && pathname.startsWith(it.to));
            const isIndex = it.to === "/owner";
            const isActive = isIndex ? pathname === it.to : active;
            return (
              <Link
                key={it.to}
                to={it.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-amber/15 text-amber"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-3">
                  {it.icon}{it.label}
                </span>
                {it.badge ? (
                  <span className="rounded-full bg-amber px-2 py-0.5 text-[10px] font-bold text-[color:var(--amber-foreground)]">{it.badge}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-border p-3">
          <Button
            variant="ghost" size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => navigate({ to: "/" })}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-8">
          <button className="md:hidden" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <div className="hidden font-mono text-xs uppercase tracking-widest text-muted-foreground md:block">{title}</div>
          <ThemeToggle />
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div key={pathname} className="animate-in fade-in duration-300">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, icon }: { title: string; body: string; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/50 p-12 text-center">
      {icon && <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">{icon}</div>}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { GARAGE_NAME } from "@/lib/mock-data";
import { PageHeader } from "@/components/dashboard-shell";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, DollarSign, Clock, CheckCircle2, FolderOpen, Package } from "lucide-react";
import { formatDateTimeUTC } from "@/lib/format-date";

export const Route = createFileRoute("/owner/")({
  component: OwnerHome,
});

function OwnerHome() {
  const { state } = useStore();
  const open = state.cases.filter((c) => c.status !== "Completed" && c.status !== "Cancelled");
  const ready = state.cases.filter((c) => c.status === "Ready for Pickup");
  const lowStock = state.inventory.filter((p) => p.stock <= p.reorderLevel);
  const stalledApprovals = state.cases.filter((c) => c.status === "Awaiting Customer Approval");
  const today = new Date().toISOString().slice(0, 10);
  const todays = state.appointments.filter((a) => a.date === today);

  const revenueWeek = 4860; // mock
  const activity = [...state.cases]
    .flatMap((c) => c.timeline.map((t) => ({ ...t, caseId: c.id })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 5);

  return (
    <div>
      <PageHeader title={`Good morning, ${GARAGE_NAME}`} subtitle="Here's your shop at a glance." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={<FolderOpen className="h-4 w-4" />} label="Open cases" value={open.length.toString()} />
        <Kpi icon={<DollarSign className="h-4 w-4" />} label="Revenue this week" value={`$${revenueWeek.toLocaleString()}`} />
        <Kpi icon={<Clock className="h-4 w-4" />} label="Avg turnaround" value="2.1 days" />
        <Kpi icon={<CheckCircle2 className="h-4 w-4" />} label="Ready for pickup" value={ready.length.toString()} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="bg-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber" /> Cases needing attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stalledApprovals.map((c) => {
              const v = state.vehicles.find((x) => x.id === c.vehicleId)!;
              const cu = state.customers.find((x) => x.id === c.customerId)!;
              return (
                <Link key={c.id} to="/owner/cases" className="flex items-center justify-between rounded-md border border-amber/30 bg-amber/5 px-4 py-3 hover:bg-amber/10">
                  <div>
                    <div className="text-sm font-medium">Customer estimate pending — {cu.name}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{c.id} · {v.year} {v.make} {v.model}</div>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              );
            })}
            {stalledApprovals.length === 0 && (
              <p className="font-mono text-xs text-muted-foreground">No cases need attention.</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4 text-destructive" /> Inventory alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStock.map((p) => (
              <Link key={p.id} to="/owner/inventory" className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 hover:bg-destructive/10">
                <div>
                  <div className="text-sm font-medium">Low stock: {p.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">SKU {p.sku} · {p.stock} on hand / reorder at {p.reorderLevel}</div>
                </div>
                <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 font-mono text-[10px] uppercase text-destructive">Reorder</span>
              </Link>
            ))}
            {lowStock.length === 0 && (
              <p className="font-mono text-xs text-muted-foreground">Stock levels look good.</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-surface">
          <CardHeader><CardTitle className="text-base">Activity</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-3 border-l border-border pl-4">
              {activity.map((a, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full bg-amber" />
                  <div className="text-sm">{a.label}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{a.caseId} · {formatDateTimeUTC(a.at)}</div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 bg-surface">
        <CardHeader><CardTitle className="text-base">Today's schedule</CardTitle></CardHeader>
        <CardContent>
          {todays.length === 0 ? (
            <p className="font-mono text-xs text-muted-foreground">No appointments today.</p>
          ) : (
            <ul className="divide-y divide-border">
              {todays.map((a) => {
                const v = state.vehicles.find((x) => x.id === a.vehicleId)!;
                const c = state.customers.find((x) => x.id === a.customerId)!;
                const m = a.mechanicId ? state.mechanics.find((x) => x.id === a.mechanicId) : null;
                return (
                  <li key={a.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-4">
                      <div className="rounded-md bg-amber/15 px-3 py-1 font-mono text-sm text-amber">{a.time}</div>
                      <div>
                        <div className="text-sm font-medium">{a.service} — {c.name}</div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{v.year} {v.make} {v.model} · {m ? `Tech: ${m.initials}` : "Unassigned"}</div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="bg-surface">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="text-amber">{icon}</span>{label}
        </div>
        <div className="mt-2 font-display text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

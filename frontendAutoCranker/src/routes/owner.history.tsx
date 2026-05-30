import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/dashboard-shell";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Download, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDateTimeUTC } from "@/lib/format-date";

export const Route = createFileRoute("/owner/history")({
  component: OwnerHistory,
});

function OwnerHistory() {
  const { state } = useStore();
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [customer, setCustomer] = useState("all");
  const [mechanic, setMechanic] = useState("all");
  const [vehicle, setVehicle] = useState("all");

  const rows = state.cases.filter((c) =>
    (customer === "all" || c.customerId === customer) &&
    (mechanic === "all" || c.mechanicId === mechanic) &&
    (vehicle === "all" || c.vehicleId === vehicle)
  );

  return (
    <div>
      <PageHeader title="Case history" subtitle="All cases across all customers." action={
        <Button variant="outline" onClick={() => toast("Export started", { description: "Your CSV will download shortly." })}>
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      } />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select value={customer} onValueChange={setCustomer}>
          <SelectTrigger><SelectValue placeholder="Customer" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            {state.customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={mechanic} onValueChange={setMechanic}>
          <SelectTrigger><SelectValue placeholder="Mechanic" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All mechanics</SelectItem>
            {state.mechanics.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={vehicle} onValueChange={setVehicle}>
          <SelectTrigger><SelectValue placeholder="Vehicle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All vehicles</SelectItem>
            {state.vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-surface">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Case</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Vehicle</th>
                  <th className="px-4 py-3 text-left">Service</th>
                  <th className="px-4 py-3 text-left">Mechanic</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Cost</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const v = state.vehicles.find((x) => x.id === c.vehicleId)!;
                  const cu = state.customers.find((x) => x.id === c.customerId)!;
                  const m = state.mechanics.find((x) => x.id === c.mechanicId)!;
                  const cost = c.lineItems.reduce((s, li) => s + li.qty * li.unitCost, 0);
                  const isOpen = openRow === c.id;
                  return (
                    <Fragment key={c.id}>
                      <tr className="border-t border-border hover:bg-surface-2/50">
                        <td className="px-4 py-3 font-mono text-xs">{c.id}</td>
                        <td className="px-4 py-3">{cu.name}</td>
                        <td className="px-4 py-3">{v.year} {v.make} {v.model}</td>
                        <td className="px-4 py-3 max-w-xs truncate">{c.service}</td>
                        <td className="px-4 py-3">{m.name}</td>
                        <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                        <td className="px-4 py-3 text-right font-mono">${cost.toFixed(2)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              to="/owner/cases/$caseId"
                              params={{ caseId: c.id }}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:border-amber/60 hover:text-amber"
                            >
                              Open <ExternalLink className="h-3 w-3" />
                            </Link>
                            <button onClick={() => setOpenRow(isOpen ? null : c.id)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Toggle row">
                              <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-t border-border bg-surface-2/30">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="grid gap-6 md:grid-cols-2">
                              <div>
                                <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Notes</h4>
                                <p className="mt-1 text-sm">{c.notes || "—"}</p>
                                <h4 className="mt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Internal</h4>
                                <p className="mt-1 text-sm">{c.internalNotes || "—"}</p>
                              </div>
                              <div>
                                <h4 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Timeline</h4>
                                <ol className="mt-2 space-y-2 border-l border-border pl-3">
                                  {c.timeline.map((t, i) => (
                                    <li key={i} className="relative">
                                      <span className="absolute -left-[15px] top-1.5 h-2 w-2 rounded-full bg-amber" />
                                      <div className="font-mono text-[10px] uppercase text-muted-foreground">{formatDateTimeUTC(t.at)}</div>
                                      <div className="text-sm">{t.label}</div>
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No matches.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

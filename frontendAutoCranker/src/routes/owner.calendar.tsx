import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/dashboard-shell";
import { MonthCalendar } from "@/components/month-calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/calendar")({
  component: OwnerCalendar,
});

const SERVICES = ["Oil change", "Brake job", "Diagnostic", "Tire rotation", "AC service", "Battery", "Inspection"];

function OwnerCalendar() {
  const { state, update } = useStore();
  const [selected, setSelected] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [open, setOpen] = useState(false);
  const marked = state.appointments.map((a) => a.date);
  const dayAppts = state.appointments.filter((a) => a.date === selected);
  const eventsByDate = state.appointments.reduce<Record<string, { id: string; time?: string; label: string }[]>>((acc, a) => {
    const v = state.vehicles.find((x) => x.id === a.vehicleId);
    const label = v ? `${a.service} · ${v.make} ${v.model}` : a.service;
    (acc[a.date] ||= []).push({ id: a.id, time: a.time, label });
    return acc;
  }, {});
  Object.values(eventsByDate).forEach((list) => list.sort((x, y) => (x.time ?? "").localeCompare(y.time ?? "")));

  const add = (form: FormData) => {
    const a = {
      id: "a" + Date.now(),
      customerId: form.get("customer") as string,
      vehicleId: form.get("vehicle") as string,
      service: form.get("service") as string,
      date: form.get("date") as string,
      time: form.get("time") as string,
      mechanicId: form.get("mechanic") as string,
      status: "confirmed" as const,
    };
    update((s) => ({ ...s, appointments: [...s.appointments, a] }));
    toast.success("Appointment added");
    setOpen(false);
  };

  return (
    <div>
      <PageHeader title="Calendar" subtitle="All shop appointments." action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber text-[color:var(--amber-foreground)] hover:bg-amber/90"><Plus className="mr-2 h-4 w-4" /> Add appointment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New appointment</DialogTitle></DialogHeader>
            <form action={add} className="space-y-3">
              <div>
                <Label>Customer</Label>
                <Select name="customer" defaultValue={state.customers[0].id}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{state.customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vehicle</Label>
                <Select name="vehicle" defaultValue={state.vehicles[0].id}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{state.vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Service</Label>
                <Select name="service" defaultValue={SERVICES[0]}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{SERVICES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Date</Label><Input name="date" type="date" defaultValue={selected} className="mt-1" /></div>
                <div><Label>Time</Label><Input name="time" type="time" defaultValue="10:00" className="mt-1" /></div>
              </div>
              <div>
                <Label>Technician</Label>
                <Select name="mechanic" defaultValue={state.mechanics[0].id}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{state.mechanics.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <DialogFooter><Button type="submit" className="bg-amber text-[color:var(--amber-foreground)]">Save</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      } />
      <div className="grid gap-6 lg:grid-cols-[1fr,360px]">
        <MonthCalendar markedDates={marked} events={eventsByDate} selected={selected} onSelectDate={setSelected} />
        <div className="space-y-3">
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {new Date(selected).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </h3>
          {dayAppts.length === 0 ? (
            <Card className="bg-surface"><CardContent className="p-6 text-center font-mono text-xs text-muted-foreground">No appointments.</CardContent></Card>
          ) : (
            dayAppts.map((a) => {
              const v = state.vehicles.find((x) => x.id === a.vehicleId)!;
              const c = state.customers.find((x) => x.id === a.customerId)!;
              return (
                <Card key={a.id} className="bg-surface">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-amber">{a.time}</div>
                      <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                        a.status === "confirmed" ? "border-success/40 bg-success/10 text-[color:var(--success)]"
                        : a.status === "pending" ? "border-amber/40 bg-amber/10 text-amber"
                        : "border-border text-muted-foreground"
                      }`}>{a.status}</span>
                    </div>
                    <div className="mt-2 font-display text-base font-semibold">{a.service}</div>
                    <div className="font-mono text-xs text-muted-foreground">{c.name} · {v.year} {v.make} {v.model}</div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

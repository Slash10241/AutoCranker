import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  seedCases, seedCustomers, seedMechanics, seedVehicles,
  seedAppointments, seedInventory, seedNotifications,
  type Case, type Customer, type Mechanic, type Vehicle,
  type Appointment, type Part, type Notification, type CaseStatus,
} from "./mock-data";

const KEY = "garageos.v1";

type State = {
  cases: Case[];
  customers: Customer[];
  mechanics: Mechanic[];
  vehicles: Vehicle[];
  appointments: Appointment[];
  inventory: Part[];
  notifications: Notification[];
  currentCustomerId: string;
};

const initial: State = {
  cases: seedCases,
  customers: seedCustomers,
  mechanics: seedMechanics,
  vehicles: seedVehicles,
  appointments: seedAppointments,
  inventory: seedInventory,
  notifications: seedNotifications,
  currentCustomerId: "c1",
};

type Ctx = {
  state: State;
  update: (fn: (s: State) => State) => void;
};

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...initial, ...JSON.parse(raw) });
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const update = (fn: (s: State) => State) => setState((s) => fn(s));

  return <StoreCtx.Provider value={{ state, update }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore outside provider");
  return ctx;
}

export function statusColor(s: CaseStatus): string {
  switch (s) {
    case "Incoming": return "bg-info/15 text-[color:var(--info)] border-[color:var(--info)]/30";
    case "In Progress": return "bg-amber/15 text-amber border-amber/30";
    case "Awaiting Customer Approval": return "bg-destructive/15 text-destructive border-destructive/30";
    case "Ready for Pickup": return "bg-success/15 text-[color:var(--success)] border-[color:var(--success)]/30";
    case "Completed": return "bg-muted text-muted-foreground border-border";
    case "Cancelled": return "bg-muted text-muted-foreground border-border line-through";
  }
}

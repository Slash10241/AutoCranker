export type CaseStatus =
  | "Incoming"
  | "In Progress"
  | "Awaiting Customer Approval"
  | "Ready for Pickup"
  | "Completed"
  | "Cancelled";

export const CASE_STATUSES: CaseStatus[] = [
  "Incoming",
  "In Progress",
  "Awaiting Customer Approval",
  "Ready for Pickup",
  "Completed",
  "Cancelled",
];

export const PIPELINE_STEPS = [
  "Check-in",
  "Diagnosis",
  "Awaiting Your Approval",
  "In Repair",
  "Ready for Pickup",
] as const;

export type LineItem = { id: string; name: string; qty: number; unitCost: number; type: "part" | "labor" };
export type TimelineEntry = { at: string; label: string };
export type Vehicle = {
  id: string;
  customerId: string;
  year: number;
  make: string;
  model: string;
  plate: string;
  vin: string;
  lastService: string;
};
export type Customer = { id: string; name: string; email: string; phone: string };
export type Mechanic = { id: string; name: string; initials: string };
export type Notification = { id: string; title: string; body: string; at: string; read: boolean };
export type ChatMessage = { id: string; from: "customer" | "ai"; text: string; at: string };
export type Appointment = {
  id: string;
  customerId: string;
  vehicleId: string;
  service: string;
  date: string; // ISO date
  time: string; // HH:mm
  mechanicId?: string;
  status: "confirmed" | "pending" | "cancelled";
};
export type Part = {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  reorderLevel: number;
  unitCost: number;
  supplier: string;
};

export type Case = {
  id: string;
  customerId: string;
  vehicleId: string;
  service: string;
  mechanicId: string;
  status: CaseStatus;
  pipelineStep: number; // 0-4
  daysOpen: number;
  createdAt: string;
  lineItems: LineItem[];
  notes: string;
  internalNotes: string;
  timeline: TimelineEntry[];
  /** Backend integer ID — present only for cases loaded from the API. */
  _backendId?: number;
  /** Backend phone_number / session_id — used to load WhatsApp chat history. */
  _customerPhone?: string;
  /** Technician's raw inspection notes (local only, not persisted to backend). */
  inspectionReport?: string;
  /** AI-generated chat summary (local only). */
  chatSummary?: string;
};

const today = new Date();
const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number) => {
  const d = new Date(today); d.setDate(d.getDate() - n); return iso(d);
};
const daysFrom = (n: number) => {
  const d = new Date(today); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10);
};

export const seedCustomers: Customer[] = [
  { id: "c1", name: "Alex Morgan", email: "alex@example.com", phone: "555-0142" },
  { id: "c2", name: "Jamie Chen", email: "jamie@example.com", phone: "555-0177" },
];

export const seedMechanics: Mechanic[] = [
  { id: "m1", name: "Rico Vasquez", initials: "RV" },
  { id: "m2", name: "Dana Park", initials: "DP" },
  { id: "m3", name: "Sam Okafor", initials: "SO" },
];

export const seedVehicles: Vehicle[] = [
  { id: "v1", customerId: "c1", year: 2019, make: "Toyota", model: "Camry", plate: "ABC123", vin: "JT2BF****19", lastService: daysAgo(45) },
  { id: "v2", customerId: "c1", year: 2021, make: "Honda", model: "CR-V", plate: "XYZ789", vin: "5J6RW****21", lastService: daysAgo(120) },
  { id: "v3", customerId: "c2", year: 2017, make: "Ford", model: "F-150", plate: "TRK500", vin: "1FTEW****17", lastService: daysAgo(30) },
];

export const seedCases: Case[] = [
  {
    id: "CASE-2041", customerId: "c1", vehicleId: "v1",
    service: "Brake pad replacement + rotor check",
    mechanicId: "m1", status: "Awaiting Customer Approval", pipelineStep: 2,
    daysOpen: 2, createdAt: daysAgo(2),
    lineItems: [
      { id: "li1", name: "Front brake pads (set)", qty: 1, unitCost: 89, type: "part" },
      { id: "li2", name: "Rear brake pads (set)", qty: 1, unitCost: 79, type: "part" },
      { id: "li3", name: "Brake fluid flush", qty: 1, unitCost: 35, type: "part" },
      { id: "li4", name: "Labor (2.5 hrs)", qty: 2.5, unitCost: 110, type: "labor" },
    ],
    notes: "Customer reported squealing at low speed. Rotors within spec.",
    internalNotes: "Pads at 2mm. Recommend full set front + rear.",
    timeline: [
      { at: daysAgo(2), label: "Check-in completed" },
      { at: daysAgo(1), label: "Diagnosis complete — estimate prepared" },
      { at: daysAgo(0.5), label: "Estimate sent to customer" },
    ],
  },
  {
    id: "CASE-2042", customerId: "c1", vehicleId: "v2",
    service: "Oil change + tire rotation",
    mechanicId: "m2", status: "Ready for Pickup", pipelineStep: 4,
    daysOpen: 1, createdAt: daysAgo(1),
    lineItems: [
      { id: "li1", name: "5W-30 synthetic oil (5qt)", qty: 1, unitCost: 42, type: "part" },
      { id: "li2", name: "Oil filter", qty: 1, unitCost: 14, type: "part" },
      { id: "li3", name: "Labor", qty: 1, unitCost: 65, type: "labor" },
    ],
    notes: "Routine maintenance.",
    internalNotes: "All good. Next service ~5k mi.",
    timeline: [
      { at: daysAgo(1), label: "Check-in" },
      { at: daysAgo(0.5), label: "Service complete — ready for pickup" },
    ],
  },
  {
    id: "CASE-2043", customerId: "c2", vehicleId: "v3",
    service: "Transmission diagnostic",
    mechanicId: "m3", status: "In Progress", pipelineStep: 1,
    daysOpen: 3, createdAt: daysAgo(3),
    lineItems: [],
    notes: "Slipping in 3rd gear under load.",
    internalNotes: "Running diagnostics — may need full rebuild.",
    timeline: [
      { at: daysAgo(3), label: "Check-in" },
      { at: daysAgo(2), label: "Diagnostic started" },
    ],
  },
  {
    id: "CASE-2044", customerId: "c2", vehicleId: "v3",
    service: "Battery replacement",
    mechanicId: "m1", status: "Completed", pipelineStep: 4,
    daysOpen: 0, createdAt: daysAgo(10),
    lineItems: [
      { id: "li1", name: "Battery 12V H7", qty: 1, unitCost: 189, type: "part" },
      { id: "li2", name: "Labor", qty: 0.5, unitCost: 110, type: "labor" },
    ],
    notes: "", internalNotes: "Done.",
    timeline: [
      { at: daysAgo(10), label: "Check-in" },
      { at: daysAgo(10), label: "Service complete" },
      { at: daysAgo(9), label: "Picked up by customer" },
    ],
  },
  {
    id: "CASE-2045", customerId: "c1", vehicleId: "v2",
    service: "AC recharge & inspection",
    mechanicId: "m2", status: "Incoming", pipelineStep: 0,
    daysOpen: 0, createdAt: daysAgo(0),
    lineItems: [], notes: "Weak airflow.", internalNotes: "",
    timeline: [{ at: daysAgo(0), label: "Check-in scheduled" }],
  },
];

export const seedAppointments: Appointment[] = [
  { id: "a1", customerId: "c1", vehicleId: "v1", service: "Brake inspection", date: daysFrom(3), time: "10:00", mechanicId: "m1", status: "confirmed" },
  { id: "a2", customerId: "c2", vehicleId: "v3", service: "Transmission follow-up", date: daysFrom(5), time: "14:30", mechanicId: "m3", status: "confirmed" },
  { id: "a3", customerId: "c1", vehicleId: "v2", service: "Oil change", date: daysFrom(0), time: "09:00", mechanicId: "m2", status: "confirmed" },
  { id: "a4", customerId: "c2", vehicleId: "v3", service: "Tire rotation", date: daysFrom(8), time: "11:00", status: "pending" },
];

export const seedInventory: Part[] = [
  { id: "p1", name: "5W-30 Synthetic Oil", sku: "OIL-5W30-5Q", category: "Fluids", stock: 24, reorderLevel: 10, unitCost: 28, supplier: "AutoZone" },
  { id: "p2", name: "Oil Filter — Universal", sku: "FLT-OIL-U1", category: "Filters", stock: 8, reorderLevel: 10, unitCost: 9, supplier: "NAPA" },
  { id: "p3", name: "Brake Pads — Front Set", sku: "BRK-PAD-F", category: "Brakes", stock: 12, reorderLevel: 6, unitCost: 65, supplier: "Brembo" },
  { id: "p4", name: "Brake Pads — Rear Set", sku: "BRK-PAD-R", category: "Brakes", stock: 4, reorderLevel: 6, unitCost: 58, supplier: "Brembo" },
  { id: "p5", name: "Air Filter", sku: "FLT-AIR-1", category: "Filters", stock: 18, reorderLevel: 8, unitCost: 18, supplier: "K&N" },
  { id: "p6", name: "Battery 12V H7", sku: "BAT-H7", category: "Electrical", stock: 3, reorderLevel: 4, unitCost: 145, supplier: "DieHard" },
  { id: "p7", name: "Spark Plug (4-pack)", sku: "SPK-4PK", category: "Engine", stock: 22, reorderLevel: 10, unitCost: 24, supplier: "NGK" },
  { id: "p8", name: "Coolant 1gal", sku: "FLD-COOL", category: "Fluids", stock: 15, reorderLevel: 6, unitCost: 21, supplier: "Prestone" },
  { id: "p9", name: "Transmission Fluid", sku: "FLD-TRN", category: "Fluids", stock: 2, reorderLevel: 4, unitCost: 32, supplier: "Valvoline" },
  { id: "p10", name: "Wiper Blades (pair)", sku: "WPR-PAIR", category: "Exterior", stock: 14, reorderLevel: 6, unitCost: 22, supplier: "Bosch" },
];

export const seedNotifications: Notification[] = [
  { id: "n1", title: "Estimate ready — action required", body: "Your estimate for the 2019 Camry is ready to review.", at: daysAgo(0.5), read: false },
  { id: "n2", title: "Your CR-V is ready for pickup", body: "Oil change & rotation complete.", at: daysAgo(0.3), read: false },
  { id: "n3", title: "Appointment confirmed", body: "Brake inspection on " + daysFrom(3), at: daysAgo(1), read: true },
];

export const GARAGE_NAME = "Coppi Garage";
export const GARAGE_INFO = {
  name: "Coppi Garage",
  tagline: "Independent auto service & repair",
  address: "1428 Mission St, San Francisco, CA 94103",
  phone: "(415) 555-0142",
  email: "service@coppigarage.com",
  website: "coppigarage.com",
};

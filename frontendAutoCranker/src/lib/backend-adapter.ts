/**
 * Maps backend API response shapes to the frontend's mock-data types.
 * This keeps the API layer thin and the existing UI components unchanged.
 */

import type { BackendRepairCase, BackendCustomer, BackendInventoryItem } from "./api";
import type { Case, Customer, Vehicle, Appointment, Part, CaseStatus } from "./mock-data";

// ---------------------------------------------------------------------------
// Status conversions
// ---------------------------------------------------------------------------

/** Maps a backend repair-case status to the 6-value frontend CaseStatus. */
export function backendStatusToFrontend(status: string): CaseStatus {
  switch (status) {
    case "new_request":
    case "collecting_info":
    case "appointment_booked":
      return "Incoming";
    case "checked_in":
    case "inspection_pending":
    case "inspection_done":
    case "quote_draft":
    case "customer_approved":
    case "waiting_for_parts":
    case "in_repair":
      return "In Progress";
    case "quote_waiting_owner_approval":
    case "quote_sent":
      return "Awaiting Customer Approval";
    case "ready_for_pickup":
      return "Ready for Pickup";
    case "closed":
      return "Completed";
    case "customer_declined":
      return "Cancelled";
    default:
      return "Incoming";
  }
}

/** Maps a frontend CaseStatus back to the closest backend status for PATCH. */
export function frontendToBackendStatus(status: CaseStatus): string {
  switch (status) {
    case "Incoming":
      return "collecting_info";
    case "In Progress":
      return "in_repair";
    case "Awaiting Customer Approval":
      return "quote_sent";
    case "Ready for Pickup":
      return "ready_for_pickup";
    case "Completed":
      return "closed";
    case "Cancelled":
      return "customer_declined";
  }
}

function pipelineStepFromBackendStatus(status: string): number {
  switch (status) {
    case "new_request":
    case "collecting_info":
    case "appointment_booked":
    case "checked_in":
      return 0;
    case "inspection_pending":
    case "inspection_done":
    case "quote_draft":
      return 1;
    case "quote_waiting_owner_approval":
    case "quote_sent":
      return 2;
    case "customer_approved":
    case "waiting_for_parts":
    case "in_repair":
      return 3;
    case "ready_for_pickup":
    case "closed":
      return 4;
    default:
      return 0;
  }
}

function daysOpenSince(isoString: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 86_400_000));
}

const DEMO_SESSION_IDS = new Set(["demo_leo_ekl7", "demo_customer_1", "demo_customer"]);

/** Display name for dashboard UI — demo sessions always show as Leo. */
export function customerDisplayName(
  name: string | null | undefined,
  phoneNumber?: string | null,
): string {
  if (phoneNumber && DEMO_SESSION_IDS.has(phoneNumber)) return "Leo";
  const raw = (name ?? "").trim();
  if (!raw) return "Customer";
  if (raw === "Demo Customer" || /^leo\s*\(demo\)$/i.test(raw)) return "Leo";
  return raw.replace(/\s*\(demo\)\s*/gi, "").trim() || "Customer";
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

/**
 * Converts backend repair cases to frontend Case objects.
 * Fields with no backend equivalent (mechanicId, lineItems, internalNotes)
 * get sensible defaults so existing UI components keep working.
 */
export function adaptCases(cases: BackendRepairCase[]): Case[] {
  return cases.map((bc): Case => ({
    id: `CASE-${bc.id}`,
    customerId: `api-customer-${bc.customer_id}`,
    vehicleId: bc.vehicle_id ? `api-vehicle-${bc.vehicle_id}` : "api-vehicle-placeholder",
    service: bc.title ?? bc.problem_summary ?? "Repair case",
    mechanicId: "m1",
    status: backendStatusToFrontend(bc.status),
    pipelineStep: pipelineStepFromBackendStatus(bc.status),
    daysOpen: daysOpenSince(bc.created_at),
    createdAt: bc.created_at,
    lineItems: [],
    notes: bc.problem_summary ?? "",
    internalNotes: bc.blocker ?? "",
    timeline: [{ at: bc.created_at, label: "Case created via AutoCranker AI" }],
    _backendId: bc.id,
    _customerPhone: bc.phone_number,
  }));
}

export function adaptCustomers(customers: BackendCustomer[]): Customer[] {
  return customers.map(
    (bc): Customer => ({
      id: `api-customer-${bc.id}`,
      name: customerDisplayName(bc.name, bc.phone_number),
      email: "",
      phone: bc.phone_number,
    }),
  );
}

/**
 * Derives Vehicle objects from repair-case list items.
 * vehicle_label arrives as "2019 Toyota Camry" — we parse it back to parts.
 * A placeholder vehicle is always included for cases that have no vehicle yet.
 */
export function extractVehicles(cases: BackendRepairCase[]): Vehicle[] {
  const now = new Date().toISOString();
  const vehicles: Vehicle[] = [
    {
      id: "api-vehicle-placeholder",
      customerId: "",
      year: 2020,
      make: "Unknown",
      model: "Vehicle",
      plate: "",
      vin: "",
      lastService: now,
    },
  ];

  const seen = new Set<string>(["api-vehicle-placeholder"]);

  for (const bc of cases) {
    if (!bc.vehicle_id) continue;
    const vid = `api-vehicle-${bc.vehicle_id}`;
    if (seen.has(vid)) continue;
    seen.add(vid);

    const label = bc.vehicle_label ?? "";
    const parts = label.split(" ");
    const year = parseInt(parts[0], 10) || 2020;
    const make = parts[1] ?? "Unknown";
    const model = parts.slice(2).join(" ") || "Unknown";

    vehicles.push({
      id: vid,
      customerId: `api-customer-${bc.customer_id}`,
      year,
      make,
      model,
      plate: "",
      vin: "",
      lastService: bc.updated_at,
    });
  }

  return vehicles;
}

/** Converts backend cases with an appointment_start into Appointment objects. */
export function extractAppointments(cases: BackendRepairCase[]): Appointment[] {
  return cases
    .filter((bc): bc is BackendRepairCase & { appointment_start: string } => bc.appointment_start != null)
    .map(
      (bc): Appointment => {
        const d = new Date(bc.appointment_start);
        const hh = d.getHours().toString().padStart(2, "0");
        const mm = d.getMinutes().toString().padStart(2, "0");
        const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return {
          id: `api-appt-${bc.id}`,
          customerId: `api-customer-${bc.customer_id}`,
          vehicleId: bc.vehicle_id ? `api-vehicle-${bc.vehicle_id}` : "api-vehicle-placeholder",
          service: bc.title ?? "Appointment",
          date: localDate,
          time: `${hh}:${mm}`,
          status: "confirmed",
        };
      },
    );
}

export function adaptInventory(items: BackendInventoryItem[]): Part[] {
  return items.map(
    (item): Part => ({
      id: `api-inv-${item.id}`,
      name: item.name,
      sku: item.sku ?? "",
      category: "General",
      stock: item.quantity_available,
      reorderLevel: 5,
      unitCost: item.unit_cost ?? 0,
      supplier: "",
    }),
  );
}

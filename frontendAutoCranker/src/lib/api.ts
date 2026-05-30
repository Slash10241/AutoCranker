/**
 * Typed fetch layer for the AutoCranker FastAPI backend.
 * Base URL is read from the VITE_API_BASE_URL environment variable
 * (set in .env). Falls back to localhost:8000 for local dev.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://127.0.0.1:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[API] ${options?.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Backend response types (mirrors backend/app/schemas.py)
// ---------------------------------------------------------------------------

export interface BackendRepairCase {
  id: number;
  customer_id: number;
  customer_name: string | null;
  phone_number: string;
  vehicle_id: number | null;
  vehicle_label: string | null;
  status: string;
  title: string | null;
  problem_summary: string | null;
  urgency: string | null;
  appointment_start: string | null;
  appointment_end: string | null;
  appointment_type: string | null;
  blocker: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackendCustomer {
  id: number;
  phone_number: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

export interface BackendMessage {
  id: number;
  customer_id: number;
  role: "customer" | "assistant";
  content: string;
  channel: string;
  external_message_id: string | null;
  created_at: string;
}

export interface BackendInventoryItem {
  id: number;
  name: string;
  sku: string | null;
  quantity_available: number;
  unit_cost: number | null;
  selling_price: number | null;
}

export interface BackendGarageSettings {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  opening_hours_json: string | null;
  timezone: string;
  labor_rate: number | null;
  currency: string;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const api = {
  listRepairCases: () => apiFetch<BackendRepairCase[]>("/api/repair-cases"),

  listCustomers: () => apiFetch<BackendCustomer[]>("/api/customers"),

  listAppointments: () => apiFetch<BackendRepairCase[]>("/api/calendar/appointments"),

  listInventory: () => apiFetch<BackendInventoryItem[]>("/api/inventory"),

  getGarageSettings: () => apiFetch<BackendGarageSettings>("/api/garage-settings"),

  getMessages: (sessionId: string) =>
    apiFetch<BackendMessage[]>(`/api/chat/${encodeURIComponent(sessionId)}/messages`),

  updateRepairCase: (id: number, patch: { status?: string; title?: string; problem_summary?: string }) =>
    apiFetch<BackendRepairCase>(`/api/repair-cases/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
};

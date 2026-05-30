import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, type NavItem } from "@/components/dashboard-shell";
import { LayoutDashboard, Kanban, CalendarDays, Boxes, History, BarChart3 } from "lucide-react";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/owner")({
  component: OwnerLayout,
});

function OwnerLayout() {
  const { state } = useStore();
  const low = state.inventory.filter((p) => p.stock <= p.reorderLevel).length;
  const items: NavItem[] = [
    { to: "/owner", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
    { to: "/owner/cases", label: "Cases Board", icon: <Kanban className="h-4 w-4" /> },
    { to: "/owner/calendar", label: "Calendar", icon: <CalendarDays className="h-4 w-4" /> },
    { to: "/owner/inventory", label: "Inventory", icon: <Boxes className="h-4 w-4" />, badge: low || undefined },
    { to: "/owner/history", label: "Case History", icon: <History className="h-4 w-4" /> },
    { to: "/owner/analytics", label: "Analytics", icon: <BarChart3 className="h-4 w-4" /> },
  ];
  return <DashboardShell items={items} title="Owner Console" />;
}

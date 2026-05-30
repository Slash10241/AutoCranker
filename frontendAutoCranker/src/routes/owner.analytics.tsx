import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/owner/analytics")({
  component: Analytics,
});

const revenueByWeek = [
  { week: "W1", revenue: 3200 }, { week: "W2", revenue: 4100 },
  { week: "W3", revenue: 3800 }, { week: "W4", revenue: 5200 },
  { week: "W5", revenue: 4600 }, { week: "W6", revenue: 6100 },
  { week: "W7", revenue: 5400 }, { week: "W8", revenue: 4860 },
];
const casesFlow = [
  { week: "W1", opened: 8, closed: 6 }, { week: "W2", opened: 11, closed: 9 },
  { week: "W3", opened: 9, closed: 10 }, { week: "W4", opened: 14, closed: 12 },
  { week: "W5", opened: 12, closed: 13 }, { week: "W6", opened: 16, closed: 14 },
  { week: "W7", opened: 13, closed: 15 }, { week: "W8", opened: 10, closed: 11 },
];

const AMBER = "#f59e0b";
const COLORS = ["#f59e0b", "#22c55e", "#60a5fa", "#ef4444", "#a78bfa"];

function Analytics() {
  const { state } = useStore();
  const [range, setRange] = useState("8w");

  const serviceBreakdown = Object.entries(
    state.cases.reduce<Record<string, number>>((acc, c) => {
      const key = c.service.split(" ").slice(0, 2).join(" ");
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const techLoad = state.mechanics.map((m) => ({
    name: m.initials,
    cases: state.cases.filter((c) => c.mechanicId === m.id).length,
  }));

  return (
    <div>
      <PageHeader title="Analytics" subtitle="How the shop is doing." action={
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-40 font-mono text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="4w">Last 4 weeks</SelectItem>
            <SelectItem value="8w">Last 8 weeks</SelectItem>
            <SelectItem value="12w">Last 12 weeks</SelectItem>
          </SelectContent>
        </Select>
      } />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Revenue by week">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueByWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="revenue" fill={AMBER} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cases opened vs closed">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={casesFlow}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="week" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
              <Line type="monotone" dataKey="opened" stroke={AMBER} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="closed" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Service mix">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={serviceBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                {serviceBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Technician workload">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={techLoad}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="cases" fill="#60a5fa" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "#1a1d27", border: "1px solid #333", borderRadius: 6,
  fontFamily: "IBM Plex Mono", fontSize: 11,
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-surface">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

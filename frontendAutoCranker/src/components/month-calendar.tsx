import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarEvent = { id: string; time?: string; label: string };

export function MonthCalendar({
  markedDates = [],
  events = {},
  selected,
  onSelectDate,
}: {
  markedDates?: string[]; // ISO yyyy-mm-dd
  events?: Record<string, CalendarEvent[]>;
  selected?: string;
  onSelectDate?: (d: string) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const grid = useMemo(() => buildGrid(cursor), [cursor]);
  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const marked = new Set(markedDates);

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">{monthLabel}</h3>
        <div className="flex gap-1">
          <button onClick={() => setCursor(addMonths(cursor, -1))} className="rounded-md p-1.5 hover:bg-surface-2"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="rounded-md p-1.5 hover:bg-surface-2"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {["S","M","T","W","T","F","S"].map((d, i) => <div key={i} className="px-1 py-1 text-center">{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {grid.map((cell, i) => {
          const inMonth = cell.getMonth() === cursor.getMonth();
          const iso = localDateStr(cell);
          const isMarked = marked.has(iso);
          const isSelected = selected === iso;
          const isToday = iso === localDateStr(new Date());
          const dayEvents = events[iso] ?? [];
          const col = i % 7;
          return (
            <div key={i} className="group relative">
              <button
                onClick={() => onSelectDate?.(iso)}
                className={cn(
                  "relative flex min-h-[78px] w-full flex-col rounded-md p-1 text-xs transition-colors",
                  inMonth ? "text-foreground" : "text-muted-foreground/40",
                  isSelected ? "bg-amber text-[color:var(--amber-foreground)] font-bold"
                  : isToday ? "bg-surface-2 ring-1 ring-amber/40"
                  : "hover:bg-surface-2"
                )}
              >
                <span className="self-start px-1">{cell.getDate()}</span>
                <div className="mt-1 w-full space-y-0.5">
                  {dayEvents.slice(0, 2).map((e) => (
                    <div
                      key={e.id}
                      className={cn(
                        "truncate rounded-sm border-l-2 border-amber px-1 py-0.5 text-left font-mono text-[9px] leading-tight",
                        isSelected ? "bg-[color:var(--amber-foreground)]/15 text-[color:var(--amber-foreground)]" : "bg-amber/10 text-foreground"
                      )}
                    >
                      {e.time && <span className="mr-1 text-amber">{e.time}</span>}
                      <span>{e.label}</span>
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="px-1 text-left font-mono text-[9px] text-muted-foreground">+{dayEvents.length - 2} more</div>
                  )}
                </div>
                {isMarked && dayEvents.length === 0 && <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-amber" />}
              </button>
              {dayEvents.length > 0 && (
                <div
                  className={cn(
                    "pointer-events-none absolute bottom-full z-30 mb-2 hidden w-56 rounded-lg border border-border bg-surface-2 p-2 shadow-xl group-hover:block",
                    col <= 1 ? "left-0" : col >= 5 ? "right-0" : "left-1/2 -translate-x-1/2"
                  )}
                >
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {cell.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 5).map((e) => (
                      <div key={e.id} className="flex items-center gap-1.5 rounded-md border-l-2 border-amber bg-surface px-2 py-1 text-left">
                        {e.time && <span className="font-mono text-[10px] text-amber">{e.time}</span>}
                        <span className="truncate text-[11px] text-foreground">{e.label}</span>
                      </div>
                    ))}
                    {dayEvents.length > 5 && (
                      <div className="px-2 font-mono text-[10px] text-muted-foreground">+{dayEvents.length - 5} more</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addMonths(d: Date, n: number) {
  const r = new Date(d); r.setMonth(r.getMonth() + n); return r;
}
function buildGrid(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first); start.setDate(start.getDate() - first.getDay());
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

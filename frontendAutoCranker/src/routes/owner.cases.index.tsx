import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useStore } from "@/lib/store";
import { CASE_STATUSES, type CaseStatus } from "@/lib/mock-data";
import { PageHeader } from "@/components/dashboard-shell";
import { statusColor } from "@/lib/store";
import { cn } from "@/lib/utils";
import { GripVertical, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/owner/cases/")({
  component: CasesBoard,
});

function CasesBoard() {
  const { state, update, patchBackendCase } = useStore();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const caseId = e.active.id as string;
    const newStatus = e.over?.id as CaseStatus | undefined;
    if (!newStatus) return;
    update((s) => ({
      ...s,
      cases: s.cases.map((c) => c.id === caseId ? {
        ...c, status: newStatus,
        pipelineStep: stepFromStatus(newStatus, c.pipelineStep),
        timeline: [...c.timeline, { at: new Date().toISOString(), label: `Moved to ${newStatus}` }],
      } : c),
    }));
    patchBackendCase(caseId, newStatus).catch(() => {
      toast.error("Status saved locally but failed to sync with server");
    });
    toast.success(`Moved to ${newStatus}`);
  };

  return (
    <div>
      <PageHeader title="Cases board" subtitle="Click a card for details. Drag the handle to move between columns." />
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {CASE_STATUSES.map((status) => {
            const cards = state.cases.filter((c) => c.status === status);
            return <Column key={status} status={status} cards={cards} />;
          })}
        </div>
      </DndContext>
    </div>
  );
}

function stepFromStatus(s: CaseStatus, fallback: number): number {
  switch (s) {
    case "Incoming": return 0;
    case "In Progress": return 3;
    case "Awaiting Customer Approval": return 2;
    case "Ready for Pickup": return 4;
    case "Completed": return 4;
    default: return fallback;
  }
}

function Column({ status, cards }: { status: CaseStatus; cards: any[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={cn(
      "flex w-72 shrink-0 flex-col rounded-xl border border-border bg-surface/40 p-3 transition-colors",
      isOver && "border-amber/60 bg-amber/5"
    )}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider", statusColor(status))}>{status}</span>
        </div>
        <span className="font-mono text-xs text-muted-foreground">{cards.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {cards.map((c) => <CaseCard key={c.id} c={c} />)}
        {cards.length === 0 && <div className="rounded-md border border-dashed border-border/60 p-6 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Empty</div>}
      </div>
    </div>
  );
}

function CaseCard({ c }: { c: any }) {
  const { state } = useStore();
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });
  const v = state.vehicles.find((x) => x.id === c.vehicleId)!;
  const cu = state.customers.find((x) => x.id === c.customerId)!;
  const m = state.mechanics.find((x) => x.id === c.mechanicId)!;
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative rounded-lg border border-border bg-surface transition-colors hover:border-amber/40",
        isDragging && "opacity-50"
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label="Drag case"
        className="absolute right-1 top-1 z-10 cursor-grab rounded p-1 text-muted-foreground hover:bg-surface-2 hover:text-amber active:cursor-grabbing"
        onClick={(e) => e.preventDefault()}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Link
        to="/owner/cases/$caseId"
        params={{ caseId: c.id }}
        className="block p-3 text-left no-underline"
      >
        <div className="flex items-center justify-between pr-6">
          <span className="font-mono text-[10px] uppercase tracking-widest text-amber">{c.id}</span>
          <span className="font-mono text-[10px] text-muted-foreground">{c.daysOpen}d</span>
        </div>
        <div className="mt-2 line-clamp-2 text-sm font-medium">{c.service}</div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {cu.name} · {v.year} {v.make} {v.model}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="grid h-6 w-6 place-items-center rounded-full bg-amber/15 text-[10px] font-bold text-amber">{m.initials}</div>
        </div>
      </Link>
      <Link
        to="/owner/cases/$caseId/chat"
        params={{ caseId: c.id }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          navigate({ to: "/owner/cases/$caseId/chat", params: { caseId: c.id } });
        }}
        className="flex items-center justify-center gap-1.5 border-t border-border bg-surface-2/50 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-amber/10 hover:text-amber"
      >
        <MessageCircle className="h-3 w-3" /> WhatsApp transcript
      </Link>
    </div>
  );
}

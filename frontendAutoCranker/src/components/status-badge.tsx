import { cn } from "@/lib/utils";
import { statusColor } from "@/lib/store";
import type { CaseStatus } from "@/lib/mock-data";

export function StatusBadge({ status, className }: { status: CaseStatus; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
      statusColor(status), className
    )}>
      {status}
    </span>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";
import { seedChats } from "@/lib/mock-chats";
import { ArrowLeft, Phone, Video, MoreVertical, Check, CheckCheck, Bot } from "lucide-react";
import { formatTimeUTC, formatDayLabelUTC, utcDayKey } from "@/lib/format-date";

export const Route = createFileRoute("/owner/cases/$caseId/chat")({
  component: ChatPage,
});

function ChatPage() {
  const { caseId } = Route.useParams();
  const { state } = useStore();
  const c = state.cases.find((x) => x.id === caseId);
  const cu = c ? state.customers.find((x) => x.id === c.customerId) : null;
  const messages = seedChats[caseId] ?? [];

  if (!c || !cu) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h2 className="font-display text-2xl font-bold">Chat not found</h2>
        <Link to="/owner/cases" className="mt-6 inline-flex items-center gap-2 rounded-md bg-amber px-4 py-2 text-sm font-semibold text-[color:var(--amber-foreground)]">
          <ArrowLeft className="h-4 w-4" /> Back to board
        </Link>
      </div>
    );
  }

  // Group messages by day for date separators (UTC keys for SSR stability).
  const groups: { key: string; sample: string; items: typeof messages }[] = [];
  for (const m of messages) {
    const key = utcDayKey(m.at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(m);
    else groups.push({ key, sample: m.at, items: [m] });
  }


  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/owner/cases/$caseId"
        params={{ caseId }}
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-amber"
      >
        <ArrowLeft className="h-3 w-3" /> Back to case
      </Link>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
        {/* WhatsApp-style header */}
        <header className="flex items-center justify-between gap-3 border-b border-border bg-[#075E54] px-4 py-3 text-white dark:bg-[#0b3d36]">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber/90 font-mono text-sm font-bold text-[color:var(--amber-foreground)]">
              {cu.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold">{cu.name}</div>
              <div className="flex items-center gap-1 text-[11px] opacity-80">
                <Bot className="h-3 w-3" /> Chatted with AutoCranker AI · {cu.phone}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 opacity-90">
            <Video className="h-5 w-5" />
            <Phone className="h-5 w-5" />
            <MoreVertical className="h-5 w-5" />
          </div>
        </header>

        {/* Chat surface — WhatsApp doodle background */}
        <div
          className="relative max-h-[70vh] overflow-y-auto px-4 py-6"
          style={{
            backgroundColor: "#ECE5DD",
            backgroundImage:
              "radial-gradient(circle at 25% 25%, rgba(0,0,0,0.04) 1px, transparent 1px), radial-gradient(circle at 75% 75%, rgba(0,0,0,0.04) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        >
          {groups.length === 0 && (
            <div className="grid place-items-center py-20 text-center text-sm text-neutral-600">
              No messages yet for this case.
            </div>
          )}

          {groups.map((g) => (
            <div key={g.key}>
              <div className="my-3 flex justify-center">
                <span className="rounded-md bg-white/80 px-3 py-1 text-[11px] font-medium text-neutral-600 shadow-sm">
                  {formatDayLabelUTC(g.sample)}
                </span>
              </div>
              <div className="space-y-2">
                {g.items.map((m) => {
                  const isAi = m.from === "ai";
                  return (
                    <div key={m.id} className={`flex ${isAi ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`relative max-w-[78%] rounded-lg px-3 py-2 shadow-sm ${
                          isAi ? "bg-[#DCF8C6] text-neutral-900" : "bg-white text-neutral-900"
                        }`}
                      >
                        {!isAi && (
                          <div className="mb-0.5 text-[11px] font-semibold text-[#075E54]">{cu.name}</div>
                        )}
                        {isAi && (
                          <div className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#0b6b3a]">
                            <Bot className="h-3 w-3" /> AutoCranker AI
                          </div>
                        )}
                        <div className="whitespace-pre-wrap text-sm leading-snug">{m.text}</div>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-neutral-500">
                          {formatTimeUTC(m.at)}
                          {isAi && <CheckCheck className="h-3 w-3 text-[#34B7F1]" />}
                          {!isAi && <Check className="h-3 w-3" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Read-only footer */}
        <div className="flex items-center justify-center border-t border-border bg-surface-2 px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Read-only transcript · WhatsApp via AutoCranker AI
          </span>
        </div>
      </div>
    </div>
  );
}


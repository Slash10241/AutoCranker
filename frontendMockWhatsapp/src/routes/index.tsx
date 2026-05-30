import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Mic, MoreVertical, RotateCcw, Plus, Trash2, UserCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Coppi Garage — WhatsApp" },
      { name: "description", content: "Mock WhatsApp chat with Coppi Garage." },
    ],
  }),
  component: Index,
});

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";
const GREETING = "👋 Hi! Welcome to Coppi Garage. How can we help you with your car today?";
const STORAGE_KEY = "wa_demo_profiles_v1";

const PRESETS = [
  "My car makes a noise when braking",
  "Engine warning light came on",
  "I have an oil leak",
  "2016 Seat Ibiza, 130,000 km",
  "Tomorrow at 10:30 works",
];

type Msg =
  | { id: string; role: "user" | "ai"; text: string; time: string }
  | { id: string; role: "system"; text: string; time: string };

type Profile = {
  id: string;
  name: string;
  sessionId: string;
  messages: Msg[];
};

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function makeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function freshGreeting(): Msg {
  return { id: "greet", role: "ai", text: GREETING, time: nowTime() };
}

function defaultProfiles(): Profile[] {
  return [
    { id: "p1", name: "Demo Customer", sessionId: "demo_customer_1", messages: [freshGreeting()] },
  ];
}

function loadProfiles(): { profiles: Profile[]; activeId: string } {
  if (typeof window === "undefined") {
    const ps = defaultProfiles();
    return { profiles: ps, activeId: ps[0].id };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { profiles: Profile[]; activeId: string };
      if (parsed.profiles?.length) return parsed;
    }
  } catch {
    // ignore
  }
  const ps = defaultProfiles();
  return { profiles: ps, activeId: ps[0].id };
}

function Index() {
  const [{ profiles, activeId }, setState] = useState(loadProfiles);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = profiles.find((p) => p.id === activeId) ?? profiles[0];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profiles, activeId }));
  }, [profiles, activeId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [active?.messages, typing, activeId]);

  // Hydrate chat history from backend on mount and profile switch
  useEffect(() => {
    if (!active) return;
    const sessionId = active.sessionId;
    fetch(`${API_BASE}/api/chat/${sessionId}/messages`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((msgs: { role: string; content: string; created_at: string }[]) => {
        if (!msgs.length) return;
        const hydrated: Msg[] = msgs.map((m) => ({
          id: makeId(),
          role: m.role === "customer" ? "user" : "ai",
          text: m.content,
          time: new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        }));
        setState((s) => ({
          ...s,
          profiles: s.profiles.map((p) =>
            p.sessionId === sessionId ? { ...p, messages: hydrated } : p,
          ),
        }));
      })
      .catch(() => {
        // backend unreachable or no history yet — keep local state
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  function updateActive(updater: (p: Profile) => Profile) {
    setState((s) => ({
      ...s,
      profiles: s.profiles.map((p) => (p.id === s.activeId ? updater(p) : p)),
    }));
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !active) return;
    setInput("");
    updateActive((p) => ({
      ...p,
      messages: [...p.messages, { id: makeId(), role: "user", text: trimmed, time: nowTime() }],
    }));
    setTyping(true);

    const typingStart = Date.now();
    const sessionId = active.sessionId;
    const name = active.name;
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, name, message: trimmed, message_id: `msg-${Date.now()}` }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const reply: string = data?.reply ?? data?.message ?? data?.response ?? "(no reply)";
      const elapsed = Date.now() - typingStart;
      if (elapsed < 800) await new Promise((r) => setTimeout(r, 800 - elapsed));
      setTyping(false);
      setState((s) => ({
        ...s,
        profiles: s.profiles.map((p) =>
          p.sessionId === sessionId
            ? { ...p, messages: [...p.messages, { id: makeId(), role: "ai", text: reply, time: nowTime() }] }
            : p,
        ),
      }));
    } catch {
      setTyping(false);
      setState((s) => ({
        ...s,
        profiles: s.profiles.map((p) =>
          p.sessionId === sessionId
            ? {
                ...p,
                messages: [
                  ...p.messages,
                  { id: makeId(), role: "system", text: "Message failed to send. Check backend connection.", time: nowTime() },
                ],
              }
            : p,
        ),
      }));
    }
  }

  function handleReset() {
    if (!active) return;
    updateActive((p) => ({ ...p, messages: [freshGreeting()] }));
    setInput("");
    setTyping(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleAddProfile(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const id = makeId();
    const sessionId = `demo_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${id.slice(0, 4)}`;
    const profile: Profile = { id, name, sessionId, messages: [freshGreeting()] };
    setState((s) => ({ profiles: [...s.profiles, profile], activeId: id }));
    setNewName("");
    setAdding(false);
  }

  function handleSelect(id: string) {
    setState((s) => ({ ...s, activeId: id }));
    setTyping(false);
    setInput("");
  }

  function handleDelete(id: string) {
    setState((s) => {
      const remaining = s.profiles.filter((p) => p.id !== id);
      const next = remaining.length ? remaining : defaultProfiles();
      const nextActive = s.activeId === id ? next[0].id : s.activeId;
      return { profiles: next, activeId: nextActive };
    });
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col sm:flex-row items-center sm:items-start justify-center gap-4 p-4 sm:p-6"
      style={{ backgroundColor: "#0b141a", fontFamily: "Roboto, system-ui, -apple-system, sans-serif" }}
    >
      {/* Profile sidebar (collapsible) */}
      <aside
        className={`overflow-hidden transition-all duration-300 ease-out ${
          sidebarOpen ? "w-full sm:w-56 opacity-100" : "w-0 opacity-0 sm:h-[720px] pointer-events-none"
        }`}
        aria-hidden={!sidebarOpen}
      >
        <div className="w-full sm:w-56 bg-[#111b21] text-gray-100 rounded-2xl p-3 sm:h-[720px] flex flex-col gap-2 border border-white/5">
          <div className="text-[12px] uppercase tracking-wider text-gray-400 px-1 pt-1">Profiles</div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-1">
            {profiles.map((p) => {
              const isActive = p.id === activeId;
              return (
                <div
                  key={p.id}
                  className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                    isActive ? "bg-[#25D366]/15 ring-1 ring-[#25D366]/40" : "hover:bg-white/5"
                  }`}
                  onClick={() => handleSelect(p.id)}
                >
                  <UserCircle2 size={22} className={isActive ? "text-[#25D366]" : "text-gray-400"} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] truncate">{p.name}</div>
                    <div className="text-[11px] text-gray-500 truncate">{p.sessionId}</div>
                  </div>
                  {profiles.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-opacity"
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {adding ? (
            <form onSubmit={handleAddProfile} className="flex flex-col gap-2 pt-2 border-t border-white/10">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Customer name"
                className="bg-[#1f2c33] rounded-md px-2 py-1.5 text-[13px] outline-none placeholder:text-gray-500"
              />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-[#25D366] text-black text-[12.5px] font-medium rounded-md py-1.5">
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setNewName("");
                  }}
                  className="flex-1 bg-white/5 text-[12.5px] rounded-md py-1.5"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center justify-center gap-1.5 text-[13px] bg-white/5 hover:bg-white/10 rounded-lg py-2 transition-colors"
            >
              <Plus size={14} /> New profile
            </button>
          )}
        </div>
      </aside>

      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Hide profiles" : "Show profiles"}
            className="hidden absolute top-1/2 -translate-y-1/2 right-full z-10 px-1.5 py-3 rounded-l-md text-white shadow-md transition-colors bg-slate-800 items-center justify-center sm:flex flex-col gap-1 text-[11px] tracking-wider"
          >
            {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            <span className="[writing-mode:vertical-rl] rotate-180">Profiles</span>
          </button>
          <div
            className="relative flex flex-col bg-white overflow-hidden w-full sm:w-[380px] h-[100svh] sm:h-[720px] sm:rounded-[28px]"
            style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}
          >

          {/* Header */}
          <div
            className="flex items-center gap-3 px-3 py-2.5 text-white shrink-0"
            style={{ backgroundColor: "#128C7E" }}
          >
            <img
              src={logoUrl}
              alt="Coppi Garage"
              className="w-10 h-10 rounded-full shrink-0 object-cover bg-black"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-[15px] leading-tight">Coppi Garage</div>
              <div className="text-[12px] opacity-90 leading-tight truncate">
                Chatting as {active?.name ?? "—"} · Online
              </div>
            </div>
            <MoreVertical size={20} className="opacity-90" />
          </div>

          {/* Chat area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5"
            style={{
              backgroundColor: "#ECE5DD",
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><circle cx='2' cy='2' r='1' fill='%23d8cfc2' opacity='0.4'/></svg>\")",
            }}
          >
            {active?.messages.map((m) => {
              if (m.role === "system") {
                return (
                  <div key={m.id} className="self-center my-1 px-3 py-1.5 rounded-md text-[12px] text-white" style={{ backgroundColor: "#d9534f" }}>
                    {m.text}
                  </div>
                );
              }
              const isUser = m.role === "user";
              return (
                <div
                  key={m.id}
                  className={`max-w-[75%] px-2.5 py-1.5 text-[14.5px] leading-snug shadow-sm break-words whitespace-pre-wrap ${
                    isUser ? "self-end rounded-l-lg rounded-tr-lg rounded-br-sm" : "self-start rounded-r-lg rounded-tl-sm rounded-bl-lg"
                  }`}
                  style={{
                    backgroundColor: isUser ? "#FFFFFF" : "#DCF8C6",
                    color: "#111",
                  }}
                >
                  <span>{m.text}</span>
                  <span className="ml-2 float-right text-[11px] text-gray-500 mt-1 leading-none">{m.time}</span>
                </div>
              );
            })}

            {typing && (
              <div
                className="self-start max-w-[75%] px-3 py-2 rounded-r-lg rounded-tl-sm rounded-bl-lg shadow-sm flex items-center gap-1"
                style={{ backgroundColor: "#DCF8C6" }}
              >
                <Dot delay="0s" />
                <Dot delay="0.15s" />
                <Dot delay="0.3s" />
              </div>
            )}
          </div>

          {/* Quick replies */}
          <div className="shrink-0 px-2 py-2 bg-white border-t border-gray-100 overflow-x-auto">
            <div className="flex gap-2 w-max">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => sendMessage(p)}
                  className="px-3 py-1.5 rounded-full text-[12.5px] whitespace-nowrap border transition-colors"
                  style={{ borderColor: "#128C7E", color: "#128C7E", backgroundColor: "white" }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Input bar */}
          <form onSubmit={handleSubmit} className="shrink-0 flex items-center gap-2 px-2 py-2 bg-white border-t border-gray-100">
            <button type="button" className="p-2 text-gray-500" aria-label="Voice (disabled)">
              <Mic size={22} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 rounded-full bg-gray-100 px-4 py-2 text-[14.5px] outline-none placeholder:text-gray-500"
            />
            <button
              type="submit"
              aria-label="Send"
              className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: "#25D366" }}
            >
              <Send size={18} />
            </button>
          </form>
          </div>
        </div>



        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-300 hover:text-white transition-colors"
        >
          <RotateCcw size={14} /> Reset conversation
        </button>
      </div>

      <style>{`
        @keyframes wa-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-gray-500"
      style={{ animation: "wa-bounce 1s infinite", animationDelay: delay }}
    />
  );
}

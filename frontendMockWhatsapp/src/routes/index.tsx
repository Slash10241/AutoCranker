import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Mic, MoreVertical, RotateCcw, FileText } from "lucide-react";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AutoCranker — WhatsApp Demo" },
      { name: "description", content: "Mock WhatsApp chat with the AutoCranker AI garage assistant." },
    ],
  }),
  component: Index,
});

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:8000";
const DEMO_SESSION_ID = "demo_leo_ekl7";
const GREETING = "👋 Hi! I'm the AutoCranker assistant. How can I help you with your car today?";
const STORAGE_KEY = "wa_demo_profiles_v2";

const PRESETS = [
  "My car makes a noise when braking",
  "Engine warning light came on",
  "I have an oil leak",
  "2016 Seat Ibiza, 130,000 km",
  "Tomorrow at 10:30 works",
];

type BackendMessage = {
  id: number;
  role: string;
  content: string;
  message_type?: string;
  attachment_url?: string | null;
  attachment_filename?: string | null;
  created_at: string;
};

type Msg =
  | { id: string; role: "user" | "ai"; text: string; time: string }
  | {
      id: string;
      role: "ai";
      kind: "document";
      filename: string;
      url: string;
      time: string;
    }
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

function defaultProfile(): Profile {
  return {
    id: "leo",
    name: "Leo",
    sessionId: DEMO_SESSION_ID,
    messages: [freshGreeting()],
  };
}

function loadProfile(): Profile {
  if (typeof window === "undefined") return defaultProfile();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Profile;
      if (parsed.sessionId === DEMO_SESSION_ID) return parsed;
    }
  } catch {
    // ignore
  }
  return defaultProfile();
}

function mapBackendMessages(msgs: BackendMessage[]): Msg[] {
  return msgs.map((m) => {
    const time = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const id = `api-${m.id}`;
    if (m.message_type === "document" && m.attachment_url) {
      return {
        id,
        role: "ai" as const,
        kind: "document" as const,
        filename: m.attachment_filename || m.content || "quotation.pdf",
        url: m.attachment_url.startsWith("http") ? m.attachment_url : `${API_BASE}${m.attachment_url}`,
        time,
      };
    }
    return {
      id,
      role: m.role === "customer" ? ("user" as const) : ("ai" as const),
      text: m.content,
      time,
    };
  });
}

function Index() {
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [profile.messages, typing]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/chat/${DEMO_SESSION_ID}/messages`);
      if (!res.ok) return;
      const msgs: BackendMessage[] = await res.json();
      if (!msgs.length) return;
      setProfile((p) => ({ ...p, messages: mapBackendMessages(msgs) }));
    } catch {
      // backend offline
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "visible") fetchMessages();
    };
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [fetchMessages]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput("");
    setProfile((p) => ({
      ...p,
      messages: [...p.messages, { id: makeId(), role: "user", text: trimmed, time: nowTime() }],
    }));
    setTyping(true);

    const typingStart = Date.now();
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: DEMO_SESSION_ID,
          name: profile.name,
          message: trimmed,
          message_id: `msg-${Date.now()}`,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const reply: string = data?.reply ?? "";
      const elapsed = Date.now() - typingStart;
      if (elapsed < 800) await new Promise((r) => setTimeout(r, 800 - elapsed));
      setTyping(false);
      if (reply) {
        setProfile((p) => ({
          ...p,
          messages: [...p.messages, { id: makeId(), role: "ai", text: reply, time: nowTime() }],
        }));
      }
      await fetchMessages();
    } catch {
      setTyping(false);
      setProfile((p) => ({
        ...p,
        messages: [
          ...p.messages,
          {
            id: makeId(),
            role: "system",
            text: "Message failed to send. Check backend connection.",
            time: nowTime(),
          },
        ],
      }));
    }
  }

  function handleReset() {
    setProfile({ ...defaultProfile() });
    setInput("");
    setTyping(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6"
      style={{ backgroundColor: "#0b141a", fontFamily: "Roboto, system-ui, -apple-system, sans-serif" }}
    >
      <div className="flex flex-col items-center gap-4 w-full max-w-[380px]">
        <div
          className="relative flex flex-col bg-white overflow-hidden w-full h-[100svh] sm:h-[720px] sm:rounded-[28px]"
          style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}
        >
          <div
            className="flex items-center gap-3 px-3 py-2.5 text-white shrink-0"
            style={{ backgroundColor: "#128C7E" }}
          >
            <img
              src={logoUrl}
              alt="AutoCranker"
              className="w-10 h-10 rounded-full shrink-0 object-cover bg-white"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-[15px] leading-tight">AutoCranker</div>
              <div className="text-[12px] opacity-90 leading-tight truncate">
                {profile.name} · {DEMO_SESSION_ID}
              </div>
            </div>
            <MoreVertical size={20} className="opacity-90" />
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5"
            style={{
              backgroundColor: "#ECE5DD",
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><circle cx='2' cy='2' r='1' fill='%23d8cfc2' opacity='0.4'/></svg>\")",
            }}
          >
            {profile.messages.map((m) => {
              if (m.role === "system") {
                return (
                  <div
                    key={m.id}
                    className="self-center my-1 px-3 py-1.5 rounded-md text-[12px] text-white"
                    style={{ backgroundColor: "#d9534f" }}
                  >
                    {m.text}
                  </div>
                );
              }
              if ("kind" in m && m.kind === "document") {
                return (
                  <a
                    key={m.id}
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="self-start max-w-[85%] flex items-center gap-3 px-3 py-2.5 rounded-lg shadow-sm border border-[#c5e1a5] bg-[#DCF8C6] text-[#111] hover:bg-[#d4f0bc] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-md bg-white/80 flex items-center justify-center shrink-0">
                      <FileText size={22} className="text-red-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium truncate">{m.filename}</div>
                      <div className="text-[11px] text-gray-600">PDF · Tap to open</div>
                    </div>
                    <span className="text-[11px] text-gray-500 shrink-0">{m.time}</span>
                  </a>
                );
              }
              if (!("text" in m)) return null;
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

        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-300 hover:text-white transition-colors"
        >
          <RotateCcw size={14} /> Reset local view
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

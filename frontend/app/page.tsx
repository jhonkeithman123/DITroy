"use client";

import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type Message = {
  role: "user" | "assistant";
  text: string;
};

type HealthStatus = {
  status: string;
  model_status?: string;
  provider?: string;
  model?: string;
  service?: string;
};
type Panel = "chat" | "history" | "profile";
type RecentChat = {
  conversation_id: string;
  title: string;
  updated_at: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const CONVERSATION_ID = "default";
const MIN_COMPOSER_HEIGHT = 96;
const MAX_COMPOSER_HEIGHT = 220;

export default function Page() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Welcome back. I am DITroy, your personal AI for DITrix. Your local workspace is ready.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [conversationId, setConversationId] = useState(CONVERSATION_ID);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePanel, setActivePanel] = useState<Panel>("chat");
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, MIN_COMPOSER_HEIGHT), MAX_COMPOSER_HEIGHT)}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > MAX_COMPOSER_HEIGHT ? "auto" : "hidden";
  }, [message]);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!response.ok) {
          throw new Error("Health check failed");
        }
        const data = await response.json();
        setHealth(data);
      } catch (error) {
        setHealth({
          status: "offline",
          model_status: "unknown",
          service: "ditroy-chat",
        });
      }
    }

    fetchHealth();
  }, []);

  useEffect(() => {
    fetchRecentChats();
  }, []);

  async function fetchRecentChats() {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations`);
      if (!response.ok) throw new Error("Conversation list failed");
      const data = await response.json();
      setRecentChats(data.conversations ?? []);
    } catch {
      setRecentChats([]);
    }
  }

  function handleComposerKeyDown(
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    const nextUserMessage: Message = { role: "user", text: trimmed };
    setMessages((current) => [...current, nextUserMessage]);
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversation_id: conversationId }),
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      const data = await response.json();
      const nextAssistantMessage: Message = {
        role: "assistant",
        text: data.reply || "No reply returned.",
      };

      setMessages((current) => [...current, nextAssistantMessage]);
      fetchRecentChats();
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Connection error. Please start the backend and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleNewChat() {
    try {
      const response = await fetch(`${API_BASE_URL}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_conversation_id: conversationId }),
      });
      if (!response.ok) throw new Error("Conversation creation failed");
      const data = await response.json();
      setConversationId(data.conversation_id);
      setMessages([{ role: "assistant", text: "New chat ready. Important saved facts were carried over." }]);
      setActivePanel("chat");
      fetchRecentChats();
    } catch {
      setMessages((current) => [...current, { role: "assistant", text: "Unable to start a new chat. Please check the backend connection." }]);
    }
  }

  function openRecentChat(chat: RecentChat) {
    setConversationId(chat.conversation_id);
    setMessages([{ role: "assistant", text: `Continuing: ${chat.title}` }]);
    setActivePanel("chat");
  }

  return (
    <main
      style={{
        width: "100vw",
        height: "100dvh",
        minHeight: "100dvh",
        background:
          "radial-gradient(circle at top, rgba(148,163,184,0.24), transparent 33%), linear-gradient(135deg, #0b1020 0%, #111827 45%, #0f172a 100%)",
        color: "#e5eefb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        overflow: "hidden",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <style jsx global>{`
        .ditroy-scroll {
          scrollbar-width: thin;
          scrollbar-color: #475569 transparent;
        }
        .ditroy-scroll::-webkit-scrollbar,
        .ditroy-composer::-webkit-scrollbar {
          width: 8px;
        }
        .ditroy-scroll::-webkit-scrollbar-track,
        .ditroy-composer::-webkit-scrollbar-track {
          background: transparent;
        }
        .ditroy-scroll::-webkit-scrollbar-thumb,
        .ditroy-composer::-webkit-scrollbar-thumb {
          background: #475569;
          border: 2px solid transparent;
          border-radius: 8px;
          background-clip: padding-box;
        }
        .ditroy-skeleton {
          background: linear-gradient(
            90deg,
            rgba(148, 163, 184, 0.08),
            rgba(148, 163, 184, 0.18),
            rgba(148, 163, 184, 0.08)
          );
          background-size: 200% 100%;
          animation: ditroy-shimmer 1.6s infinite;
        }
        @keyframes ditroy-shimmer {
          from {
            background-position: 200% 0;
          }
          to {
            background-position: -200% 0;
          }
        }
      `}</style>
      <div
        className="ditroy-workspace"
        style={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          background: "rgba(15, 23, 42, 0.82)",
          border: "1px solid rgba(148, 163, 184, 0.18)",
          boxShadow: "0 20px 70px rgba(15, 23, 42, 0.5)",
          borderRadius: 0,
          backdropFilter: "blur(14px)",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: sidebarOpen
            ? "260px minmax(0, 1fr)"
            : "68px minmax(0, 1fr)",
          transition: "grid-template-columns 220ms ease",
        }}
      >
        <aside
          className="ditroy-scroll"
          style={{
            background: "rgba(15, 23, 42, 0.7)",
            borderRight: "1px solid rgba(148, 163, 184, 0.12)",
            padding: "24px 18px",
            overflowY: "auto",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                background: "linear-gradient(135deg, #8b5cf6, #22c55e)",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                color: "white",
              }}
            >
              D
            </div>
            <div style={{ display: sidebarOpen ? "block" : "none" }}>
              <div
                style={{
                  fontSize: 13,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: "#94a3b8",
                }}
              >
                DITroy
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Workspace</div>
            </div>
          </div>

          <div
            style={{
              display: sidebarOpen ? "block" : "none",
              marginBottom: 18,
              color: "#94a3b8",
              fontSize: 12,
              letterSpacing: 1.1,
              textTransform: "uppercase",
            }}
          >
            Status
          </div>
          <div
            style={{
              border:
                health?.model_status === "degraded" ||
                health?.status === "offline"
                  ? "1px solid rgba(251, 191, 36, 0.35)"
                  : "1px solid rgba(34, 197, 94, 0.3)",
              background:
                health?.model_status === "degraded" ||
                health?.status === "offline"
                  ? "rgba(251, 191, 36, 0.08)"
                  : "rgba(34, 197, 94, 0.08)",
              color:
                health?.model_status === "degraded" ||
                health?.status === "offline"
                  ? "#fef3c7"
                  : "#bbf7d0",
              borderRadius: 14,
              padding: sidebarOpen ? "10px 12px" : 0,
              fontSize: 13,
              marginBottom: 18,
              width: sidebarOpen ? "auto" : 32,
              height: sidebarOpen ? "auto" : 32,
              display: "grid",
              placeItems: "center",
            }}
          >
            <span aria-hidden="true" style={{ fontSize: sidebarOpen ? 0 : 15 }}>
              {health?.status === "offline"
                ? "○"
                : health?.model_status === "degraded"
                  ? "!"
                  : "●"}
            </span>
            <span style={{ display: sidebarOpen ? "inline" : "none" }}>
              {health?.status === "offline"
                ? "Backend offline"
                : health?.model_status === "degraded"
                  ? "Model degraded"
                  : `DITroy ready (${health?.model ?? "ollama"})`}
            </span>
          </div>

          <div
            style={{
              display: sidebarOpen ? "block" : "none",
              color: "#94a3b8",
              fontSize: 12,
              letterSpacing: 1.1,
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Tools
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {["Chat", "Knowledge", "Settings"].map((item, idx) => (
              <button
                key={item}
                type="button"
                onClick={() => item === "Chat" && setActivePanel("chat")}
                style={{
                  background:
                    idx === 0 ? "rgba(148,163,184,0.08)" : "transparent",
                  border:
                    idx === 0
                      ? "1px solid rgba(148,163,184,0.12)"
                      : "1px solid transparent",
                  color: idx === 0 ? "#f8fafc" : "#cbd5e1",
                  borderRadius: 12,
                  padding: sidebarOpen ? "10px 12px" : 0,
                  fontSize: 14,
                  textAlign: "left",
                  cursor: "pointer",
                  width: sidebarOpen ? "auto" : 32,
                  height: sidebarOpen ? "auto" : 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: sidebarOpen ? "flex-start" : "center",
                  boxSizing: "border-box",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-grid",
                    placeItems: "center",
                    width: 18,
                    height: 18,
                    marginRight: sidebarOpen ? 8 : 0,
                    color: "#94a3b8",
                  }}
                >
                  {item === "Chat" ? "✦" : item === "Knowledge" ? "⌘" : "⚙"}
                </span>
                <span style={{ display: sidebarOpen ? "inline" : "none" }}>
                  {item}
                </span>
              </button>
            ))}
          </div>
          <div
            style={{ display: sidebarOpen ? "block" : "none", marginTop: 24 }}
          >
            <div
              style={{
                color: "#94a3b8",
                fontSize: 11,
                letterSpacing: 1.1,
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Recent chats
            </div>
            {recentChats.length === 0 && <div style={{ color: "#64748b", fontSize: 12, padding: "8px 10px" }}>No saved chats yet</div>}
            {recentChats.slice(0, 5).map((chat, index) => (
              <button
                key={chat.conversation_id}
                type="button"
                onClick={() => openRecentChat(chat)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  width: "100%",
                  padding: "9px 10px",
                  border: 0,
                  borderRadius: 10,
                  background: "transparent",
                  color: "#cbd5e1",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 24,
                    height: 24,
                    flex: "0 0 auto",
                    border: "1px solid rgba(148,163,184,.18)",
                    borderRadius: 8,
                    color: "#a78bfa",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {index + 1}
                </span>
                <span>
                  {chat.title}
                  <small
                    style={{
                      display: "block",
                      marginTop: 3,
                      color: "#64748b",
                      fontSize: 10,
                    }}
                  >
                    {index === 0 ? "Most recent" : "Recent"}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setActivePanel("profile")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              marginTop: 24,
              padding: "16px 0 0",
              border: 0,
              borderTop: "1px solid rgba(148,163,184,.12)",
              background: "transparent",
              color: "#e2e8f0",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: 32,
                height: 32,
                flex: "0 0 auto",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                color: "white",
                fontWeight: 700,
              }}
            >
              A
            </span>
            <span style={{ display: sidebarOpen ? "block" : "none" }}>
              <strong>Alex Morgan</strong>
              <small
                style={{ display: "block", marginTop: 3, color: "#94a3b8" }}
              >
                Local account
              </small>
            </span>
          </button>
        </aside>

        <section
          style={{ display: "flex", flexDirection: "column", minHeight: 0 }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "22px 26px",
              borderBottom: "1px solid rgba(148,163,184,0.12)",
              background: "rgba(15, 23, 42, 0.45)",
            }}
          >
            <div>
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: 12,
                  letterSpacing: 1.1,
                  textTransform: "uppercase",
                }}
              >
                DITrix personal AI
              </div>
              <h1 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 700 }}>
                {activePanel === "chat"
                  ? "DITroy Personal AI"
                  : activePanel === "history"
                    ? "Chat history"
                    : "Account profile"}
              </h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                onClick={() => setSidebarOpen((open) => !open)}
                aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  background: "rgba(148,163,184,0.04)",
                  color: "#e2e8f0",
                  borderRadius: 12,
                  width: 38,
                  height: 38,
                  fontSize: 18,
                  cursor: "pointer",
                }}
              >
                {sidebarOpen ? "‹" : "›"}
              </button>
              <button
                type="button"
                onClick={handleNewChat}
                aria-label="Start a new chat conversation"
                title="Start a new chat conversation"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  background: "rgba(148,163,184,0.04)",
                  color: "#e2e8f0",
                  borderRadius: 999,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <span aria-hidden="true" style={{ display: "grid", placeItems: "center", width: 18, height: 18, border: "1px solid rgba(226,232,240,.7)", borderRadius: 6, fontSize: 14, lineHeight: 1 }}>+</span>
                New chat
              </button>
              <span style={{ border: "1px solid rgba(148, 163, 184, 0.2)", background: "rgba(148,163,184,0.04)", color: "#e2e8f0", borderRadius: 999, padding: "10px 14px", fontSize: 13, fontWeight: 600 }}>Local-only prototype</span>
            </div>
          </header>

          {activePanel === "chat" && (
            <div
              className="ditroy-scroll"
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "26px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {messages.map((entry, index) => (
                <div
                  key={`${entry.role}-${index}`}
                  style={{
                    alignSelf:
                      entry.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "78%",
                    padding: "14px 16px",
                    borderRadius: 18,
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap",
                    background:
                      entry.role === "user"
                        ? "linear-gradient(135deg, #7c3aed, #2563eb)"
                        : "rgba(15, 23, 42, 0.8)",
                    border:
                      entry.role === "user"
                        ? "1px solid rgba(139, 92, 246, 0.32)"
                        : "1px solid rgba(148,163,184,0.12)",
                    color: "#f8fafc",
                  }}
                >
                  {entry.text}
                </div>
              ))}
            </div>
          )}

          {activePanel === "chat" && (
            <form
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 12,
                padding: "18px 26px 24px",
                borderTop: "1px solid rgba(148,163,184,0.12)",
                background: "rgba(15, 23, 42, 0.4)",
              }}
            >
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Ask DITroy anything..."
                rows={1}
                className="ditroy-composer"
                style={{
                  flex: 1,
                  minHeight: 54,
                  maxHeight: 140,
                  padding: "16px 18px",
                  borderRadius: 16,
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "rgba(15, 23, 42, 0.7)",
                  color: "#e2e8f0",
                  resize: "none",
                  fontSize: 15,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  border: "none",
                  borderRadius: 16,
                  background: loading
                    ? "linear-gradient(135deg, rgba(124,58,237,0.55), rgba(37,99,235,0.55))"
                    : "linear-gradient(135deg, #7c3aed, #2563eb)",
                  color: "white",
                  minWidth: 120,
                  height: 54,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: "0 14px 30px rgba(59, 130, 246, 0.38)",
                }}
              >
                {loading ? "Thinking..." : "Send"}
              </button>
            </form>
          )}
          {activePanel === "history" && (
            <div
              className="ditroy-scroll"
              style={{ flex: 1, overflowY: "auto", padding: 26 }}
            >
              <div
                className="ditroy-skeleton"
                style={{
                  width: 220,
                  height: 28,
                  borderRadius: 8,
                  marginBottom: 24,
                }}
              />
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="ditroy-skeleton"
                  style={{
                    height: 130,
                    marginBottom: 14,
                    border: "1px solid rgba(148,163,184,.1)",
                    borderRadius: 16,
                  }}
                />
              ))}
            </div>
          )}
          {activePanel === "profile" && (
            <div
              className="ditroy-scroll"
              style={{ flex: 1, overflowY: "auto", padding: 26 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  marginBottom: 28,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #f59e0b, #ef4444)",
                    color: "white",
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  A
                </div>
                <div>
                  <strong>Alex Morgan</strong>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>
                    Local account
                  </div>
                </div>
              </div>
              <div
                className="ditroy-skeleton"
                style={{
                  width: "65%",
                  height: 13,
                  borderRadius: 5,
                  marginBottom: 14,
                }}
              />
              <div
                className="ditroy-skeleton"
                style={{
                  width: "45%",
                  height: 13,
                  borderRadius: 5,
                  marginBottom: 24,
                }}
              />
              <div
                className="ditroy-skeleton"
                style={{ height: 150, borderRadius: 16 }}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

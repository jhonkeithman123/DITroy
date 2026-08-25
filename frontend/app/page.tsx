"use client";

import { FormEvent, useEffect, useState } from "react";

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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Page() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Welcome back. Your local AI workspace is ready for the next prompt.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);

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
        body: JSON.stringify({ message: trimmed }),
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

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, rgba(148,163,184,0.24), transparent 33%), linear-gradient(135deg, #0b1020 0%, #111827 45%, #0f172a 100%)",
        color: "#e5eefb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1180,
          minHeight: 760,
          background: "rgba(15, 23, 42, 0.82)",
          border: "1px solid rgba(148, 163, 184, 0.18)",
          boxShadow: "0 20px 70px rgba(15, 23, 42, 0.5)",
          borderRadius: 28,
          backdropFilter: "blur(14px)",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "260px minmax(0, 1fr)",
        }}
      >
        <aside
          style={{
            background: "rgba(15, 23, 42, 0.7)",
            borderRight: "1px solid rgba(148, 163, 184, 0.12)",
            padding: "24px 18px",
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
            <div>
              <div
                style={{
                  fontSize: 13,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  color: "#94a3b8",
                }}
              >
                Ditroy
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Workspace</div>
            </div>
          </div>

          <div
            style={{
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
                health?.model_status === "degraded" || health?.status === "offline"
                  ? "1px solid rgba(251, 191, 36, 0.35)"
                  : "1px solid rgba(34, 197, 94, 0.3)",
              background:
                health?.model_status === "degraded" || health?.status === "offline"
                  ? "rgba(251, 191, 36, 0.08)"
                  : "rgba(34, 197, 94, 0.08)",
              color:
                health?.model_status === "degraded" || health?.status === "offline"
                  ? "#fef3c7"
                  : "#bbf7d0",
              borderRadius: 14,
              padding: "10px 12px",
              fontSize: 13,
              marginBottom: 18,
            }}
          >
            {health?.status === "offline"
              ? "Backend offline"
              : health?.model_status === "degraded"
                ? "Model degraded"
                : `Local model ready (${health?.model ?? "ollama"})`}
          </div>

          <div
            style={{
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
              <div
                key={item}
                style={{
                  background:
                    idx === 0 ? "rgba(148,163,184,0.08)" : "transparent",
                  border:
                    idx === 0
                      ? "1px solid rgba(148,163,184,0.12)"
                      : "1px solid transparent",
                  color: idx === 0 ? "#f8fafc" : "#cbd5e1",
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontSize: 14,
                }}
              >
                {item}
              </div>
            ))}
          </div>
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
                Personal assistant
              </div>
              <h1 style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 700 }}>
                Ditroy Local Chat
              </h1>
            </div>
            <button
              type="button"
              style={{
                border: "1px solid rgba(148, 163, 184, 0.2)",
                background: "rgba(148,163,184,0.04)",
                color: "#e2e8f0",
                borderRadius: 999,
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Local-only prototype
            </button>
          </header>

          <div
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
                  alignSelf: entry.role === "user" ? "flex-end" : "flex-start",
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
              placeholder="Ask your local model anything..."
              rows={1}
              style={{
                flex: 1,
                minHeight: 54,
                maxHeight: 140,
                padding: "16px 18px",
                borderRadius: 16,
                border: "1px solid rgba(148,163,184,0.18)",
                background: "rgba(15, 23, 42, 0.7)",
                color: "#e2e8f0",
                resize: "vertical",
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
        </section>
      </div>
    </main>
  );
}

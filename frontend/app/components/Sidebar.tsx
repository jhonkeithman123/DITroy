"use client";

import type { HealthStatus, Panel, RecentChat } from "./types";

export type SidebarProps = {
  open: boolean;
  health: HealthStatus | null;
  recentChats: RecentChat[];
  userEmail: string;
  authProvider: string;
  displayName: string;
  avatarUrl: string;
  onTogglePanel: (panel: Panel) => void;
  onOpenChat: (chat: RecentChat) => void;
};

export function Sidebar({
  open,
  health,
  recentChats,
  userEmail,
  authProvider,
  displayName,
  avatarUrl,
  onTogglePanel,
  onOpenChat,
}: SidebarProps) {
  const healthy =
    health?.model_status !== "degraded" && health?.status !== "offline";
  const avatarStyle = {
    background: avatarUrl
      ? `url(${avatarUrl}) center / cover`
      : "linear-gradient(135deg, #f59e0b, #ef4444)",
  };

  return (
    <aside className="ditroy-scroll" style={styles.aside}>
      <div style={styles.brandRow}>
        <div style={styles.brandMark}>D</div>
        <div style={{ display: open ? "block" : "none" }}>
          <div style={styles.eyebrow}>DITroy</div>
          <div style={styles.brandName}>Workspace</div>
        </div>
      </div>
      <div style={{ ...styles.sectionLabel, display: open ? "block" : "none" }}>
        Status
      </div>
      <div
        style={{
          ...styles.status,
          border: healthy
            ? "1px solid rgba(34,197,94,.3)"
            : "1px solid rgba(251,191,36,.35)",
          background: healthy ? "rgba(34,197,94,.08)" : "rgba(251,191,36,.08)",
          color: healthy ? "#bbf7d0" : "#fef3c7",
          padding: open ? "10px 12px" : 0,
          width: open ? "auto" : 32,
          height: open ? "auto" : 32,
          display: open ? "flex" : "grid",
          alignItems: "center",
          justifyContent: open ? "flex-start" : "center",
        }}
      >
        <span aria-hidden="true">
          {health?.status === "offline"
            ? "○"
            : health?.model_status === "degraded"
              ? "!"
              : "●"}
        </span>
        <span style={{ display: open ? "inline" : "none" }}>
          {health?.status === "offline"
            ? "Backend offline"
            : health?.model_status === "degraded"
              ? "Model degraded"
              : `DITroy ready (${health?.model ?? "ollama"})`}
        </span>
      </div>
      <div style={{ ...styles.sectionLabel, display: open ? "block" : "none" }}>
        Tools
      </div>
      <div style={styles.tools}>
        {(["Chat", "Knowledge", "Settings"] as const).map((item, index) => (
          <button
            key={item}
            type="button"
            onClick={() => item === "Chat" && onTogglePanel("chat")}
            style={{
              ...styles.toolButton,
              background: index === 0 ? "rgba(148,163,184,.08)" : "transparent",
              border:
                index === 0
                  ? "1px solid rgba(148,163,184,.12)"
                  : "1px solid transparent",
              color: index === 0 ? "#f8fafc" : "#cbd5e1",
              padding: open ? "10px 12px" : 0,
              width: open ? "auto" : 32,
              height: open ? "auto" : 32,
              justifyContent: open ? "flex-start" : "center",
            }}
          >
            <span aria-hidden="true" style={{ ...styles.toolIcon, marginRight: open ? 8 : 0 }}>
              {item === "Chat" ? "✦" : item === "Knowledge" ? "⌘" : "⚙"}
            </span>
            <span style={{ display: open ? "inline" : "none" }}>{item}</span>
          </button>
        ))}
      </div>
      <div style={{ display: open ? "block" : "none", marginTop: 24 }}>
        <div style={styles.sectionLabel}>Recent chats</div>
        {recentChats.length === 0 && (
          <div style={styles.empty}>No saved chats yet</div>
        )}
        {recentChats.slice(0, 5).map((chat, index) => (
          <button
            key={chat.conversation_id}
            type="button"
            onClick={() => onOpenChat(chat)}
            style={styles.chatButton}
          >
            <span style={styles.chatNumber}>{index + 1}</span>
            <span>
              {chat.title}
              <small style={styles.chatMeta}>
                {index === 0 ? "Most recent" : "Recent"}
              </small>
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onTogglePanel("profile")}
        style={styles.accountButton}
      >
        <span style={{ ...styles.avatar, ...avatarStyle }}>
          {avatarUrl ? "" : displayName.charAt(0).toUpperCase()}
        </span>
        <span style={{ display: open ? "block" : "none" }}>
          <strong>{userEmail || "Local account"}</strong>
          <small style={styles.chatMeta}>{authProvider}</small>
        </span>
      </button>
    </aside>
  );
}

const styles = {
  aside: {
    background: "rgba(15,23,42,.7)",
    borderRight: "1px solid rgba(148,163,184,.12)",
    padding: "24px 18px",
    overflowY: "auto" as const,
    minWidth: 0,
  },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 28,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 12,
    background: "linear-gradient(135deg,#8b5cf6,#22c55e)",
    display: "grid",
    placeItems: "center",
    fontWeight: 700,
    color: "white",
  },
  eyebrow: {
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    color: "#94a3b8",
  },
  brandName: { fontSize: 16, fontWeight: 700 },
  sectionLabel: {
    color: "#94a3b8",
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: "uppercase" as const,
    marginBottom: 12,
  },
  status: {
    borderRadius: 14,
    fontSize: 13,
    marginBottom: 18,
    display: "grid",
    placeItems: "center",
    gap: 7,
  },
  tools: { display: "grid", gap: 10 },
  toolButton: {
    fontSize: 14,
    textAlign: "left" as const,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    boxSizing: "border-box" as const,
    overflow: "hidden",
    whiteSpace: "nowrap" as const,
    borderRadius: 12,
  },
  toolIcon: {
    display: "inline-grid",
    placeItems: "center",
    width: 18,
    height: 18,
    marginRight: 8,
    color: "#94a3b8",
  },
  empty: { color: "#64748b", fontSize: 12, padding: "8px 10px" },
  chatButton: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    padding: "9px 10px",
    border: 0,
    borderRadius: 10,
    background: "transparent",
    color: "#cbd5e1",
    textAlign: "left" as const,
    cursor: "pointer",
  },
  chatNumber: {
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
  },
  chatMeta: { display: "block", marginTop: 3, color: "#64748b", fontSize: 10 },
  accountButton: {
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
    textAlign: "left" as const,
    cursor: "pointer",
  },
  avatar: {
    display: "grid",
    placeItems: "center",
    width: 32,
    height: 32,
    flex: "0 0 auto",
    borderRadius: "50%",
    color: "white",
    fontWeight: 700,
  },
};

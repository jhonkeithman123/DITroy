"use client";

import type { Panel } from "./types";

export function WorkspaceHeader({
  panel,
  sidebarOpen,
  onToggleSidebar,
  onNewChat,
}: {
  panel: Panel;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat: () => void;
}) {
  return (
    <header style={styles.header}>
      <div>
        <div style={styles.eyebrow}>DITrix personal AI</div>
        <h1 style={styles.title}>
          {panel === "chat"
            ? "DITroy Personal AI"
            : panel === "history"
              ? "Chat history"
              : "Account profile"}
        </h1>
      </div>
      <div style={styles.actions}>
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          style={styles.iconButton}
        >
          {sidebarOpen ? "‹" : "›"}
        </button>
        <button type="button" onClick={onNewChat} style={styles.newChat}>
          <span aria-hidden="true">+</span> New chat
        </button>
        <span style={styles.badge}>Local-only prototype</span>
      </div>
    </header>
  );
}

const styles = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "22px 26px",
    borderBottom: "1px solid rgba(148,163,184,.12)",
    background: "rgba(15,23,42,.45)",
  },
  eyebrow: {
    color: "#94a3b8",
    fontSize: 12,
    letterSpacing: 1.1,
    textTransform: "uppercase" as const,
  },
  title: { margin: "4px 0 0", fontSize: 28, fontWeight: 700 },
  actions: { display: "flex", alignItems: "center", gap: 10 },
  iconButton: {
    border: "1px solid rgba(148,163,184,.2)",
    background: "rgba(148,163,184,.04)",
    color: "#e2e8f0",
    borderRadius: 12,
    width: 38,
    height: 38,
    fontSize: 18,
    cursor: "pointer",
  },
  newChat: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid rgba(148,163,184,.2)",
    background: "rgba(148,163,184,.04)",
    color: "#e2e8f0",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  badge: {
    border: "1px solid rgba(148,163,184,.2)",
    background: "rgba(148,163,184,.04)",
    color: "#e2e8f0",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 600,
  },
};

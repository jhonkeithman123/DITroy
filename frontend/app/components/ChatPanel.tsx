"use client";

import type {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
} from "react";
import type { Message } from "./types";

export type ChatPanelProps = {
  messages: Message[];
  message: string;
  loading: boolean;
  composerRef: RefObject<HTMLTextAreaElement>;
  onMessageChange: (value: string) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent) => void;
};

export function ChatPanel({
  messages,
  message,
  loading,
  composerRef,
  onMessageChange,
  onKeyDown,
  onSubmit,
}: ChatPanelProps) {
  return (
    <>
      <div className="ditroy-scroll" style={styles.messages}>
        {messages.map((entry, index) => (
          <div
            key={`${entry.role}-${index}`}
            style={{
              ...styles.bubble,
              alignSelf: entry.role === "user" ? "flex-end" : "flex-start",
              background:
                entry.role === "user"
                  ? "linear-gradient(135deg,#7c3aed,#2563eb)"
                  : "rgba(15,23,42,.8)",
              border:
                entry.role === "user"
                  ? "1px solid rgba(139,92,246,.32)"
                  : "1px solid rgba(148,163,184,.12)",
            }}
          >
            {entry.text}
          </div>
        ))}
      </div>
      <form onSubmit={onSubmit} style={styles.form}>
        <textarea
          ref={composerRef}
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask DITroy anything..."
          rows={1}
          className="ditroy-composer"
          style={styles.composer}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ ...styles.send, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Thinking..." : "Send"}
        </button>
      </form>
    </>
  );
}

const styles = {
  messages: {
    flex: 1,
    overflowY: "auto" as const,
    padding: 26,
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  bubble: {
    maxWidth: "78%",
    padding: "14px 16px",
    borderRadius: 18,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap" as const,
    color: "#f8fafc",
  },
  form: {
    display: "flex",
    alignItems: "flex-end",
    gap: 12,
    padding: "18px 26px 24px",
    borderTop: "1px solid rgba(148,163,184,.12)",
    background: "rgba(15,23,42,.4)",
  },
  composer: {
    flex: 1,
    minHeight: 54,
    maxHeight: 140,
    padding: "16px 18px",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,.18)",
    background: "rgba(15,23,42,.7)",
    color: "#e2e8f0",
    resize: "none" as const,
    fontSize: 15,
    outline: "none",
  },
  send: {
    border: 0,
    borderRadius: 16,
    background: "linear-gradient(135deg,#7c3aed,#2563eb)",
    color: "white",
    minWidth: 120,
    height: 54,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
  },
};

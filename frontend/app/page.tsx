"use client";

import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { ChatPanel } from "./components/ChatPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { ProfilePanel } from "./components/ProfilePanel";
import { Sidebar } from "./components/Sidebar";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { DitroyClient } from "@131fgh/ditroy-client";
import type {
  Message,
  Panel,
  RecentChat,
  HealthStatus,
} from "./components/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const ditroy = new DitroyClient({ baseUrl: API_BASE_URL });
const MIN_COMPOSER_HEIGHT = 96;
const MAX_COMPOSER_HEIGHT = 220;

type StoredMessage = { role: string; content: string; created_at: string };

export default function Page() {
  const router = useRouter();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Welcome back. I am DITroy, your personal AI for DITrix. Your local workspace is ready.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [conversationId, setConversationId] = useState("default");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePanel, setActivePanel] = useState<Panel>("chat");
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [userEmail, setUserEmail] = useState("");
  const [displayName, setDisplayName] = useState("Local account");
  const [accountCreatedAt, setAccountCreatedAt] = useState("");
  const [authProvider, setAuthProvider] = useState("Local account");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);

  function applySessionUser(user: User) {
    const metadata = user.user_metadata ?? {};
    const email = user.email ?? "";
    setUserEmail(email);
    setDisplayName(
      metadata.display_name ??
        metadata.full_name ??
        metadata.name ??
        email.split("@")[0] ??
        "DITroy user",
    );
    setAccountCreatedAt(
      user.created_at ? new Date(user.created_at).toLocaleDateString() : "",
    );
    setAuthProvider(
      user.app_metadata?.provider === "email"
        ? "Email account"
        : `${user.app_metadata?.provider ?? "Supabase"} account`,
    );
    setAvatarUrl(metadata.avatar_url ?? "");
  }

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/auth");
      else {
        applySessionUser(data.session.user);
        setAuthReady(true);
      }
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) router.replace("/auth");
        else {
          applySessionUser(session.user);
          setAuthReady(true);
        }
      },
    );
    return () => subscription.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, MIN_COMPOSER_HEIGHT), MAX_COMPOSER_HEIGHT)}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > MAX_COMPOSER_HEIGHT ? "auto" : "hidden";
  }, [message]);

  useEffect(() => {
    ditroy
      .getHealth()
      .then((data) => setHealth(data as unknown as HealthStatus))
      .catch(() =>
        setHealth({
          status: "offline",
          model_status: "unknown",
          service: "ditroy-chat",
        }),
      );
    fetchRecentChats();
  }, []);

  async function fetchRecentChats() {
    try {
      const data = await ditroy.listConversations();
      setRecentChats(data.conversations ?? []);
    } catch {
      setRecentChats([]);
    }
  }

  function handleComposerKeyDown(
    event: ReactKeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    setMessages((current) => [
      ...current,
      { role: "user", text: trimmed },
      { role: "assistant", text: "" },
    ]);
    setMessage("");
    setLoading(true);

    try {
      let accumulated = "";
      for await (const token of ditroy.chatStream({
        message: trimmed,
        conversationId,
      })) {
        accumulated += token;
        setMessages((current) => {
          const next = [...current];
          const lastIdx = next.length - 1;
          if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
            next[lastIdx] = { ...next[lastIdx], text: accumulated };
          }
          return next;
        });
      }

      if (!accumulated) {
        const data = await ditroy.chat({ message: trimmed, conversationId });
        setMessages((current) => {
          const next = [...current];
          const lastIdx = next.length - 1;
          if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
            next[lastIdx] = { ...next[lastIdx], text: data.reply || "No reply returned." };
          }
          return next;
        });
      }
      fetchRecentChats();
    } catch {
      try {
        const data = await ditroy.chat({ message: trimmed, conversationId });
        setMessages((current) => {
          const next = [...current];
          const lastIdx = next.length - 1;
          if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
            next[lastIdx] = { ...next[lastIdx], text: data.reply || "No reply returned." };
          }
          return next;
        });
        fetchRecentChats();
      } catch {
        setMessages((current) => {
          const next = [...current];
          const lastIdx = next.length - 1;
          if (lastIdx >= 0 && next[lastIdx].role === "assistant") {
            next[lastIdx] = {
              role: "assistant",
              text: "Connection error. Please check backend connection and try again.",
            };
          }
          return next;
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleNewChat() {
    try {
      const data = await ditroy.createConversation({
        sourceConversationId: conversationId,
      });
      setConversationId(data.conversation_id);
      setMessages([
        {
          role: "assistant",
          text: "New chat ready. Important saved facts were carried over.",
        },
      ]);
      setActivePanel("chat");
      fetchRecentChats();
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Unable to start a new chat. Please check the backend connection.",
        },
      ]);
    }
  }

  async function openRecentChat(chat: RecentChat) {
    setConversationId(chat.conversation_id);
    setActivePanel("chat");
    setLoading(true);
    try {
      const data = await ditroy.getMessages(chat.conversation_id, { limit: 300 });
      const loaded = (data.messages ?? ([] as StoredMessage[]))
        .filter(
          (entry: StoredMessage) =>
            entry.role === "user" || entry.role === "assistant",
        )
        .map((entry: StoredMessage) => ({
          role: entry.role as Message["role"],
          text: entry.content,
        }));
      setMessages(
        loaded.length
          ? loaded
          : [
              {
                role: "assistant",
                text: "This chat has no saved messages yet.",
              },
            ],
      );
    } catch {
      setMessages([
        {
          role: "assistant",
          text: "Unable to load this conversation right now. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAvatarChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file || !supabase) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      window.alert("Choose an image smaller than 2 MB.");
      return;
    }
    setAvatarBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar.${extension}`;
      const upload = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });
      if (upload.error) throw upload.error;
      const publicUrl = supabase.storage.from("avatars").getPublicUrl(path)
        .data.publicUrl;
      const nextAvatarUrl = `${publicUrl}?v=${Date.now()}`;
      const updated = await supabase.auth.updateUser({
        data: { avatar_url: nextAvatarUrl },
      });
      if (updated.error) throw updated.error;
      setAvatarUrl(nextAvatarUrl);
    } catch (error) {
      window.alert(
        `Could not save profile picture: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleSignOut() {
    if (supabase) await supabase.auth.signOut();
    else router.replace("/auth");
  }

  if (!authReady)
    return <main style={styles.loading}>Checking account...</main>;
  return (
    <main style={styles.shell}>
      <div
        style={{
          ...styles.workspace,
          gridTemplateColumns: sidebarOpen
            ? "260px minmax(0,1fr)"
            : "68px minmax(0,1fr)",
        }}
      >
        <Sidebar
          open={sidebarOpen}
          health={health}
          recentChats={recentChats}
          userEmail={userEmail}
          authProvider={authProvider}
          displayName={displayName}
          avatarUrl={avatarUrl}
          onTogglePanel={setActivePanel}
          onOpenChat={openRecentChat}
        />
        <section style={styles.content}>
          <WorkspaceHeader
            panel={activePanel}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen((open) => !open)}
            onNewChat={handleNewChat}
          />
          {activePanel === "chat" && (
            <ChatPanel
              messages={messages}
              message={message}
              loading={loading}
              composerRef={composerRef}
              onMessageChange={setMessage}
              onKeyDown={handleComposerKeyDown}
              onSubmit={handleSubmit}
            />
          )}
          {activePanel === "history" && <HistoryPanel />}
          {activePanel === "profile" && (
            <ProfilePanel
              displayName={displayName}
              userEmail={userEmail}
              authProvider={authProvider}
              accountCreatedAt={accountCreatedAt}
              avatarUrl={avatarUrl}
              avatarBusy={avatarBusy}
              avatarInputRef={avatarInputRef}
              supabaseConfigured={Boolean(supabase)}
              onAvatarChange={handleAvatarChange}
              onChooseAvatar={() => avatarInputRef.current?.click()}
              onSignOut={handleSignOut}
            />
          )}
        </section>
      </div>
    </main>
  );
}

const styles = {
  shell: {
    width: "100vw",
    height: "100dvh",
    minHeight: "100dvh",
    background:
      "radial-gradient(circle at top,rgba(148,163,184,.24),transparent 33%),linear-gradient(135deg,#0b1020 0%,#111827 45%,#0f172a 100%)",
    color: "#e5eefb",
    overflow: "hidden",
    fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif",
  },
  workspace: {
    width: "100%",
    height: "100%",
    minHeight: 0,
    background: "rgba(15,23,42,.82)",
    border: "1px solid rgba(148,163,184,.18)",
    boxShadow: "0 20px 70px rgba(15,23,42,.5)",
    backdropFilter: "blur(14px)",
    overflow: "hidden",
    display: "grid",
    transition: "grid-template-columns 220ms ease",
  },
  content: { display: "flex", flexDirection: "column" as const, minHeight: 0 },
  loading: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    background: "#0b1020",
    color: "#cbd5e1",
    fontFamily: "Inter,ui-sans-serif,system-ui,sans-serif",
  },
};

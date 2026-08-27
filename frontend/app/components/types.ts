export type Message = {
  role: "user" | "assistant";
  text: string;
};

export type HealthStatus = {
  status: string;
  model_status?: string;
  provider?: string;
  model?: string;
  service?: string;
};

export type Panel = "chat" | "history" | "profile";

export type RecentChat = {
  conversation_id: string;
  title: string;
  updated_at: string;
};

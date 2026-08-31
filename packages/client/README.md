# @131fgh/ditroy-client (v0.2.0)

Universal JavaScript and TypeScript SDK for the **DITroy Multi-Provider AI Cognitive Backend**.

Connect any web, mobile, or backend application (Node.js, Next.js, React, Vue, Svelte, Express, Electron, React Native, Bun, Deno) to DITroy with complete type safety, automated multi-provider failover, real-time token streaming, and memory persistence.

---

## 📦 Installation

```bash
npm install @131fgh/ditroy-client
# or
pnpm add @131fgh/ditroy-client
# or
yarn add @131fgh/ditroy-client
```

---

## 🚀 Quick Start

### 1. Basic Chat with Persistent Memory & Automatic Fact Extraction

```typescript
import { DitroyClient } from "@131fgh/ditroy-client";

// Initialize client (defaults to http://localhost:8000 or process.env.DITROY_API_URL)
const ditroy = new DitroyClient({
  baseUrl: "http://localhost:8000",
  timeoutMs: 30000,
});

async function main() {
  // 1. Send a message - facts inside quotes are automatically indexed
  const res = await ditroy.chat({
    message: 'Please remember that our project code is "Project Phoenix".',
    conversationId: "session-1",
  });
  console.log("DITroy:", res.reply);

  // 2. Spawn a new conversation inheriting remembered facts
  const newSession = await ditroy.createConversation({
    sourceConversationId: "session-1",
  });
  console.log(`Created new thread: ${newSession.conversation_id} (${newSession.inherited_facts} facts inherited)`);

  // 3. Ask about the fact in the new thread
  const followup = await ditroy.chat({
    message: "What is our project code?",
    conversationId: newSession.conversation_id,
  });
  console.log("DITroy:", followup.reply);
}

main();
```

---

### 2. Real-Time Token-by-Token Streaming (`chatStream`)

Stream responses with ultra-low latency directly to your UI or console:

```typescript
import { DitroyClient } from "@131fgh/ditroy-client";

const ditroy = new DitroyClient();

async function streamDemo() {
  const stream = ditroy.chatStream({
    message: "Explain quantum computing in 3 sentences.",
    conversationId: "stream-demo",
  });

  process.stdout.write("DITroy: ");
  for await (const token of stream) {
    process.stdout.write(token);
  }
  console.log();
}

streamDemo();
```

---

### 3. Multi-Provider Diagnostics & Cascading Failover

When DITroy backend is run with `MODEL_PROVIDER=fallback`, you can inspect active primary providers and health across all cloud and local models:

```typescript
import { DitroyClient } from "@131fgh/ditroy-client";

const ditroy = new DitroyClient();

const health = await ditroy.getHealth();
console.log("Overall Health:", health.status);
console.log("Active Primary Provider:", health.active_primary); // e.g. 'groq' or 'gemini'

// Inspect individual providers in the pool
if (health.providers) {
  for (const [provider, detail] of Object.entries(health.providers)) {
    console.log(`- ${provider}: ${detail.status} (${detail.model || "N/A"})`);
  }
}
```

---

### 4. Render / Cloud Keepalive Ping

Prevent free tier backends (e.g. Render / Hugging Face) from sleeping:

```typescript
import { DitroyClient } from "@131fgh/ditroy-client";

const ditroy = new DitroyClient({
  baseUrl: "https://your-app.onrender.com",
  cronSecret: "your-optional-secret",
});

// Send a keepalive ping
const keepalive = await ditroy.pingKeepalive();
console.log(`Server Uptime: ${keepalive.uptime_human}, Pings Received: ${keepalive.pings_received}`);
```

---

## 🛠️ API Reference

### `new DitroyClient(options?)`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `baseUrl` | `string` | `http://localhost:8000` | Backend API base URL (or `DITROY_API_URL` / `NEXT_PUBLIC_API_URL`). |
| `timeoutMs` | `number` | `60000` | Request timeout in milliseconds. |
| `headers` | `Record<string, string>` | `{}` | Custom HTTP headers included with all requests. |
| `authToken` | `string` | `undefined` | Optional Bearer JWT token for authenticated endpoints. |
| `cronSecret` | `string` | `undefined` | Optional secret for `/api/cron/keepalive` protection. |
| `customFetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation (useful for mocks or Node < 18). |

### Methods

| Method | Signature | Description |
| :--- | :--- | :--- |
| `chat` | `(request: string \| ChatRequest) => Promise<ChatResponse>` | Sends a message prompt, executes fact extraction and memory context, returns AI reply. |
| `chatStream` | `(request: string \| ChatRequest, options?: ChatStreamOptions) => AsyncIterableIterator<string>` | Streams AI tokens in real-time. |
| `createConversation` | `(request?: NewConversationRequest) => Promise<NewConversationResponse>` | Creates a new conversation thread, inheriting facts. |
| `listConversations` | `() => Promise<ConversationListResponse>` | Returns list of recent conversations and titles. |
| `getMessages` | `(conversationId: string, options?: { limit?: number }) => Promise<ConversationMessagesResponse>` | Retrieves message history for a conversation. |
| `getHealth` | `() => Promise<HealthStatus>` | Returns provider statuses, active primary, and backend health. |
| `getKeepalive` | `(secret?: string) => Promise<KeepaliveStatus>` | Queries the keepalive status and uptime of the backend. |
| `pingKeepalive` | `(secret?: string) => Promise<KeepaliveStatus>` | Sends a keepalive ping signal. |

---

## ⚡ Error Handling

```typescript
import { DitroyClient, DitroyAPIError, DitroyNetworkError } from "@131fgh/ditroy-client";

const ditroy = new DitroyClient();

try {
  const response = await ditroy.chat("Hello!");
} catch (err) {
  if (err instanceof DitroyAPIError) {
    console.error(`API Error ${err.status}: ${err.message}`, err.data);
  } else if (err instanceof DitroyNetworkError) {
    console.error(`Network / Connection Error: ${err.message}`);
  }
}
```

---

## 📄 License

MIT © DITroy Team

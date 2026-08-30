# @131fgh/ditroy-client

Universal JavaScript and TypeScript SDK for the **DITroy AI Backend**.

Allows any JavaScript or TypeScript project (Node.js, Next.js, React, Express, Vite, Electron, React Native, Bun, Deno) to connect to the DITroy AI Engine with complete type safety.

---

## 📦 Installation

### From NPM
```bash
npm install @131fgh/ditroy-client
# or
pnpm add @131fgh/ditroy-client
# or
yarn add @131fgh/ditroy-client
```

---

## 🚀 Quick Start

### TypeScript / ES Modules (Next.js, Node 18+, Vite)

```typescript
import { DitroyClient } from "@131fgh/ditroy-client";

// 1. Initialize client (defaults to http://localhost:8000 or process.env.DITROY_API_URL)
const ditroy = new DitroyClient({
  baseUrl: "http://localhost:8000",
  timeoutMs: 30000,
});

async function main() {
  // 2. Chat with automated fact extraction & persistent context
  const response = await ditroy.chat({
    message: "Remember that our lead architect is Sarah.",
    conversationId: "project-session-1",
  });
  console.log("DITroy:", response.reply);

  // 3. Create a new conversation session inheriting facts
  const newSession = await ditroy.createConversation({
    sourceConversationId: "project-session-1",
  });
  console.log("New session created:", newSession.conversation_id);

  // 4. Inquire in the new session (facts are remembered!)
  const followup = await ditroy.chat({
    message: "Who is our lead architect?",
    conversationId: newSession.conversation_id,
  });
  console.log("DITroy:", followup.reply);
}

main();
```

### Node.js CommonJS (JavaScript)

```javascript
const { DitroyClient } = require("@131fgh/ditroy-client");

const ditroy = new DitroyClient({ baseUrl: "http://localhost:8000" });

ditroy.chat("Hello DITroy!").then((res) => {
  console.log(res.reply);
});
```

---

## 🛠️ API Reference

### `new DitroyClient(options)`
- `baseUrl?: string` — Backend URL (default: `http://localhost:8000`).
- `timeoutMs?: number` — Request timeout in ms (default: `60000`).
- `headers?: Record<string, string>` — Custom headers.
- `authToken?: string` — Bearer token for authenticated endpoints.
- `customFetch?: typeof fetch` — Custom fetch implementation if needed.

### Methods

| Method | Parameters | Returns | Description |
|---|---|---|---|
| `chat(request)` | `string \| { message, conversationId? }` | `Promise<ChatResponse>` | Sends a message, processes context and returns AI reply. |
| `createConversation(request?)` | `{ sourceConversationId? }` | `Promise<NewConversationResponse>` | Starts a new thread, carrying over learned facts. |
| `listConversations()` | *none* | `Promise<ConversationListResponse>` | Returns list of past chats and timestamps. |
| `getMessages(id, options?)` | `conversationId, { limit? }` | `Promise<ConversationMessagesResponse>` | Retrieves message history for a conversation. |
| `getHealth()` | *none* | `Promise<HealthStatus>` | Returns local model and backend health status. |

---

## ⚡ Error Handling

```typescript
import { DitroyClient, DitroyAPIError, DitroyNetworkError } from "@131fgh/ditroy-client";

try {
  const result = await ditroy.chat({ message: "Hello" });
} catch (error) {
  if (error instanceof DitroyAPIError) {
    console.error(`API returned error code ${error.status}:`, error.message);
  } else if (error instanceof DitroyNetworkError) {
    console.error("Network failure or timeout:", error.message);
  }
}
```

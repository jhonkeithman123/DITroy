# DITroy AI: Cross-Language Portability & Import Guide

We have modularized the complete DITroy AI backend—including the **cognitive orchestrator**, **automated fact extraction**, **token-budgeted sliding context memory**, **identity prompt synthesis**, and **pluggable model clients**—so it is directly importable across both **Python** and **JavaScript / TypeScript** projects.

---

## 🏗️ Architecture Overview

```
                        ┌─────────────────────────────────────────────────────────┐
                        │                   DITroy AI Ecosystem                   │
                        └──────────────────────────┬──────────────────────────────┘
                                                   │
                ┌──────────────────────────────────┴──────────────────────────────────┐
                ▼                                                                     ▼
     [ Python In-Process Engine ]                                          [ JS / TS Universal SDK ]
       `ditroy-ai` Python Package                                            `@ditroy/client` NPM Package
                │                                                                     │
   ┌────────────┴─────────────┐                                         ┌─────────────┴────────────┐
   │ `from ditroy import ...` │                                         │ `import { DitroyClient }`│
   │ - DitroyEngine           │                                         │ - Full TypeScript Types  │
   │ - SQLiteMemoryStore      │                                         │ - Node / Browser / Edge  │
   │ - Fact Extraction        │                                         │ - Standard Error Classes │
   │ - Identity Synthesis     │                                         └─────────────┬────────────┘
   └────────────┬─────────────┘                                                       │
                │ (Wraps engine in FastAPI)                                           │ (HTTP JSON API)
                ▼                                                                     ▼
   ┌──────────────────────────┐                                         ┌──────────────────────────┐
   │   FastAPI Server         │ ◄───────────────────────────────────────┤   Next.js / Express /    │
   │   `backend/app/main.py`  │                                         │   Node / React / Vue     │
   └──────────────────────────┘                                         └──────────────────────────┘
```

---

## 🐍 1. Importing in Python Projects (`ditroy-ai`)

Any Python project (Django, Flask, Celery worker, Discord bot, CLI tool, or custom script) can now run the complete AI pipeline in-process.

### Installation

```bash
# From local monorepo / directory
pip install -e /path/to/Ditroy/backend

# Or directly from GitHub
pip install git+https://github.com/jhonkeithman123/DITroy.git#subdirectory=backend
```

### Usage Example

```python
from ditroy import DitroyEngine, DitroyConfig

# 1. Initialize engine
engine = DitroyEngine(
    config=DitroyConfig(
        model_name="llama3.2",
        memory_backend="sqlite",
        memory_path="./chat_memory.sqlite3",
        memory_token_budget=768,
    )
)

# 2. Chat with automated fact extraction and sliding memory
result = engine.chat(
    message='Please remember that the deploy key is "AKIA-SECRET-99".',
    conversation_id="session_1"
)
print("DITroy:", result.reply)

# 3. Create a new conversation session inheriting stored facts
new_conv = engine.create_conversation(source_conversation_id="session_1")
print(f"Created session {new_conv.conversation_id} with {new_conv.inherited_facts} inherited facts")

# 4. Chat in the new session (facts are remembered!)
followup = engine.chat(
    message="What was the deploy key?",
    conversation_id=new_conv.conversation_id
)
print("DITroy:", followup.reply)
```

---

## 🌐 2. Importing in JavaScript & TypeScript Projects (`@131fgh/ditroy-client`)

Any JavaScript or TypeScript project (Next.js, Remix, Vite, Node.js, Express, React Native, Electron, Bun, Deno) can import the type-safe client SDK.

### Installation

```bash
# In npm / pnpm / yarn projects:
npm install @131fgh/ditroy-client
```

### TypeScript / Next.js Example

```typescript
import { DitroyClient } from "@131fgh/ditroy-client";

const ditroy = new DitroyClient({
  baseUrl: process.env.DITROY_API_URL || "http://localhost:8000",
  timeoutMs: 30000,
});

async function run() {
  // Chat
  const response = await ditroy.chat({
    message: "Hello, what is your name?",
    conversationId: "user-chat-1",
  });
  console.log("AI Reply:", response.reply);

  // Inherit facts into a new session
  const newChat = await ditroy.createConversation({
    sourceConversationId: "user-chat-1",
  });

  // Get message history
  const history = await ditroy.getMessages(newChat.conversation_id);
  console.log("Messages:", history.messages);
}

run();
```

### Node.js (JavaScript / CommonJS & ESM)

```javascript
import { DitroyClient, DitroyAPIError } from "@131fgh/ditroy-client";

const ditroy = new DitroyClient({ baseUrl: "http://localhost:8000" });

try {
  const result = await ditroy.chat("Hello DITroy!");
  console.log(result.reply);
} catch (error) {
  if (error instanceof DitroyAPIError) {
    console.error("API Error:", error.status, error.message);
  }
}
```

---

## 🧪 Verification & Test Results

1. **Python Core Tests**:
   - `C:\tools\mambaforge\envs\ditroy\python.exe -m pytest backend/tests`
   - **Result**: `19 passed in 7.76s` (covers engine, memory compression, fact capture, fact inheritance, and FastAPI endpoints).
2. **TypeScript SDK Build & Tests**:
   - `pnpm --filter @ditroy/client build` -> Generated `.d.ts`, `.js`, and sourcemaps.
   - `node test_sdk.js` -> `✓ client.chat()`, `✓ client.createConversation()`, `✓ client.listConversations()`, `✓ client.getMessages()`, `✓ client.getHealth()`, `✓ DitroyAPIError handling`.
3. **Frontend Integration**:
   - Connected `frontend/app/page.tsx` directly to `@ditroy/client`.

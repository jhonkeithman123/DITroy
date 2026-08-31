# Ditroy AI Engine (`ditroy-ai`)

Modular personal AI cognitive backend with persistent memory, automated fact extraction, token budgeting, multi-cloud LLM orchestration, and zero-limit local Ollama fallback.

## Installation

### From Local Monorepo / Directory
```bash
pip install -e /path/to/Ditroy/backend
```

### From Git Repository
```bash
pip install git+https://github.com/jhonkeithman123/DITroy.git#subdirectory=backend
```

## Quick Start in Any Python Project

```python
from ditroy import DitroyEngine, DitroyConfig

# 1. Initialize engine with default or custom configuration
engine = DitroyEngine(
    config=DitroyConfig(
        model_provider="fallback",  # Auto-failover pool: Groq -> Gemini -> DeepSeek -> Z.AI -> Ollama
        memory_backend="sqlite",
        memory_path="./my_memory.sqlite3",
    )
)

# 2. Chat with automated fact extraction and memory compression
result = engine.chat(
    message='Remember that our project code is "Project Phoenix".',
    conversation_id="conv_1",
)
print(result.reply)

# 3. Create a new conversation session inheriting stored facts
new_conv = engine.create_conversation(source_conversation_id="conv_1")
print(f"Created new conversation: {new_conv.conversation_id} with {new_conv.inherited_facts} facts")

# 4. Chat in the new session (facts are remembered!)
followup = engine.chat(
    message="What is our project code?",
    conversation_id=new_conv.conversation_id,
)
print(followup.reply)
```

## Supported Model Providers & Multi-Provider Cascading Failover

Ditroy includes built-in clients for the top free and high-performance AI providers, plus a **Cascading Failover Pool** (`CascadeModelClient`) that automatically recovers from rate limits (`429`) or provider outages:

| Provider | Provider Identifier | Models Supported | Free Tier Strengths |
| :--- | :--- | :--- | :--- |
| **Cascading Pool (Recommended)** | `fallback` / `auto` | Chains all configured keys in priority order | Automatic recovery from 429 rate limits |
| **Google Gemini** | `gemini` | `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro` | Generous 15 RPM / 1M TPM / 1,500 RPD |
| **Groq** | `groq` | `openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `llama3.3` | Ultra-fast LPU speed (300-500 tok/s) |
| **DeepSeek** | `deepseek` | `deepseek-chat` (V3), `deepseek-reasoner` (R1) | High intelligence & step-by-step reasoning |
| **Z.AI / Zhipu GLM** | `zai` / `zhipu` | `glm-4-flash`, `glm-4` | Free GLM-4 tier |
| **Local Ollama** | `ollama` | `llama3.2`, `deepseek-r1:8b`, `qwen2.5:7b` | **100% Free Forever with Zero Rate Limits** |

## Components

- **`DitroyEngine`**: The central orchestrator combining identity, fact extraction, token-budgeted memory context, and model inference.
- **`ModelClient`**: Pluggable interface (`GroqModelClient`, `GeminiModelClient`, `DeepSeekModelClient`, `ZAIModelClient`, `LocalOllamaClient`, `CascadeModelClient`, `StubModelClient`).
- **`MemoryStore`**: Pluggable memory stores with token budget trimming (`SQLiteMemoryStore`, `SupabaseMemoryStore`).
- **`FastAPI App`**: Included HTTP API at `app.main:app` for network microservice access.

## Render Keepalive / Cron Job Endpoint

Render free tier instances sleep after 15 minutes of inactivity. Ditroy provides an exclusive keepalive receiver endpoint:

- **Endpoint**: `GET` / `POST` `/api/cron/keepalive` (aliases: `/cron`, `/ping`)
- **Sample Response**:
  ```json
  {
    "status": "ok",
    "message": "Keepalive signal received. Render server will stay awake.",
    "service": "ditroy-ai-backend",
    "version": "0.1.0",
    "uptime_seconds": 3600.0,
    "uptime_human": "1h 0m 0s",
    "pings_received": 6,
    "timestamp": "2026-08-31T06:45:00Z",
    "last_ping_at": "2026-08-31T06:35:00Z",
    "model_provider": "fallback",
    "memory_backend": "supabase"
  }
  ```

### Setting Up Free External Keepalive (e.g. cron-job.org / UptimeRobot)
1. Register on a free ping service such as [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com).
2. Create a new cron job / monitor targeting:
   `https://<YOUR-RENDER-APP>.onrender.com/api/cron/keepalive`
3. Set the schedule to run every **10 to 14 minutes** (Render sleeps at 15 minutes).
4. (Optional) If you configure `CRON_SECRET=your_secret_here` in Render environment variables:
   - Add HTTP Header `Authorization: Bearer your_secret_here` or `X-Cron-Key: your_secret_here`
   - Or append query param `?key=your_secret_here`

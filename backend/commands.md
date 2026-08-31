# Local development

## Help

From the repository root, display the available launcher commands with:

```powershell
pnpm dev help
```

The equivalent forms are `pnpm dev --help` and `pnpm dev -h`.

## Start everything

From the repository root, run one command:

```powershell
mamba activate ditroy
pnpm dev
```

The launcher starts or reuses Ollama, warms `llama3.2`, starts FastAPI on port 8000, and starts Next.js on port 3000. Stop the development services with Ctrl+C. Ollama may continue running as a background service.

## First-time model setup

```powershell
ollama pull llama3.2
```

## Use a custom Ollama model

Models created from an Ollama `Modelfile` are supported through the same model client as the base model. The API still adds DITroy identity, saved facts, and recent conversation memory before generation.

For example, after importing or creating a model named `ditroy-custom`:

```powershell
ollama create ditroy-custom -f .\Modelfile
$env:MODEL_PROVIDER = "ollama"
$env:MODEL_NAME = "ditroy-custom"
$env:OLLAMA_BASE_URL = "http://127.0.0.1:11434"
pnpm dev
```

`OLLAMA_MODEL` is also accepted as a compatibility alias for `MODEL_NAME`. No frontend or memory changes are required when switching models.

## Multi-Provider & Automatic Cascading Failover

Ditroy supports automatic failover across multiple free-tier cloud AI providers with local Ollama as the final zero-limit fallback:

```powershell
$env:MODEL_PROVIDER = "fallback"
$env:FALLBACK_PROVIDERS = "groq,gemini,deepseek,zai,ollama"
$env:GROQ_API_KEY = "your-groq-key"
$env:GEMINI_API_KEY = "your-gemini-key"
$env:DEEPSEEK_API_KEY = "your-deepseek-key"
$env:ZAI_API_KEY = "your-zai-key"
pnpm dev
```

If Groq hits a `429 Rate Limit`, Ditroy automatically routes to Google Gemini (15 RPM / 1M TPM), then DeepSeek, then Z.AI, and finally local Ollama.

## Local memory

Conversation memory is stored using a pluggable backend. The default backend is SQLite (`MEMORY_BACKEND=sqlite`) and stores data at `./data/memory.sqlite3`. Older context is compressed when it exceeds the token budget.

To customize it before starting the backend:

```powershell
$env:MEMORY_BACKEND = "sqlite"
$env:MEMORY_PATH = "./data/memory.sqlite3"
$env:MEMORY_TOKEN_BUDGET = "768"
```

## Supabase cloud database backend

The backend includes a native Supabase cloud adapter (`SupabaseMemoryStore`) allowing persistent cloud storage across container/serverless restarts.

1. Run the database migration script [backend/data/supabase_memory_schema.sql](file:///c:/Users/131fgh/Documents/Ditroy/backend/data/supabase_memory_schema.sql) in your **Supabase Dashboard -> SQL Editor**.
2. Configure your environment variables:

```powershell
$env:MEMORY_BACKEND = "supabase"
$env:SUPABASE_URL = "https://iaqvdbifphbvehwuohym.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
```

## Accounts and authentication

The frontend now includes Supabase email/password sign-in and account creation at `/auth`. Copy `frontend/.env.example` to `frontend/.env.local` and set the public Supabase URL and anon key from your project settings:

```powershell
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

When those values are present, the chat workspace redirects unauthenticated visitors to `/auth` and exposes sign out from the profile panel. When they are absent, local development can continue through the local fallback. Backend token verification and per-user conversation ownership should be enabled before making the API public.

## Resend email delivery

Supabase sends authentication emails through its configured SMTP provider. The backend does not need to call Resend directly.

1. In Resend, verify the domain you will send from and create a new API key.
2. In Supabase, open **Project Settings -> Authentication -> SMTP Settings**.
3. Enter:
	- SMTP host: `smtp.resend.com`
	- Port: `587`
	- Username: `resend`
	- Password: the new Resend API key
	- Sender email: an address on your verified domain
	- Sender name: `DITroy`
4. Under **Authentication -> URL Configuration**, set the site URL and add the frontend URL with `/auth` as an allowed redirect URL.
5. Under **Authentication -> Providers -> Email**, enable **Confirm email**.

Do not store the Resend API key in the frontend or commit it to the repository. If a key is ever exposed, revoke it in Resend and create a replacement.

If port 3000 or 8000 is already in use, the launcher stops and reports the occupied port. Stop that program first, then run `pnpm dev` again.

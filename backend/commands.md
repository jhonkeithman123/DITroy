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

## Local memory

Conversation memory is stored using a pluggable backend. The default backend is SQLite (`MEMORY_BACKEND=sqlite`) and stores data at `./data/memory.sqlite3`. Older context is compressed when it exceeds the token budget.

To customize it before starting the backend:

```powershell
$env:MEMORY_BACKEND = "sqlite"
$env:MEMORY_PATH = "./data/memory.sqlite3"
$env:MEMORY_TOKEN_BUDGET = "768"
```

## Future Supabase switch (prepared)

The codebase now includes a backend factory and a Supabase adapter scaffold so migration can be configuration-driven later.

When you are ready to migrate, set:

```powershell
$env:MEMORY_BACKEND = "supabase"
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
```

Note: the Supabase adapter is scaffolded but not fully implemented yet, so keep `MEMORY_BACKEND=sqlite` for active development right now.

If port 3000 or 8000 is already in use, the launcher stops and reports the occupied port. Stop that program first, then run `pnpm dev` again.

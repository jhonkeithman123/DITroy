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

Conversation memory is stored locally at `./data/memory.json` by default. Older context is compressed when it exceeds the token budget.

To customize it before starting the backend:

```powershell
$env:MEMORY_PATH = "./data/memory.json"
$env:MEMORY_TOKEN_BUDGET = "768"
```

If port 3000 or 8000 is already in use, the launcher stops and reports the occupied port. Stop that program first, then run `pnpm dev` again.

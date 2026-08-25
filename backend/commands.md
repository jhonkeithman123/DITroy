# Local development

From the repository root, run one command:

```powershell
mamba activate ditroy
pnpm dev
```

The launcher starts or reuses Ollama, starts FastAPI on port 8000, and starts Next.js on port 3000. Stop all three with Ctrl+C.

## First-time model setup

```powershell
ollama pull llama3.2
```

If port 3000 or 8000 is already in use, the launcher stops and reports the occupied port. Stop that program first, then run `pnpm dev` again.

# Architecture

This project follows a simple monorepo layout:

- `backend/` holds the FastAPI service and model integration code.
- `frontend/` holds the Next.js chat interface.
- `shared/` contains common configuration and repository automation scripts.

## Current goal

The first milestone is to provide a working local prototype with a health endpoint and a chat endpoint that can be called from a minimal frontend.

## Planned evolution

1. Replace the stub model client with a GGML or GPT4All-backed implementation.
2. Add optional RAG and embeddings.
3. Add streaming UX and persistence.
4. Add tests, moderation, deployment automation, and hardware-aware model selection.

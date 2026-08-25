plan.md

Project Roadmap and Technical Plan

This document describes a clear, actionable roadmap for building a small, generic open‑source chatbot that runs on modest hardware (RTX 2050, 4 GB VRAM) and is designed to be adjustable for future hardware upgrades. It is written so an AI agent can parse and act on it: tasks are explicit, components are modular, and configuration knobs are identified.

Overview

Goal: deliver a lightweight, privacy‑friendly chatbot using open‑source models and a Next.js frontend.Primary constraints: single machine with RTX 2050 (4 GB VRAM), i3 13th gen CPU, 8 GB RAM, 512 GB SSD.Design principles: modularity, minimal ops, graceful degradation to CPU/ggml, and clear upgrade paths.

Roadmap (milestones and tasks)

Milestone 0 — Project bootstrap (1–2 days)

Create monorepo skeleton (frontend, backend, shared, scripts, docs).

Add Turborepo + pnpm workspace config and cross‑platform Node scripts.

Add .gitignore, .env.example, README.md, docs/ARCHITECTURE.md.

Verify local dev flow: node scripts/dev.js starts backend and frontend.

Deliverables

package.json at root, turbo.json, pnpm-workspace.yaml

scripts/dev.js, scripts/lint.js, scripts/test.js, scripts/deploy.js

Basic README and docs placeholders

Milestone 1 — Minimal backend + frontend prototype (2–4 days)

Backend: FastAPI with a single /chat POST endpoint that accepts {message} and returns {reply}.

Frontend: Next.js chat UI (input, message list, send button) calling backend.

Model: integrate a ggml / llama.cpp or GPT4All small model for deterministic local inference (CPU fallback).

Test end‑to‑end locally with small prompts.

Deliverables

backend/app/main.py (FastAPI)

frontend/app/page.tsx (Next.js chat)

backend/models/ with ggml binary or instructions to download

Local runbook in docs/BACKEND.md

Milestone 2 — Optimize for RTX 2050 (4 GB VRAM) (3–7 days)

Evaluate three inference modes and pick primary:

llama.cpp / ggml (CPU, reliable) — default fallback.

bitsandbytes + transformers with load_in_4bit=True + offload (Python) — if model fits with offload.

Remote inference (cloud GPU) — optional fallback for heavy requests.

Implement ModelClient abstraction with two implementations:

LocalGGMLClient (calls llama.cpp binary or GPT4All CLI)

LocalPyClient (transformers + bitsandbytes with offload; used only if memory allows)

Add configuration flags: MODEL_PROVIDER=ggml|python|remote, MODEL_PATH, OFFLOAD_DIR.

Tune defaults for RTX 2050:

Use small 1–3B GGML models or aggressively quantized 4‑bit 7B models.

Limit max_new_tokens and context_length (e.g., 512–1024 tokens).

Use SSD offload folder for spilled tensors.

Deliverables

backend/services/model_client.py with provider switch

backend/config/defaults.py documenting memory knobs

Performance test script and sample prompts

Milestone 3 — Optional retrieval (RAG) and embeddings (2–4 days)

If knowledge grounding is required, add embeddings + vector store:

Use SentenceTransformers (all-MiniLM-L6-v2) on CPU for embeddings.

Use FAISS for local vector search.

Integrate retrieval pipeline in LangChain or a lightweight custom retriever.

Keep retrieval optional behind ENABLE_RAG=true.

Deliverables

backend/services/embeddings.py

backend/services/retriever.py

Example dataset ingestion script and FAISS index file

Milestone 4 — UX improvements and streaming (2–5 days)

Add streaming support (SSE or WebSocket) for token-by-token updates if backend supports streaming.

Improve frontend: streaming UI, message status, retry, and rate limit handling.

Add simple conversation history persistence (SQLite) with pruning.

Deliverables

SSE/WebSocket /chat/stream endpoint

Frontend streaming component and UX polish

backend/db/ with migrations and simple schema

Milestone 5 — Testing, safety, and deployment (3–7 days)

Add unit tests and integration tests for backend and frontend.

Add basic moderation: profanity filter and max prompt length.

Prepare Dockerfile for backend and deployment notes for Render/Railway (or remote GPU provider).

Deploy frontend to Vercel; backend to Render/Railway or a small cloud VM with GPU if needed.

Deliverables

CI pipeline (GitHub Actions) for lint/test/build

Dockerfile and docs/DEPLOYMENT.md

Monitoring basics: logs, request metrics, and simple alerting

Model plan (choices, sizes, and fallback strategies)

Primary model strategy (for RTX 2050)

Primary runtime: llama.cpp / GGML quantized models (q4_0 / q4_1) or GPT4All GGML builds.

Reason: guaranteed to run on 4 GB GPU/low‑RAM machines; minimal ops.

Model size: prefer 3B GGML or quantized 7B if available and tested.

Secondary runtime (optional): transformers + bitsandbytes with load_in_4bit=True and device_map="auto" + offload folder.

Use case: when a slightly better model is needed and memory tuning succeeds.

Remote fallback: host a 7B/13B model on a small cloud GPU and call it via HTTP when MODEL_PROVIDER=remote.

Embeddings

Default: sentence-transformers/all-MiniLM-L6-v2 on CPU.

Store: FAISS index on disk.

ModelClient abstraction (interface)

generate(prompt, max_tokens, temperature, stream=False) -> generator or string

embed(texts) -> list[vectors] (optional)

health_check() -> status

Config knobs (environment variables)

MODEL_PROVIDER=ggml|python|remote

MODEL_PATH=/path/to/model

OFFLOAD_DIR=/path/to/offload

MAX_TOKENS=512

CONTEXT_TOKENS=1024

ENABLE_RAG=true|false

EMBEDDING_MODEL=all-MiniLM-L6-v2

API_HOST=0.0.0.0

API_PORT=8000

Tech stack (components and responsibilities)

Backend

Language: Python 3.10+ (mamba/conda recommended)

Framework: FastAPI + Uvicorn

Model runtimes: llama.cpp (ggml) CLI; transformers + bitsandbytes (optional)

Embeddings: sentence-transformers

Vector DB: FAISS (local)

Orchestration: simple ModelClient abstraction; LangChain optional for pipelines

Storage: SQLite for conversation history; local disk for model files and FAISS index

Testing: pytest, flake8

Frontend

Framework: Next.js (App Router), TypeScript

UI: React components, Tailwind CSS (optional)

Hosting: Vercel

Communication: fetch for REST; EventSource or WebSocket for streaming

Dev tooling / Monorepo

Package manager: pnpm

Monorepo: Turborepo

Scripts: Node cross‑platform scripts in /scripts

CI/CD: GitHub Actions (lint, test, build), deploy steps for frontend/backend

Target device specs and upgrade paths

Baseline target (current)

GPU: RTX 2050 (4 GB VRAM)

CPU: Intel i3 13th gen

RAM: 8 GB DDR4

Storage: 512 GB SSD

Network: broadband for remote fallback

Operational constraints

Use GGML models or small quantized models.

Keep context and generation lengths small.

Run embeddings on CPU.

Expect higher latency for larger prompts.

Recommended upgrade tiers (if you need better performance)

Tier 1 (small upgrade)

GPU: RTX 3060 (12 GB) or RTX 4060 (8–12 GB)

RAM: 16 GB

Benefit: run 7B quantized models in PyTorch with better latency and larger context.

Tier 2 (moderate)

GPU: 1 × 24 GB (e.g., RTX 3090 / 4080 / A5000)

RAM: 32 GB

Benefit: run 13B models quantized, faster throughput, better concurrency.

Tier 3 (production)

Multi‑GPU or cloud GPU instances (A100 / H100 / equivalent)

Kubernetes or managed inference (vLLM/TGI)

Benefit: scale to many users, low latency, large context windows.

How to make the system adjustable

Use MODEL_PROVIDER env var to switch runtime without code changes.

Keep OFFLOAD_DIR and MAX_MEMORY settings in backend/config and expose them in shared/config.

Provide a benchmarks/ script that runs a small suite to detect available VRAM and recommend a provider and model automatically.

Add a hardware_profile.json that records detected GPU, VRAM, CPU, RAM; use it to choose defaults at startup.

Operational considerations and safety

Rate limiting: add per‑IP or per‑API key rate limits to avoid resource exhaustion.

Moderation: implement a simple content filter (blocklist + toxicity model) before generation.

Logging & privacy: log prompts and responses with redaction of secrets; store locally by default.

Backups: persist FAISS index and SQLite DB to disk and back up periodically.

Monitoring: basic metrics (requests/sec, latency, GPU memory usage) and alerts.

Actionable next steps (what the AI agent should do now)

Scaffold repo files: create monorepo root files, frontend and backend folders, and scripts/ per the plan.

Implement minimal FastAPI /chat that calls a ModelClient stub returning canned responses.

Implement LocalGGMLClient that wraps llama.cpp or GPT4All CLI and returns model output.

Create Next.js chat UI that calls /chat and displays replies.

Run local benchmark script to detect VRAM and set MODEL_PROVIDER default.

Iterate: swap in LocalPyClient (transformers + bitsandbytes) if benchmark shows enough memory; add FAISS retrieval if needed.

Files to create immediately (templates)

docs/PLAN.md (this file)

backend/app/main.py (FastAPI skeleton)

backend/services/model_client.py (interface)

backend/services/ggml_client.py (llama.cpp wrapper)

frontend/app/page.tsx (chat UI)

scripts/benchmark_hw.js (detect GPU/VRAM and write hardware_profile.json)

shared/config/defaults.py (env defaults and knobs)

Final notes

This plan prioritizes getting a working prototype on your current hardware using GGML/llama.cpp, while keeping the architecture flexible so you can upgrade to PyTorch + bitsandbytes or remote inference later. The ModelClient abstraction and environment knobs are the key levers that make the system adaptable.

If you want, I will now:

scaffold the exact files listed under “Files to create immediately” with ready‑to‑paste code, or

generate the scripts/benchmark_hw.js and backend/services/model_client.py first so you can detect and configure the best runtime for your RTX 2050.

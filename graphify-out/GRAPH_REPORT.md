# Graph Report - Ditroy  (2026-10-17)

## Corpus Check
- 70 files · ~26,354 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 5, .example 3, .sqlite3 2)

## Summary
- 180 nodes · 239 edges · 11 communities (7 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d1ed20cb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- model_client.py
- main.py
- dev.js
- scripts
- Local development
- package.json
- DeepSeekModelClient
- GeminiModelClient
- OpenRouterModelClient
- ZAIModelClient
- loadTester.js

## God Nodes (most connected - your core abstractions)
1. `scripts` - 18 edges
2. `ModelClient` - 15 edges
3. `create_model_client()` - 11 edges
4. `_sync_engine()` - 10 edges
5. `Local development` - 10 edges
6. `CascadeModelClient` - 9 edges
7. `main()` - 9 edges
8. `LocalOllamaClient` - 8 edges
9. `GroqModelClient` - 8 edges
10. `GeminiModelClient` - 8 edges

## Surprising Connections (you probably didn't know these)
- `DeepSeekModelClient` --inherits--> `ModelClient`  [EXTRACTED]
  backend/ditroy/services/model_client.py → backend/ditroy/services/model_client.py  _Bridges community 0 → community 6_
- `GeminiModelClient` --inherits--> `ModelClient`  [EXTRACTED]
  backend/ditroy/services/model_client.py → backend/ditroy/services/model_client.py  _Bridges community 0 → community 7_
- `OpenRouterModelClient` --inherits--> `ModelClient`  [EXTRACTED]
  backend/ditroy/services/model_client.py → backend/ditroy/services/model_client.py  _Bridges community 0 → community 8_
- `ZAIModelClient` --inherits--> `ModelClient`  [EXTRACTED]
  backend/ditroy/services/model_client.py → backend/ditroy/services/model_client.py  _Bridges community 0 → community 9_

## Import Cycles
- None detected.

## Communities (11 total, 4 thin omitted)

### Community 0 - "model_client.py"
Cohesion: 0.07
Nodes (8): CascadeModelClient, create_model_client(), CustomOllamaClient, GroqModelClient, LocalOllamaClient, ModelClient, _normalize_groq_model(), StubModelClient

### Community 1 - "main.py"
Cohesion: 0.09
Nodes (18): chat(), chat_stream(), ChatRequest, ChatResponse, ConversationMessage, create_conversation(), cron_keepalive(), CronKeepAliveResponse (+10 more)

### Community 2 - "dev.js"
Cohesion: 0.12
Nodes (15): children, fs, getModelProvider(), http, isOllamaRunning(), isPortAvailable(), main(), net (+7 more)

### Community 3 - "scripts"
Cohesion: 0.11
Nodes (18): scripts, build, dev, dev:cloud, dev:ollama, lint, seeResult, start:backend (+10 more)

### Community 4 - "Local development"
Cohesion: 0.17
Nodes (11): Accounts and authentication, Choose LLM Mode, First-time model setup, Help, Local development, Local memory, Multi-Provider & Automatic Cascading Failover, Resend email delivery (+3 more)

### Community 5 - "package.json"
Cohesion: 0.18
Nodes (10): devDependencies, loadtester-kit, turbo, name, packageManager, private, version, workspaces (+2 more)

### Community 10 - "loadTester.js"
Cohesion: 0.25
Nodes (4): apiDuration, options, pageDuration, wafChallenges

## Knowledge Gaps
- **2 isolated node(s):** `loadtester-kit`, `turbo`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 112 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ModelClient` connect `model_client.py` to `OpenRouterModelClient`, `ZAIModelClient`, `DeepSeekModelClient`, `GeminiModelClient`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **What connects `loadtester-kit`, `turbo` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `model_client.py` be split into smaller, more focused modules?**
  _Cohesion score 0.0728744939271255 - nodes in this community are weakly interconnected._
- **Should `main.py` be split into smaller, more focused modules?**
  _Cohesion score 0.0945945945945946 - nodes in this community are weakly interconnected._
- **Should `dev.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11857707509881422 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
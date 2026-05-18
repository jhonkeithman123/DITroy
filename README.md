# DITroy — v1 Console

This repository contains a minimal skeleton for DITroy v1: a Node.js console assistant with modular core components (NLP, dialogue, personality) and a simple CLI.

TypeScript setup (pnpm workspaces recommended):

1. Install pnpm (if you don't have it):

```bash
npm install -g pnpm
```

2. Install workspace dependencies:

```bash
pnpm install
```

3. Build and run demo (uses Turborepo):

```bash
pnpm run build   # runs turbo pipeline
pnpm start
```

You can inspect or run turbo directly:

```bash
pnpm run turbo -- run build
```

````

Run tests (build before running):

```bash
pnpm test
````

Or run the demo directly (requires `ts-node`):

```bash
pnpm run demo
```

Notes: this repository uses pnpm workspaces defined in `pnpm-workspace.yaml` and `package.json`.

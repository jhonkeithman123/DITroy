#!/usr/bin/env node
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const children = [];

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "127.0.0.1");
  });
}

function isOllamaRunning() {
  return new Promise((resolve) => {
    const request = http.get("http://127.0.0.1:11434/api/tags", (response) => {
      response.resume();
      resolve(response.statusCode >= 200 && response.statusCode < 500);
    });
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

function start(command, args, options) {
  const child = spawn(command, args, {
    ...options,
    cwd: options.cwd ?? root,
    stdio: "inherit",
    shell: options.shell ?? false,
  });
  children.push(child);
  return child;
}

async function main() {
  const [backendAvailable, frontendAvailable, ollamaRunning] =
    await Promise.all([
      isPortAvailable(8000),
      isPortAvailable(3000),
      isOllamaRunning(),
    ]);

  if (!backendAvailable || !frontendAvailable) {
    const occupied = [
      !backendAvailable && "8000 (backend)",
      !frontendAvailable && "3000 (frontend)",
    ]
      .filter(Boolean)
      .join(", ");
    console.error(
      `Port(s) already in use: ${occupied}. Stop the existing program first, then run pnpm dev again.`,
    );
    process.exitCode = 1;
    return;
  }

  if (ollamaRunning) {
    console.log("Ollama is already running on 127.0.0.1:11434. Reusing it.");
  } else {
    start("ollama", ["serve"]);
  }

  const python = process.env.CONDA_PREFIX
    ? path.join(process.env.CONDA_PREFIX, "python.exe")
    : "python";
  start(
    python,
    [
      "-m",
      "uvicorn",
      "app.main:app",
      "--reload",
      "--host",
      "127.0.0.1",
      "--port",
      "8000",
    ],
    {
      cwd: path.join(root, "backend"),
    },
  );
  start(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["exec", "next", "dev", "-p", "3000"], {
    cwd: path.join(root, "frontend"),
  });
}

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});
process.on("SIGTERM", stopAll);

main().catch((error) => {
  console.error(error);
  stopAll();
  process.exit(1);
});

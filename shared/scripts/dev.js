#!/usr/bin/env node
const { spawn } = require("node:child_process");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const children = [];
const model = "llama3.2";

function printHelp() {
  console.log(`Ditroy local development launcher

Usage:
  pnpm dev             Start Ollama, the FastAPI backend, and Next.js
  pnpm dev help        Show this help message
  pnpm dev --help      Show this help message

Services:
  Ollama               http://127.0.0.1:11434
  FastAPI backend      http://127.0.0.1:8000
  Next.js frontend     http://localhost:3000

Requirements:
  Activate the mamba environment named ditroy before starting.
  Pull the model once with: ollama pull llama3.2

Port behavior:
  The launcher stops if port 8000 or 3000 is already in use.
  Stop the existing program, then run pnpm dev again.`);
}

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

function waitForOllama(attempts = 20) {
  return new Promise((resolve, reject) => {
    const check = (remaining) => {
      isOllamaRunning().then((running) => {
        if (running) {
          resolve();
        } else if (remaining === 0) {
          reject(new Error("Ollama did not become ready on port 11434."));
        } else {
          setTimeout(() => check(remaining - 1), 500);
        }
      });
    };
    check(attempts);
  });
}

function warmModel() {
  return new Promise((resolve, reject) => {
    const request = http.request(
      "http://127.0.0.1:11434/api/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { body += chunk; });
        response.on("end", () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            console.log(`Ollama model ${model} is ready.`);
            resolve();
          } else {
            reject(new Error(`Ollama could not load ${model}: ${body}`));
          }
        });
      },
    );
    request.setTimeout(120000, () => {
      request.destroy();
      reject(new Error(`Timed out while loading Ollama model ${model}.`));
    });
    request.on("error", reject);
    request.write(JSON.stringify({
      model,
      prompt: "",
      stream: false,
      options: { num_predict: 1 },
    }));
    request.end();
  });
}

function start(command, args, options = {}) {
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
  const command = process.argv[2];
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

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

  await waitForOllama();
  await warmModel();

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
    shell: process.platform === "win32",
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

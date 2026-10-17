#!/usr/bin/env node
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const children = [];
const model = "llama3.2";

function getModelProvider(args = process.argv.slice(2)) {
  if (args.includes("--ollama") || args.includes("-o") || args.includes("ollama")) {
    return "ollama";
  }
  if (args.includes("--cloud") || args.includes("-c") || args.includes("cloud")) {
    return "fallback";
  }
  if (process.env.MODEL_PROVIDER) {
    return process.env.MODEL_PROVIDER.toLowerCase();
  }
  const envPath = path.join(root, "backend", ".env");
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("MODEL_PROVIDER=")) {
          return trimmed.split("=")[1].trim().replace(/^['"]|['"]$/g, "").toLowerCase();
        }
      }
    } catch (_) {}
  }
  return "fallback";
}

function printHelp() {
  console.log(`Ditroy launcher

Usage:
  pnpm dev                    Start services with default provider (.env / Cloud LLM)
  pnpm dev --cloud            Start services forcing Cloud LLM mode (skips Ollama)
  pnpm dev --ollama           Start services forcing local Ollama mode (starts & warms llama3.2)
  pnpm dev --backend-only     Start only the FastAPI backend (skips frontend)
  pnpm dev --prod             Start in production mode (no auto-reload)
  pnpm dev help               Show this help message

Options:
  --cloud, -c                 Use Cloud LLM cascade (Groq -> Gemini -> DeepSeek -> Z.AI -> OpenRouter)
  --ollama, -o                Use local Ollama (llama3.2) with automatic startup and warming
  --backend-only, -b          Start backend only (port 8000)
  --prod, -p                  Run backend in production mode without file reloading

Services:
  Ollama                      http://127.0.0.1:11434 (when active)
  FastAPI backend             http://127.0.0.1:8000
  Next.js frontend            http://localhost:3000
`);
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
  const args = process.argv.slice(2);
  if (args.includes("help") || args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  const isProd = args.includes("--prod") || args.includes("-p") || args.includes("prod");
  const isBackendOnly = args.includes("--backend-only") || args.includes("-b") || args.includes("backend");
  const provider = getModelProvider(args);
  const isCloudProvider = provider !== "ollama";

  const portChecks = [isPortAvailable(8000)];
  if (!isBackendOnly) {
    portChecks.push(isPortAvailable(3000));
  }
  if (!isCloudProvider) {
    portChecks.push(isOllamaRunning());
  }

  const results = await Promise.all(portChecks);
  const backendAvailable = results[0];
  const frontendAvailable = isBackendOnly ? true : results[1];
  const ollamaRunning = isCloudProvider ? false : (isBackendOnly ? results[1] : results[2]);

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

  if (isCloudProvider) {
    console.log(`Connected to cloud LLM provider (${provider}). Skipping Ollama.`);
  } else {
    console.log("Using local Ollama mode.");
    if (ollamaRunning) {
      console.log("Ollama is already running on 127.0.0.1:11434. Reusing it.");
    } else {
      console.log("Starting Ollama service...");
      start("ollama", ["serve"]);
    }

    await waitForOllama();
    await warmModel();
  }

  function getPythonPath() {
    if (process.env.CONDA_PREFIX) {
      return path.join(process.env.CONDA_PREFIX, "python.exe");
    }
    const mambaDitroyPython = "C:\\tools\\mambaforge\\envs\\ditroy\\python.exe";
    if (fs.existsSync(mambaDitroyPython)) {
      return mambaDitroyPython;
    }
    return "python";
  }

  const python = getPythonPath();
  
  const uvicornArgs = [
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "0.0.0.0",
    "--port",
    "8000",
  ];
  if (!isProd) {
    uvicornArgs.push("--reload");
  }

  console.log(`Starting FastAPI backend [${isProd ? "production" : "development"}] on port 8000...`);
  start(
    python,
    uvicornArgs,
    {
      cwd: path.join(root, "backend"),
      env: {
        ...process.env,
        MODEL_PROVIDER: provider,
      },
    },
  );

  if (!isBackendOnly) {
    console.log("Starting Next.js frontend on port 3000...");
    start(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["exec", "next", "dev", "-p", "3000"], {
      cwd: path.join(root, "frontend"),
      shell: process.platform === "win32",
    });
  }
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

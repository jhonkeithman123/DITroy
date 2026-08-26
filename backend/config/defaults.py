import os

MODEL_PROVIDER = os.getenv("MODEL_PROVIDER", "ggml")
MODEL_PATH = os.getenv("MODEL_PATH", "")
OFFLOAD_DIR = os.getenv("OFFLOAD_DIR", "./.offload")
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "512"))
CONTEXT_TOKENS = int(os.getenv("CONTEXT_TOKENS", "1024"))
ENABLE_RAG = os.getenv("ENABLE_RAG", "false").lower() == "true"
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
MEMORY_PATH = os.getenv("MEMORY_PATH", "./data/memory.json")
MEMORY_TOKEN_BUDGET = int(os.getenv("MEMORY_TOKEN_BUDGET", "768"))

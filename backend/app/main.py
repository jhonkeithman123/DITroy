from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from services.model_client import LocalOllamaClient

app = FastAPI(title="Ditroy Chat API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_client = LocalOllamaClient()


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("message must not be empty")
        return cleaned


class ChatResponse(BaseModel):
    reply: str


@app.get("/health")
def health_check():
    status = model_client.health_check()
    return {
        "status": "ok",
        "service": "ditroy-chat",
        "mode": "local-model",
        "provider": status.get("provider", "ollama"),
        "model": status.get("model", "llama3.2"),
        "model_status": status.get("status", "degraded"),
    }


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    prompt = request.message.strip()
    reply = model_client.generate(prompt)
    return ChatResponse(reply=reply)

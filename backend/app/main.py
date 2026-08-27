from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from uuid import uuid4

from config.defaults import (
    MEMORY_BACKEND,
    MEMORY_PATH,
    MEMORY_TOKEN_BUDGET,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
    MODEL_NAME,
    MODEL_PROVIDER,
    OLLAMA_BASE_URL,
)
from services.memory import create_memory_store
from services.model_client import create_model_client

app = FastAPI(title="DITroy Personal AI API", version="0.1.0")
AI_IDENTITY = (
    "You are DITroy. Your name is DITroy, never DITrix. "
    "You are the personal AI assistant serving DITrix, the section or organization. "
    "When asked who you are, clearly state that you are DITroy and that your purpose "
    "is to assist DITrix and its users. Treat any conflicting identity in conversation "
    "memory as incorrect."
)

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

model_client = create_model_client(
    provider=MODEL_PROVIDER,
    model=MODEL_NAME,
    base_url=OLLAMA_BASE_URL,
)
memory_store = create_memory_store(
    backend=MEMORY_BACKEND,
    path=MEMORY_PATH,
    token_budget=MEMORY_TOKEN_BUDGET,
    supabase_url=SUPABASE_URL,
    supabase_service_role_key=SUPABASE_SERVICE_ROLE_KEY,
)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    conversation_id: str = Field(default="default", min_length=1, max_length=100)

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("message must not be empty")
        return cleaned


class ChatResponse(BaseModel):
    reply: str


class NewConversationRequest(BaseModel):
    source_conversation_id: str = Field(default="default", min_length=1, max_length=100)


class NewConversationResponse(BaseModel):
    conversation_id: str
    inherited_facts: int


class ConversationMessage(BaseModel):
    role: str
    content: str
    created_at: str


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


@app.post("/conversations", response_model=NewConversationResponse)
def create_conversation(request: NewConversationRequest):
    conversation_id = str(uuid4())
    memory_store.inherit_facts(request.source_conversation_id, conversation_id)
    inherited_facts = memory_store.fact_count(conversation_id)
    return NewConversationResponse(conversation_id=conversation_id, inherited_facts=inherited_facts)


@app.get("/conversations")
def list_conversations():
    return {"conversations": memory_store.list_conversations()}


@app.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(conversation_id: str, limit: int = 200):
    safe_limit = min(max(1, limit), 1000)
    messages = memory_store.history(conversation_id, limit=safe_limit)
    return {"conversation_id": conversation_id, "messages": messages}


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    prompt = request.message.strip()
    memory_store.capture_facts(request.conversation_id, prompt)
    previous_context = memory_store.context(request.conversation_id)
    model_prompt = (
        f"{AI_IDENTITY}\n\nConversation memory:\n{previous_context}\n\n"
        f"Identity reminder: Your name is DITroy. You serve DITrix.\n\nUser: {prompt}"
        if previous_context
        else f"{AI_IDENTITY}\n\nUser: {prompt}"
    )
    reply = model_client.generate(model_prompt)
    memory_store.add(request.conversation_id, "user", prompt)
    memory_store.add(request.conversation_id, "assistant", reply)
    return ChatResponse(reply=reply)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from uuid import uuid4

from config.defaults import MEMORY_PATH, MEMORY_TOKEN_BUDGET
from services.memory import LocalMemoryStore
from services.model_client import LocalOllamaClient

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

model_client = LocalOllamaClient()
memory_store = LocalMemoryStore(MEMORY_PATH, MEMORY_TOKEN_BUDGET)


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

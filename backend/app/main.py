from __future__ import annotations

from uuid import uuid4
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from ditroy.config import DitroyConfig
from ditroy.engine import DitroyEngine
from ditroy.identity import DEFAULT_AI_IDENTITY

app = FastAPI(title="DITroy Personal AI API", version="0.1.0")
AI_IDENTITY = DEFAULT_AI_IDENTITY

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = DitroyEngine(
    config=DitroyConfig.from_env(),
    identity=AI_IDENTITY,
)

# Compatibility handles for test monkeypatching and direct access
model_client = engine.model_client
memory_store = engine.memory_store


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    conversation_id: str = Field(default="default", min_length=1, max_length=100)
    user_id: str | None = Field(default=None)

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
    user_id: str | None = Field(default=None)


class NewConversationResponse(BaseModel):
    conversation_id: str
    inherited_facts: int


class ConversationMessage(BaseModel):
    role: str
    content: str
    created_at: str


def _sync_engine() -> None:
    """Sync compatibility references with the engine in case of test overrides."""
    engine.model_client = model_client
    engine.memory_store = memory_store
    engine.identity = AI_IDENTITY


@app.get("/health")
def health_check():
    _sync_engine()
    return engine.health_check()


@app.post("/conversations", response_model=NewConversationResponse)
def create_conversation(request: NewConversationRequest):
    _sync_engine()
    res = engine.create_conversation(request.source_conversation_id, user_id=request.user_id)
    return NewConversationResponse(
        conversation_id=res.conversation_id,
        inherited_facts=res.inherited_facts,
    )


@app.get("/conversations")
def list_conversations():
    _sync_engine()
    return {"conversations": engine.list_conversations()}


@app.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(conversation_id: str, limit: int = 200):
    _sync_engine()
    messages = engine.get_messages(conversation_id, limit=limit)
    return {"conversation_id": conversation_id, "messages": messages}


import logging

logger = logging.getLogger("ditroy.api")


@app.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    _sync_engine()
    try:
        result = engine.chat(request.message, request.conversation_id, user_id=request.user_id)
        return ChatResponse(reply=result.reply)
    except Exception as exc:
        logger.error("Error during chat processing: %s", exc, exc_info=True)
        try:
            fallback_reply = engine.model_client.generate(request.message)
            return ChatResponse(reply=fallback_reply)
        except Exception:
            return ChatResponse(reply="I am currently experiencing a temporary processing issue. Please try again.")

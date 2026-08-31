from __future__ import annotations

import json
import logging
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator

from ditroy.config import DitroyConfig
from ditroy.engine import DitroyEngine
from ditroy.identity import DEFAULT_AI_IDENTITY
from ditroy.services.keepalive import KeepAliveTracker

logger = logging.getLogger("ditroy.api")

app = FastAPI(title="DITroy Personal AI API", version="0.2.0")
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

keepalive_tracker = KeepAliveTracker()

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


class CronKeepAliveResponse(BaseModel):
    status: str = "ok"
    message: str = "Keepalive signal received. Render server will stay awake."
    service: str = "ditroy-ai-backend"
    version: str = "0.1.0"
    uptime_seconds: float
    uptime_human: str
    pings_received: int
    timestamp: str
    last_ping_at: str | None = None
    model_provider: str
    model_name: str
    memory_backend: str


def _sync_engine() -> None:
    """Sync compatibility references with the engine in case of test overrides."""
    engine.model_client = model_client
    engine.memory_store = memory_store
    engine.identity = AI_IDENTITY


def _verify_cron_secret(
    authorization: str | None = None,
    x_cron_key: str | None = None,
    key: str | None = None,
    token: str | None = None,
) -> None:
    expected_secret = getattr(engine.config, "cron_secret", "")
    if not expected_secret:
        return

    provided_secret: str | None = None
    if authorization:
        if authorization.lower().startswith("bearer "):
            provided_secret = authorization[7:].strip()
        else:
            provided_secret = authorization.strip()
    elif x_cron_key:
        provided_secret = x_cron_key.strip()
    elif key:
        provided_secret = key.strip()
    elif token:
        provided_secret = token.strip()

    if not provided_secret or provided_secret != expected_secret:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: invalid or missing cron keepalive secret token",
        )


@app.get("/health")
def health_check():
    _sync_engine()
    return engine.health_check()


@app.api_route(
    "/api/cron/keepalive",
    methods=["GET", "POST", "HEAD"],
    response_model=CronKeepAliveResponse,
    summary="Exclusive Cron Job Keepalive Receiver",
    tags=["Cron Keepalive"],
)
@app.api_route(
    "/cron",
    methods=["GET", "POST", "HEAD"],
    response_model=CronKeepAliveResponse,
    include_in_schema=False,
)
@app.api_route(
    "/ping",
    methods=["GET", "POST", "HEAD"],
    response_model=CronKeepAliveResponse,
    include_in_schema=False,
)
def cron_keepalive(
    request: Request,
    authorization: str | None = Header(default=None),
    x_cron_key: str | None = Header(default=None, alias="x-cron-key"),
    key: str | None = Query(default=None),
    token: str | None = Query(default=None),
):
    _sync_engine()
    _verify_cron_secret(
        authorization=authorization,
        x_cron_key=x_cron_key,
        key=key,
        token=token,
    )
    ping_info = keepalive_tracker.record_ping()
    return CronKeepAliveResponse(
        status="ok",
        message="Keepalive signal received. Render server will stay awake.",
        service="ditroy-ai-backend",
        version="0.1.0",
        uptime_seconds=ping_info["uptime_seconds"],
        uptime_human=ping_info["uptime_human"],
        pings_received=ping_info["pings_received"],
        timestamp=ping_info["timestamp"],
        last_ping_at=ping_info["last_ping_at"],
        model_provider=engine.config.model_provider,
        model_name=engine.config.model_name,
        memory_backend=engine.config.memory_backend,
    )


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


@app.post("/chat/stream")
def chat_stream(request: ChatRequest):
    _sync_engine()

    def event_generator():
        try:
            for token in engine.chat_stream(request.message, request.conversation_id, user_id=request.user_id):
                payload = json.dumps({"token": token})
                yield f"data: {payload}\n\n"
        except Exception as exc:
            logger.error("Error during chat stream processing: %s", exc, exc_info=True)
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


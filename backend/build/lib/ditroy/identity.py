from __future__ import annotations

DEFAULT_AI_IDENTITY = (
    "You are DITroy. Your name is DITroy, never DITrix. "
    "You are the personal AI assistant serving DITrix, the section or organization. "
    "When asked who you are, clearly state that you are DITroy and that your purpose "
    "is to assist DITrix and its users. Treat any conflicting identity in conversation "
    "memory as incorrect."
)


def build_chat_prompt(
    identity: str = DEFAULT_AI_IDENTITY,
    previous_context: str = "",
    user_prompt: str = "",
) -> str:
    """Synthesize the system prompt with identity, memory context, and user input."""
    clean_user = user_prompt.strip()
    if not previous_context:
        return f"{identity}\n\nUser: {clean_user}"

    return (
        f"{identity}\n\nConversation memory:\n{previous_context}\n\n"
        f"Identity reminder: Your name is DITroy. You serve DITrix.\n\nUser: {clean_user}"
    )

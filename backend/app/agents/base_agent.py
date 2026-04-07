"""
Base Agent — foundation for all agentic workflows in iykyk-games.

Agents follow a simple think → act → observe loop.
Subclass BaseAgent and implement `run()` to define behaviour.
"""
from __future__ import annotations

import abc
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class Message:
    role:    str        # "system" | "user" | "assistant"
    content: str


@dataclass
class AgentContext:
    """Carries state across an agent's lifecycle."""
    session_id:  str                  = field(default_factory=lambda: str(uuid.uuid4()))
    messages:    list[Message]        = field(default_factory=list)
    metadata:    dict[str, Any]       = field(default_factory=dict)
    max_turns:   int                  = 10
    turn:        int                  = 0

    def add_message(self, role: str, content: str) -> None:
        self.messages.append(Message(role=role, content=content))

    @property
    def history(self) -> list[dict]:
        return [{"role": m.role, "content": m.content} for m in self.messages]


class BaseAgent(abc.ABC):
    """Abstract base for all iykyk-games agents."""

    name: str = "base_agent"
    description: str = "A base agent."

    def __init__(self, system_prompt: Optional[str] = None) -> None:
        self.system_prompt = system_prompt or self._default_system_prompt()

    def _default_system_prompt(self) -> str:
        return (
            "You are a helpful assistant for the IYKYK Games platform. "
            "You help players understand card game rules, strategies, and tips."
        )

    @abc.abstractmethod
    async def run(self, user_input: str, context: AgentContext) -> str:
        """Execute the agent for one turn. Must be implemented by subclasses."""
        ...

    def _build_messages(self, user_input: str, context: AgentContext) -> list[dict]:
        """Build the message list for the LLM call."""
        context.add_message("user", user_input)
        return context.history

    def _record_response(self, response: str, context: AgentContext) -> None:
        context.add_message("assistant", response)
        context.turn += 1

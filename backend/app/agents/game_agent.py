"""
GameAgent — AI-powered assistant that answers questions about card games.

Uses Anthropic's Claude when an API key is available, otherwise falls back
to a simple rule-based responder so the app works without any AI key.
"""
from __future__ import annotations

import os
from typing import Optional

from app.agents.base_agent import BaseAgent, AgentContext
from app.core.config import get_settings


GAME_KNOWLEDGE: dict[str, str] = {
    "poker": (
        "Poker is a family of card games combining skill, strategy, and luck. "
        "Players bet on the strength of their hand. Common variants include "
        "Texas Hold'em, Omaha, and Seven-Card Stud."
    ),
    "blackjack": (
        "Blackjack (21) is a casino card game where players try to beat the dealer "
        "by getting a hand value as close to 21 as possible without exceeding it. "
        "Face cards are worth 10, Aces are 1 or 11."
    ),
    "teen-patti": (
        "Teen Patti is a South Asian gambling card game similar to poker. "
        "Players are dealt 3 cards and bet on who has the best hand. "
        "Trail (three of a kind) is the highest hand."
    ),
    "rummy": (
        "Rummy is a group of matching-card games. Players draw and discard cards "
        "to form melds (sets of 3+ same rank, or sequences of 3+ same suit). "
        "First to meld all cards wins."
    ),
    "solitaire": (
        "Klondike Solitaire is a patience card game for one player. "
        "The goal is to move all cards to four foundation piles sorted by suit "
        "from Ace to King."
    ),
    "war": (
        "War is a simple card game for two players. Each player flips a card; "
        "the higher card wins both. Ties trigger 'war' — each player plays 3 "
        "face-down then 1 face-up, highest takes all."
    ),
}


class GameAgent(BaseAgent):
    name = "game_agent"
    description = "Answers questions about card games and provides strategy tips."

    def __init__(self) -> None:
        super().__init__()
        self.settings = get_settings()
        self._client = None

    def _get_anthropic_client(self):
        """Lazy-load the Anthropic client only if a key is configured."""
        if self._client is None and self.settings.anthropic_api_key:
            try:
                import anthropic
                self._client = anthropic.AsyncAnthropic(
                    api_key=self.settings.anthropic_api_key
                )
            except ImportError:
                pass
        return self._client

    def _default_system_prompt(self) -> str:
        return (
            "You are a friendly, knowledgeable card game assistant for IYKYK Games. "
            "You help players understand rules, strategies, and tips for card games "
            "including Poker, Blackjack, Teen Patti, Rummy, Solitaire, and War. "
            "Keep answers concise, practical, and engaging. "
            "If asked about something unrelated to card games, politely redirect."
        )

    async def run(self, user_input: str, context: AgentContext) -> str:
        client = self._get_anthropic_client()

        if client:
            return await self._run_with_claude(user_input, context, client)
        else:
            return self._fallback_response(user_input, context)

    async def _run_with_claude(self, user_input: str, context: AgentContext, client) -> str:
        messages = self._build_messages(user_input, context)
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            system=self.system_prompt,
            messages=[m for m in messages if m["role"] != "system"],
        )
        reply = response.content[0].text
        self._record_response(reply, context)
        return reply

    def _fallback_response(self, user_input: str, context: AgentContext) -> str:
        """Simple keyword-based fallback when no AI key is set."""
        query = user_input.lower()
        for slug, info in GAME_KNOWLEDGE.items():
            if slug.replace("-", " ") in query or slug in query:
                reply = f"Here's what I know about that game: {info}"
                self._record_response(reply, context)
                return reply

        reply = (
            "I'm your card game assistant! Ask me about Poker, Blackjack, "
            "Teen Patti, Rummy, Solitaire, or War — rules, tips, and strategy."
        )
        self._record_response(reply, context)
        return reply


def get_game_agent() -> GameAgent:
    return GameAgent()

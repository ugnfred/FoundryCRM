"""The generic Agent: wraps the Anthropic SDK with adaptive thinking, streaming,
and a manual tool-use loop. Each SDLC role is an instance of this class.
"""
from __future__ import annotations

from anthropic import Anthropic

from .config import OPUS
from .tools import DISPATCH

_client = Anthropic()  # reads ANTHROPIC_API_KEY from the environment

MAX_TOOL_TURNS = 25


def _extract_text(message) -> str:
    parts = [b.text for b in message.content if getattr(b, "type", "") == "text"]
    return "\n".join(parts).strip()


class Agent:
    def __init__(self, name: str, system: str, *,
                 model: str = OPUS, tools: list | None = None,
                 max_tokens: int = 16_000):
        self.name = name
        self.system = system
        self.model = model
        self.tools = tools or []
        self.max_tokens = max_tokens

    def run(self, prompt: str) -> str:
        """Run one task to completion, handling any tool calls along the way."""
        messages = [{"role": "user", "content": prompt}]

        for _ in range(MAX_TOOL_TURNS):
            kwargs = dict(
                model=self.model,
                max_tokens=self.max_tokens,
                system=self.system,
                messages=messages,
                thinking={"type": "adaptive"},
            )
            if self.tools:
                kwargs["tools"] = self.tools

            # Stream to stay under request timeouts for long documents.
            with _client.messages.stream(**kwargs) as stream:
                message = stream.get_final_message()

            messages.append({"role": "assistant", "content": message.content})

            if message.stop_reason != "tool_use":
                return _extract_text(message)

            # Execute every tool_use block and feed results back.
            results = []
            for block in message.content:
                if getattr(block, "type", "") != "tool_use":
                    continue
                fn = DISPATCH.get(block.name)
                output = fn(**block.input) if fn else f"ERROR: unknown tool {block.name}"
                print(f"   [{self.name}] tool: {block.name}({block.input})")
                results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": str(output),
                })
            messages.append({"role": "user", "content": results})

        return "ERROR: exceeded max tool turns without finishing."

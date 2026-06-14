"""Local tools the agents can call (read-only codebase access + dev git/write).

All file paths are confined to the repo root for safety. The Developer agent is
the only role given write/git tools, and even then it writes to a feature branch.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from .config import REPO_ROOT

MAX_READ_CHARS = 60_000


def _safe_path(rel: str) -> Path:
    """Resolve a repo-relative path and refuse anything outside the repo."""
    p = (REPO_ROOT / rel).resolve()
    if REPO_ROOT not in p.parents and p != REPO_ROOT:
        raise ValueError(f"Path escapes repo root: {rel}")
    return p


# --- Tool implementations ------------------------------------------------------
def read_file(path: str) -> str:
    try:
        p = _safe_path(path)
        if not p.is_file():
            return f"ERROR: not a file: {path}"
        text = p.read_text(encoding="utf-8", errors="replace")
        if len(text) > MAX_READ_CHARS:
            text = text[:MAX_READ_CHARS] + "\n...[truncated]..."
        return text
    except Exception as e:  # noqa: BLE001
        return f"ERROR: {e}"


def list_dir(path: str = ".") -> str:
    try:
        p = _safe_path(path)
        if not p.is_dir():
            return f"ERROR: not a directory: {path}"
        entries = []
        for child in sorted(p.iterdir()):
            if child.name in {".git", "node_modules", "__pycache__", ".venv"}:
                continue
            entries.append(child.name + ("/" if child.is_dir() else ""))
        return "\n".join(entries) or "(empty)"
    except Exception as e:  # noqa: BLE001
        return f"ERROR: {e}"


def search_code(pattern: str, glob: str = "") -> str:
    """Grep-like search via git grep (fast, respects .gitignore)."""
    try:
        cmd = ["git", "-C", str(REPO_ROOT), "grep", "-n", "-I", pattern]
        if glob:
            cmd += ["--", glob]
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        result = (out.stdout or out.stderr).strip()
        return result[:MAX_READ_CHARS] or "(no matches)"
    except Exception as e:  # noqa: BLE001
        return f"ERROR: {e}"


def git_checkout_branch(branch: str) -> str:
    """Create-or-switch to a branch (Developer only)."""
    try:
        subprocess.run(["git", "-C", str(REPO_ROOT), "checkout", "-B", branch],
                       capture_output=True, text=True, timeout=30, check=True)
        return f"On branch {branch}"
    except subprocess.CalledProcessError as e:
        return f"ERROR: {e.stderr or e.stdout}"


def write_file(path: str, content: str) -> str:
    """Write a file inside the repo (Developer only — use on a feature branch)."""
    try:
        p = _safe_path(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return f"Wrote {len(content)} chars to {path}"
    except Exception as e:  # noqa: BLE001
        return f"ERROR: {e}"


def git_diff(path: str = "") -> str:
    try:
        cmd = ["git", "-C", str(REPO_ROOT), "diff"]
        if path:
            cmd += ["--", path]
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return (out.stdout or "(no changes)")[:MAX_READ_CHARS]
    except Exception as e:  # noqa: BLE001
        return f"ERROR: {e}"


# --- Anthropic tool schemas ----------------------------------------------------
READ_TOOLS = [
    {
        "name": "read_file",
        "description": "Read a UTF-8 text file from the repo (repo-relative path).",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
    },
    {
        "name": "list_dir",
        "description": "List entries in a repo directory. Defaults to repo root.",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
        },
    },
    {
        "name": "search_code",
        "description": "Search the codebase for a regex/string (git grep). "
                       "Optional glob like 'backend/**/*.py'.",
        "input_schema": {
            "type": "object",
            "properties": {
                "pattern": {"type": "string"},
                "glob": {"type": "string"},
            },
            "required": ["pattern"],
        },
    },
]

WRITE_TOOLS = [
    {
        "name": "git_checkout_branch",
        "description": "Create or switch to a git branch. Do this before writing code.",
        "input_schema": {
            "type": "object",
            "properties": {"branch": {"type": "string"}},
            "required": ["branch"],
        },
    },
    {
        "name": "write_file",
        "description": "Write/overwrite a file in the repo. Only use on a feature branch.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "content": {"type": "string"},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "git_diff",
        "description": "Show the current git diff (optionally for one path).",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
        },
    },
]

# name -> callable
DISPATCH = {
    "read_file": read_file,
    "list_dir": list_dir,
    "search_code": search_code,
    "git_checkout_branch": git_checkout_branch,
    "write_file": write_file,
    "git_diff": git_diff,
}

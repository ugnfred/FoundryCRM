"""Central configuration: models, paths, and the project context blurb.

API key: set ANTHROPIC_API_KEY in your environment (or a .env file next to this
package). Nothing else needs editing to get started.
"""
from __future__ import annotations

import os
from pathlib import Path

# --- Optional .env loading (no hard dependency) --------------------------------
def _load_dotenv() -> None:
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


_load_dotenv()

# --- Models --------------------------------------------------------------------
# Per project policy: Opus 4.8 for thinking-heavy roles, Haiku for cheap ones.
OPUS = "claude-opus-4-8"
HAIKU = "claude-haiku-4-5"

# --- Paths ---------------------------------------------------------------------
# This file lives at: <repo>/agents/sdlc/config.py  ->  repo root is two up.
PKG_DIR = Path(__file__).resolve().parent
REPO_ROOT = PKG_DIR.parents[1]
DOCS_DIR = REPO_ROOT / "docs" / "sdlc"          # where artifacts are written
DOCS_DIR.mkdir(parents=True, exist_ok=True)

# --- Project context fed to every agent ---------------------------------------
PROJECT_CONTEXT = """\
Product: "foundry-erp" — a GST-compliant ERP/CRM for an Indian foundry /
manufacturing business.

Current tech stack:
- Frontend: React 18 + Vite, TanStack Query v5, TanStack Table v8,
  React Hook Form + Zod, Recharts, Zustand, shadcn/ui + Tailwind v3.
- Backend: FastAPI, Pydantic v2, ReportLab (PDF), NIC API (e-invoice).
- Data/Auth/Storage: Supabase (Postgres + Auth + Storage).

Existing modules: Quotations, Sales Orders, Invoices, Purchase Orders,
Inventory, E-Invoice, Dashboard, Settings (companies/customers/products).
GST logic: CGST+SGST for intra-state, IGST for inter-state (place_of_supply).

Target users: foundry sales, accounts, and admin staff in India.
"""

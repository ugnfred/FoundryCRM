# Foundry-ERP — SDLC Agent Crew Handover

## What this is
A team of role-based agents that mirror an Agile pipeline and produce real
document artifacts for the foundry-erp project. Built under `agents/sdlc/`.

Flow: **PM → (I approve PRD) → BA → (I approve BRD) → Scrum Master → Architect → Developer ↔ QA → UAT (I sign off)**

All artifacts are written to `docs/sdlc/`.

---

## Two ways to run it

### Option A — FREE (use Claude in VS Code) ✅ chosen
No API key, no payment. Claude (in the chat/IDE) acts as each role and writes
the same `docs/sdlc/*.md` files. Approval happens in chat: I say "review PRD.md",
you reply **"approved"** or **"change X"**.

To start: open this folder in VS Code with Claude and say:
> "Act as the Product Manager and draft docs/sdlc/PRD.md. Inspect the codebase first."

Then progress role by role, approving PRD and BRD before development.

### Option B — Paid API scripts (NOT in use)
Standalone Python scripts that call the Anthropic API (pay-as-you-go key required).
Kept in `agents/sdlc/` for later if I ever want automation. Needs a key in
`agents/sdlc/.env` and credit at console.anthropic.com. **Skipped — not paying.**

---

## The crew & artifacts (docs/sdlc/)
| Role | Output |
|------|--------|
| Product Manager | `PRD.md` — market scan, MoSCoW + MVP priorities, HAVE/MISSING gaps |
| Business Analyst | `CLARIFICATIONS.md`, `BRD.md` — scope, FR/NFR, use cases, traceability |
| Scrum Master | `BACKLOG.md` — epics, user stories, sprints, Definition of Done |
| Architect | `ARCHITECTURE.md` — design, data model, API contracts, ADRs |
| Developer | code on a `feature/<story>` branch + `DEV_*.md` |
| QA Tester | `TEST_*.md`, bug reports (PASS/FAIL) |
| UAT (PM+BA) | `UAT.md` + my sign-off |

## My approval gates
- I approve the **PRD** before BA starts.
- I approve the **BRD** before development starts.
- I sign off **UAT** before "ship".
- Developer only writes to a **feature branch**, never `main`.

---

## Project context (for any agent)
- Frontend: React 18 + Vite, TanStack Query/Table, RHF + Zod, Recharts, Zustand, shadcn/ui + Tailwind v3
- Backend: FastAPI, Pydantic v2, ReportLab (PDF), NIC API (e-invoice)
- Data/Auth/Storage: Supabase (Postgres + Auth + Storage)
- Modules: Quotations, Sales Orders, Invoices, Purchase Orders, Inventory, E-Invoice, Dashboard, Settings
- GST: CGST+SGST intra-state, IGST inter-state (by place_of_supply)

## Files created
```
agents/sdlc/        __init__.py  __main__.py  config.py  agent.py
                    tools.py  roles.py  orchestrator.py
                    requirements.txt  README.md  .env.example  .env (gitignored)
agents/.venv/       Python venv with anthropic installed (only for Option B)
.vscode/tasks.json  7 task launchers (only needed for Option B)
```

---

## NEXT STEP
Tell Claude: **"Act as the Product Manager and draft docs/sdlc/PRD.md."**
Review it → say "approved" → continue to BA → and so on.

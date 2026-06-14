# SDLC Agent Crew — foundry-erp

A small team of Claude-powered agents that mirror an Agile delivery pipeline.
Each agent's output is a **Markdown artifact** in `docs/sdlc/`, so you get a real
paper trail with traceability from product idea → shipped code.

## The team

| Agent | Produces | Model |
|---|---|---|
| Product Manager | `PRD.md` (market scan, MoSCoW + MVP feature priorities) | Opus 4.8 |
| Business Analyst | `CLARIFICATIONS.md`, `BRD.md` (scope, FR/NFR, use cases, traceability) | Opus 4.8 |
| Scrum Master | `BACKLOG.md` (epics, user stories, sprints, DoD) | Haiku 4.5 |
| Architect | `ARCHITECTURE.md` (design, data model, API contracts, ADRs) | Opus 4.8 |
| Developer | code on a feature branch + `DEV_*.md` | Opus 4.8 |
| QA Tester | `TEST_*.md`, `BUG_*` verdicts | Opus 4.8 |
| UAT (PM+BA) | `UAT.md` + your human sign-off | Opus 4.8 |

## Approval model (Hybrid + your gates)

- BA↔PM clarification runs **automatically**.
- **YOU approve the PRD**, then **YOU approve the BRD** — development cannot
  start until both are approved by you (terminal `y/N` gates in `run-all`).
- **UAT and final ship also pause for YOUR sign-off**.
- The Developer writes only to a **feature branch** (`feature/<story>`), never to `main`.

In `run-all` the pipeline stops at each gate. If you reject, edit the artifact
(or rerun that stage), then resume from the next stage command.

## Setup

```bash
cd agents
python -m venv .venv && .venv\Scripts\activate    # Windows
pip install -r sdlc/requirements.txt
set ANTHROPIC_API_KEY=sk-ant-...                  # or put it in sdlc/.env
```

`.env` format (gitignored):
```
ANTHROPIC_API_KEY=sk-ant-...
```

## Usage

```bash
# Full planning pipeline (PM -> BA -> Scrum -> Architect)
python -m sdlc run-all

# Or run a single stage
python -m sdlc pm
python -m sdlc ba
python -m sdlc scrum
python -m sdlc architect

# Develop one story (Developer <-> QA loop, writes to a feature branch)
python -m sdlc dev "US-001"

# User Acceptance Testing with your sign-off
python -m sdlc uat
```

Artifacts land in `../docs/sdlc/`. Review each gate's output before moving on.

## Cost notes

- Opus roles run only when you invoke them; Scrum Master uses cheap Haiku.
- The Developer↔QA loop caps at 3 iterations per story.
- All agents use adaptive thinking and streaming.

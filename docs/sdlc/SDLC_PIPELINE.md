# SDLC Pipeline — Foundry ERP
**Version:** 1.1
**Updated:** 2026-06-15
**Status:** Active — governs all sprints

---

## Development Lifecycle Stages

Each sprint must pass through all stages in order before code is merged to main and deployed.

```
1. PRD  →  2. BRD  →  3. ARCHITECTURE  →  4. DESIGN  →  5. BACKLOG
     →  6. DEVELOPMENT  →  7. BA UAT  →  8. PM CERTIFICATION  →  9. DEPLOY
```

---

## Stage Definitions

### 1. PRD — Product Requirements Document
- **Owner:** Product Manager
- **Output:** `docs/sdlc/PRD.md`
- **Gate:** PM approval + owner sign-off
- **When:** Before any sprint planning

### 2. BRD — Business Requirements Document
- **Owner:** Business Analyst
- **Output:** `docs/sdlc/BRD.md`
- **Gate:** BA approval, PRD cross-referenced
- **When:** After PRD approved

### 3. ARCHITECTURE
- **Owner:** Tech Lead / Claude Code
- **Output:** `docs/sdlc/ARCHITECTURE.md`
- **Gate:** DB schema reviewed, API map complete, ADRs documented
- **When:** After BRD approved, before sprint starts

### 4. DESIGN
- **Owner:** UX Agent / Claude Code
- **Output:** `docs/sdlc/DESIGN.md`
- **Gate:** Wireframes + component specs reviewed
- **When:** Parallel with Architecture

### 5. BACKLOG
- **Owner:** Scrum Master / BA
- **Output:** `docs/sdlc/BACKLOG.md`
- **Gate:** All stories have acceptance criteria, story points, dependencies
- **When:** After Architecture + Design approved

### 6. DEVELOPMENT
- **Owner:** Claude Code (developer)
- **Activities:**
  - DB migration files written and reviewed
  - Backend routers + services implemented
  - Frontend pages + API client implemented
  - Frontend build passes (`npm run build`)
  - Backend imports verified (`main.py`)
- **Gate:** Zero build errors; all sprint stories coded
- **No GitHub push until Stage 8 certified**

### 7. BA UAT — User Acceptance Testing  ← NEW
- **Owner:** BA Agent (Claude)
- **Trigger:** Developer reports all stories complete
- **Activities:**
  - BA agent reads BACKLOG.md acceptance criteria
  - BA agent inspects actual code (routers, pages, api.js, App.jsx, migrations)
  - For each story: PASS / PARTIAL / FAIL with evidence
  - Defect register produced with severity (Critical / Medium / Low)
- **Output:** `docs/sdlc/UAT_REPORT.md` (BA section)
- **Gate:** Zero Critical defects, or Critical defects acknowledged and scheduled
- **How to run:** Ask Claude to "spawn BA agent for UAT validation"

### 8. PM CERTIFICATION  ← NEW
- **Owner:** PM Agent (Claude)
- **Trigger:** BA UAT report complete
- **Activities:**
  - PM agent reads PRD.md + BRD.md
  - PM agent reads implementation (routers, pages)
  - PRD coverage matrix produced
  - BRD business process assessment
  - GST compliance assessment (for this domain)
  - Gaps and risks documented
  - Certification decision: ✅ CERTIFIED / ⚠️ CONDITIONAL / ❌ NOT CERTIFIED
- **Output:** `docs/sdlc/UAT_REPORT.md` (PM section)
- **Gate:** ✅ CERTIFIED or ⚠️ CONDITIONAL with conditions resolved
- **How to run:** Spawn PM agent after BA report is ready (can run in parallel with BA)

### 9. DEPLOY
- **Owner:** Developer / Claude Code
- **Activities:**
  - All Critical defects from UAT fixed and re-validated
  - `git commit` + `git push` to GitHub main
  - Vercel auto-deploys frontend
  - Railway auto-deploys backend
  - DB migrations applied to production Supabase
  - Smoke test on live URL
- **Gate:** PM certification is ✅ CERTIFIED (not conditional)
- **No push without PM sign-off**

---

## UAT History

| Date | Sprint(s) | BA Result | PM Decision | Critical Fixes Applied |
|------|-----------|-----------|-------------|----------------------|
| 2026-06-15 | 1–6 | 40/49 PASS, 9 PARTIAL | ⚠️ CONDITIONAL | GAP-01, GAP-02, GAP-03 pending |

---

## Defect Severity Definitions

| Severity | Definition | SLA |
|----------|------------|-----|
| Critical | Financial correctness error, compliance failure, runtime crash | Fix before deploy |
| Medium | Missing acceptance criterion, UX flow incomplete | Fix in next sprint |
| Low | Polish, minor spec deviation, nice-to-have | Backlog |

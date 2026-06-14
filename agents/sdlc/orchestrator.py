"""Pipeline orchestration with hybrid gates and the Developer<->QA loop.

Hybrid approval (per your choice):
  - Internal gates (BA<->PM clarification & BRD approval) run automatically.
  - UAT and final ship PAUSE for your sign-off in the terminal.
"""
from __future__ import annotations

from pathlib import Path

from . import roles
from .config import DOCS_DIR

MAX_DEV_QA_ITERS = 3


# --- Artifact helpers ----------------------------------------------------------
def _path(name: str) -> Path:
    return DOCS_DIR / name


def save(name: str, content: str) -> None:
    _path(name).write_text(content, encoding="utf-8")
    print(f"   -> wrote docs/sdlc/{name} ({len(content)} chars)")


def load(name: str) -> str:
    p = _path(name)
    if not p.exists():
        raise FileNotFoundError(
            f"Missing docs/sdlc/{name}. Run the earlier pipeline steps first.")
    return p.read_text(encoding="utf-8")


def _human_gate(question: str) -> bool:
    print("\n" + "=" * 70)
    ans = input(f"GATE: {question} [y/N] ").strip().lower()
    print("=" * 70 + "\n")
    return ans in {"y", "yes"}


def _review_gate(name: str, what: str) -> bool:
    """Pause for the human to open & approve an artifact before continuing."""
    print(f"\nPlease review: docs/sdlc/{name}")
    return _human_gate(f"Do YOU approve the {what}? Approving moves to the next stage.")


# --- Individual stages ---------------------------------------------------------
def stage_pm() -> None:
    print("\n[1/5] Product Manager: drafting PRD...")
    out = roles.product_manager().run(
        "Produce the PRD for foundry-erp. Inspect the codebase to ground your "
        "HAVE/PARTIAL/MISSING analysis in reality.")
    save(roles.PRD, out)


def stage_ba() -> None:
    prd = load(roles.PRD)

    print("\n[2/5] Business Analyst: raising clarifications...")
    clarifications = roles.business_analyst().run(
        "TASK: CLARIFY.\nHere is the PRD:\n\n" + prd)
    save(roles.CLARIFICATIONS + ".questions.md", clarifications)

    print("       Product Manager: answering clarifications... (auto gate)")
    answers = roles.product_manager().run(
        "Your BA asked these clarification questions about your PRD. Answer each "
        "precisely and decisively.\n\nPRD:\n" + prd +
        "\n\nQUESTIONS:\n" + clarifications)
    save(roles.CLARIFICATIONS, "## Questions\n\n" + clarifications +
         "\n\n## PM Answers\n\n" + answers)

    print("       Business Analyst: writing BRD...")
    brd = roles.business_analyst().run(
        "TASK: WRITE BRD.\n\nPRD:\n" + prd +
        "\n\nClarification answers from the PM:\n" + answers)
    save(roles.BRD, brd)

    print("       Product Manager: reviewing BRD against expectations... (auto gate)")
    review = roles.product_manager().run(
        "Review this BRD against your PRD. Reply with the first line 'APPROVED' "
        "or 'CHANGES NEEDED', then your notes.\n\nPRD:\n" + prd +
        "\n\nBRD:\n" + brd)
    save("BRD_REVIEW.md", review)
    verdict = review.splitlines()[0].upper() if review else ""
    print(f"       PM verdict: {verdict[:40]}")


def stage_scrum() -> None:
    print("\n[3/5] Scrum Master: building backlog & sprint plan...")
    out = roles.scrum_master().run(
        "Create the backlog and sprint plan from this approved BRD:\n\n"
        + load(roles.BRD))
    save(roles.BACKLOG, out)


def stage_architect() -> None:
    print("\n[4/5] Architect: writing technical design...")
    out = roles.architect().run(
        "Write the architecture/design. BRD:\n\n" + load(roles.BRD) +
        "\n\nBACKLOG:\n" + load(roles.BACKLOG))
    save(roles.ARCHITECTURE, out)


def stage_dev_qa(story: str) -> None:
    """Developer<->QA loop for a single story, writing to a feature branch."""
    arch = load(roles.ARCHITECTURE)
    backlog = load(roles.BACKLOG)
    branch = "feature/" + "".join(
        c if c.isalnum() else "-" for c in story.lower())[:40].strip("-")

    feedback = ""
    for i in range(1, MAX_DEV_QA_ITERS + 1):
        print(f"\n[dev] iteration {i}: Developer implementing '{story}'...")
        dev_report = roles.developer().run(
            f"Implement this story on branch '{branch}'.\n\nSTORY: {story}\n\n"
            f"Use the BACKLOG to find its acceptance criteria.\n\nBACKLOG:\n{backlog}"
            f"\n\nARCHITECTURE:\n{arch}" +
            (f"\n\nQA FEEDBACK from last round to fix:\n{feedback}" if feedback else ""))
        save(f"DEV_{branch.split('/')[-1]}.md", dev_report)

        print(f"[qa] iteration {i}: QA reviewing & testing...")
        qa_report = roles.qa_tester().run(
            f"Review and test the developer's work for this story.\n\nSTORY: {story}\n\n"
            f"BACKLOG:\n{backlog}\n\nDEV REPORT:\n{dev_report}")
        save(f"TEST_{branch.split('/')[-1]}.md", qa_report)

        verdict = qa_report.splitlines()[0].upper() if qa_report else ""
        if "PASS" in verdict:
            print(f"   QA PASSED on iteration {i}. Branch: {branch}")
            return
        print(f"   QA FAILED (iteration {i}); sending feedback to Developer.")
        feedback = qa_report

    print(f"   Reached max {MAX_DEV_QA_ITERS} iterations without PASS. "
          f"Review docs/sdlc/TEST_{branch.split('/')[-1]}.md manually.")


def stage_uat() -> None:
    """Hybrid: agents assess, but YOU give the final sign-off."""
    print("\n[5/5] UAT (PM+BA): assessing the increment...")
    report = roles.uat_reviewer().run(
        "Perform UAT.\n\nBRD:\n" + load(roles.BRD) +
        "\n\nBACKLOG:\n" + load(roles.BACKLOG))
    save(roles.UAT, report)
    verdict = report.splitlines()[0].upper() if report else ""
    print(f"   Agent UAT verdict: {verdict[:40]}")

    if not _human_gate("Do YOU accept this increment for shipping?"):
        print("Rejected by human reviewer. Feed UAT.md back to the Developer and rerun.")
        return
    if not _human_gate("Confirm FINAL SHIP?"):
        print("Ship cancelled.")
        return
    print("✅ Increment accepted and approved to ship.")


def run_all() -> None:
    """Full pipeline up to (but not including) per-story development.

    YOU approve the PRD and the BRD before development can proceed.
    """
    stage_pm()
    if not _review_gate(roles.PRD, "PRD"):
        print("PRD not approved. Edit it or rerun `python -m sdlc pm`, "
              "then resume with `python -m sdlc ba`.")
        return

    stage_ba()  # BA<->PM clarification runs automatically; output is the BRD
    if not _review_gate(roles.BRD, "BRD"):
        print("BRD not approved. Edit it or rerun `python -m sdlc ba`, "
              "then resume with `python -m sdlc scrum`.")
        return

    print("\n✅ PRD and BRD approved by you — proceeding to planning.")
    stage_scrum()
    stage_architect()
    print("\nPlanning artifacts ready in docs/sdlc/.")
    print("Next: run development per story, e.g.:")
    print('   python -m sdlc dev "US-001"')
    print("Then run UAT:  python -m sdlc uat")

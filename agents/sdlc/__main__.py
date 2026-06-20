"""CLI entry point.  Run from the agents/ directory:

    python -m sdlc run-all          # PM -> BA -> Scrum -> Architect
    python -m sdlc pm               # just the Product Manager (PRD)
    python -m sdlc ba               # BA clarify+BRD (+ PM auto gates)
    python -m sdlc scrum            # backlog & sprint plan
    python -m sdlc architect        # technical design
    python -m sdlc dev "US-001"     # Developer<->QA loop for one story
    python -m sdlc uat              # UAT with human sign-off
    python -m sdlc ba-test          # BA flow tester — live HTTP tests against deployed API
    python -m sdlc ba-test <url>    # override API base URL for this run
"""
from __future__ import annotations

import sys

from . import orchestrator as orch


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 1

    cmd, rest = argv[0], argv[1:]
    try:
        if cmd == "run-all":
            orch.run_all()
        elif cmd == "pm":
            orch.stage_pm()
        elif cmd == "ba":
            orch.stage_ba()
        elif cmd == "scrum":
            orch.stage_scrum()
        elif cmd == "architect":
            orch.stage_architect()
        elif cmd == "dev":
            if not rest:
                print('Usage: python -m sdlc dev "US-001"  (or a story description)')
                return 1
            orch.stage_dev_qa(" ".join(rest))
        elif cmd == "uat":
            orch.stage_uat()
        elif cmd == "ba-test":
            from .ba_flow_tester import main as ba_main
            return ba_main(rest)
        else:
            print(f"Unknown command: {cmd}\n")
            print(__doc__)
            return 1
    except FileNotFoundError as e:
        print(f"ERROR: {e}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

---
description: Run the feature QA workflow (requirement review → test plan → Qase cases → manual run → Jira bugs → Playwright automation → 10x CI flake check → PR) with human gates and a final verdict, or continue a stopped run
argument-hint: "<SCRUM-12 | jira/confluence URL | file path | \"requirement text\"> | continue [qa-runs/<folder>]"
---

# /feature-qa

Arguments: `$ARGUMENTS`

Load the `feature-qa` skill with the Skill tool and follow it exactly.

- When the first argument is `continue`, do the skill's **Resume** with the folder given, or the newest folder under `qa-runs/`.
- Otherwise, treat the whole argument as the requirement source and start a **New run**.
- With no argument, ask for the source (a Jira key, a URL, a file or text), or offer to continue the newest run in `qa-runs/` if one isn't `done`.

The workflow stops at every human gate (requirement answers and approval, test plan approval, the bug-filing batch, the push to GitHub). Answer in the chat, then run `/feature-qa continue`. The progress lives in `qa-runs/<folder>/00-progress.yaml`, and the report is in `qa-runs/<folder>/index.html`.

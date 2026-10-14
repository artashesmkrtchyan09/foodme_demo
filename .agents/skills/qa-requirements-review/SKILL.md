---
name: qa-requirements-review
description: Step 1 of the feature-qa workflow. Statically reviews a feature requirement (Jira, Confluence, PRD, text) against an ISTQB checklist and the current FoodMe code, and writes 01-requirements-review.md with numbered questions about missing, ambiguous or untestable requirements. Use only when the feature-qa skill runs step 1 for a qa-runs/<folder>.
---

# Requirement review (step 1)

Input: the run folder. Read these files from it:
- `00-source.md`
- `01-requirements-review.md` and `02-requirements-approval.md`, if they exist (earlier cycles and the human's answers)
- `.agents/skills/feature-qa/references/istqb.md` §1 and `references/artifacts.md` (step 1 and the gate format)

Don't ask the user anything. Write questions into the artifact, and the orchestrator presents them.

1. **Split the source into atomic statements:** the description, each acceptance criterion, and the rules found in comments. Number them in your working notes (S-1…).
2. **Check every statement** against the checklist in istqb.md §1. Also check what's missing as a whole: error and empty states, unauthenticated users, limits, the status flow, which app (web, admin or backend) is affected, and non-functional needs.
3. **Check for drift with the code.** Find the area in the code: `rg` the route, endpoint, component or visible text in `apps/`, and grep `FM-BUG-|FM-FLAKE-` in that area. If the requirement contradicts what the code does today, or the feature already exists in part, raise it as a question with `path:line @ <short sha>`. A seeded bug in the area is a test hint, not a question.
4. **Fold in the answers.** For each earlier question with an answer, mark it `answered`, or `out-of-scope` or `skipped` if the human said so. Check whether the answer raises new questions, for example a new limit that needs its boundary behaviour defined. Never re-ask an answered question. Ask a follow-up with a new ID instead.
5. **Write the questions** in the format artifacts.md gives for step 1: a new ID that continues from the earlier cycles, the severity (blocker, major or minor), the quoted text, one question, and a **proposed default**.
   - Keep one question per issue.
   - Merge near-duplicates.
   - Don't ask what the code or the existing app already answers unambiguously. State it as an assumption under *Drift with current code* instead.
6. **Write the artifact.** Add `## Cycle N` to `01-requirements-review.md` and update its front matter (`cycle`, `open_questions`, `blockers_open`).
7. **Draft the baseline.** When `open_questions: 0`, draft the *Approved baseline* table (REQ-1…, the acceptance criteria, the source of each, out of scope) into `02-requirements-approval.md` for the orchestrator to present for final approval. Leave `status: pending`.

Return one line: `cycle N: <n> open questions (<n> blocker), baseline drafted: yes/no`.

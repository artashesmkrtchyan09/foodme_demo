---
name: qa-test-plan
description: Step 3 of the feature-qa workflow. Writes or updates an ISTQB / ISO 29119-3 test plan (scope, risk analysis, approach, techniques, environment, entry/exit criteria) for a feature from its approved requirement baseline, into 03-test-plan.md. Use only when the feature-qa skill runs step 3 for a qa-runs/<folder>.
---

# Test plan (step 3)

Input: the run folder. Read these files from it:
- `02-requirements-approval.md` (the *Approved baseline* is the test basis)
- `01-requirements-review.md` (the assumptions and drift notes)
- `03-test-plan.md` and `04-test-plan-approval.md`, if they exist (earlier cycles and the requested changes)
- `.agents/skills/feature-qa/references/istqb.md` §2–3 and §7–8, and `references/artifacts.md` (step 3)

Don't ask the user anything.

1. **Find the test items in the code.** List the pages, components, endpoints and specs the feature touches (`rg` in `apps/`), and the existing tests that already cover parts of it (`apps/*/e2e`, `apps/backend/src/test`). Existing Qase cases in the area: run `qql_search` with `entity = "case" and project = "FOODME"` plus a title or tag filter on the feature words. Load the schemas with ToolSearch first, and use the AgentSecrets fallback from `web-regression` preflight 1 on a 401.
2. **Assess the product risks** per REQ: likelihood × impact (1–3 each). Raise the likelihood for areas with FM-BUG history or many code paths, and the impact for money, orders and auth.
3. **Choose the techniques** per REQ from istqb.md §3, and estimate the number of cases. High-risk REQs get boundary, negative and state cases.
4. **Plan the environment and data:**
   - Manual execution runs on prod (`web-regression` prod-safety rules), so mark the admin and fault-injection cases as "not executable on prod, automation only".
   - Automation runs on the CI backend (`e2e-flake-check.yml`).
   - The data rules come from the e2e rules (fresh accounts, data found through the API).
5. **Write the plan** with every section from istqb.md §2, in that order, with concrete entry, exit and suspension criteria. The exit criteria must include 100% REQ coverage and 10/10 CI runs for the new specs.
6. **Address every requested change.** On a re-run after the gate asked for changes, add `## Changes in cycle N` at the top, mapping each request to what changed. Bump `cycle` in the front matter.

Return one line: `cycle N: <n> REQs, <n> high risks, ~<n> cases planned`.

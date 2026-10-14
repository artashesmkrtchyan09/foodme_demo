---
name: qa-manual-execution
description: Step 7 of the feature-qa workflow. Manually executes the feature's Qase test cases in Chrome on the prod storefront through the Playwright MCP server, using the web-regression skill's preflight, execution and prod-safety rules, records a Qase run and writes 07-test-execution.json/.md with evidence. Use only when the feature-qa skill runs step 7 for a qa-runs/<folder>.
---

# Manual execution (step 7)

Input: the run folder. Read these:
- `05-test-cases.yaml` (the case IDs to run)
- `apps/web/.agents/skills/web-regression/SKILL.md` and its `case-notes.md`
- `.agents/skills/feature-qa/references/istqb.md` §5 and `references/artifacts.md` (step 7)

**The `web-regression` skill is the procedure.** Follow its sections exactly, with only these differences:

| web-regression | Here |
|---|---|
| §0 base URL | always prod `https://foodme-artashesmkrtchyan.onrender.com`; all its prod-safety rules apply |
| §0 output folder | `qa-runs/<folder>/07-evidence/` for screenshots (move them out of `.playwright-mcp/` at once) |
| §1 preflight | the same 4 checks; a failure → return `BLOCKED: …` to the orchestrator |
| §2 case selection | only the IDs in `05-test-cases.yaml` whose `action` is not `deprecated`, sorted by ID; the Web-tree check does not apply |
| run label | `fqa-<folder name>`; customer emails follow §3: `regr-fqa-<folder>-c<id>-a<n>@example.test` |
| §3 execution | unchanged: fresh state, data, waits, oracle, retry once, known seeded issues |
| admin cases (`app: admin`) and cases that need fault injection | `blocked`, reason `precondition: admin / fault injection not allowed on prod` (covered by automation in CI instead) |
| backend cases (`app: backend`) | execute with `curl` against the prod API when they need no admin token; otherwise `blocked` the same way |
| §4 record to Qase | **always** record: `qase_regression_run` title `Feature QA <folder> @ <git sha>`, then one `qase_result_record`, then `qase_run_complete` |
| §5 output | `07-test-execution.json` (the schema in artifacts.md: web-regression's result plus `reqs`, `evidence` and `qaseRun`) and `07-test-execution.md` |

Map each failure to its REQ (from `05-test-cases.yaml`), and quote the page text exactly in `reason`. Never change product code, tests or Qase cases here. A case whose steps can't be followed as written is `blocked` with the reason `case defect: <what>`, and it goes back to the orchestrator as a note for step 5.

Return one line: `<n> passed, <n> failed, <n> flaky, <n> blocked, <n> skipped; Qase run <url>`.

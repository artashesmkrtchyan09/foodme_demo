# Artifact formats

Every artifact lives in `qa-runs/<folder>/`. All of them must be readable by a person and parsable by an agent:
- Markdown starts with YAML front matter that holds the machine fields.
- Data files are YAML or JSON with a fixed schema.

Times are ISO 8601 with offset (`2026-10-14T15:20:00+04:00`). External references are always full URLs:
- Jira: `https://artashesmkrtchyan09.atlassian.net/browse/<KEY>`
- Qase case: `https://app.qase.io/case/FOODME-<id>`
- Qase run: the URL the Qase tool returns
- GitHub: `https://github.com/artashesmkrtchyan09/foodme_demo/...`

Update an artifact in place across cycles. Add a new `## Cycle N` section and never delete an earlier one; history is part of the evidence.

## progress — `00-progress.yaml`

```yaml
workflow: feature-qa
folder: qa-runs/SCRUM-12-2026-10-14
source: { type: jira, ref: SCRUM-12, url: https://artashesmkrtchyan09.atlassian.net/browse/SCRUM-12, title: "…" }
started: 2026-10-14T10:00:00+04:00
env: { base_url: https://foodme-artashesmkrtchyan.onrender.com, git_sha: 1ce9870, deployed_version: assets/index-XXXX.js }
current_step: 2
status: waiting_for_human        # running | waiting_for_human | blocked | done
waiting_for: { step: 2, artifact: 02-requirements-approval.md, what: "answers to Q-1..Q-4" }   # null when not waiting
blocked_reason: null
cycles: { requirements: 1, test_plan: 0, test_cases: 0, automation: 0 }
branch: null                     # set at step 9
history:                         # append only
  - { step: 1, cycle: 1, started: …, finished: …, outcome: "4 questions (1 blocker)", artifact: 01-requirements-review.md }
  - { step: 2, cycle: 1, started: …, finished: null, outcome: pending, artifact: 02-requirements-approval.md }
links: { jira_task: null, qase_suite: null, qase_run: null, ci_runs: [], pr: null }
```

## §0 — `00-source.md`

Front matter: `source_type`, `ref`, `url`, `retrieved`. The body is the requirement as fetched: the description, the acceptance criteria, and the comments (author and date). Don't edit it. It is the test basis as received.

## step 1 — `01-requirements-review.md`

```markdown
---
step: 1
cycle: 2
open_questions: 1
blockers_open: 0
---
# Requirement review — <feature>

## Cycle 2 — <time>
Input: answers from cycle 1 (see 02-requirements-approval.md)

### Checklist
| Attribute | Result | Notes |
|---|---|---|
| Complete | ⚠ | refund flow missing |
| Unambiguous | ✔ | |
…

### Questions
#### Q-5 (major) — Ambiguous
> "the user can change the quantity quickly"
Question: Is there a maximum quantity per dish?
Proposed default: 99, same as backend validation.
answer:
status: open            # open | answered | out-of-scope | skipped

### Drift with current code
- <requirement> vs `path:line @ sha`: <difference>

## Cycle 1 — <time>
…
```

## gates — `02-requirements-approval.md` and `04-test-plan-approval.md`

The **approval log** block is the same in both:

```markdown
---
step: 2
status: approved            # pending | approved | rejected
approved_by: Artashes Mkrtchyan
approved_cycle: 3
---
# Requirement approval — <feature>

## Approval log
| Cycle | Time | Presented | Approver | Decision | Answers / requested changes | Comment (e.g. confirmed with PM) |
|---|---|---|---|---|---|---|
| 1 | … | Q-1..Q-4 | Artashes Mkrtchyan | answered | Q-1: 99 max; Q-2: out of scope … | Q-1 confirmed with PM (Anna) |
| 2 | … | Q-5 | Artashes Mkrtchyan | answered | Q-5: proposed default ok | — |
| 3 | … | final approval | Artashes Mkrtchyan | approved | — | — |

## Approved baseline           <!-- step 2 only; the judge reads this section -->
| REQ | Requirement (atomic) | Acceptance criteria | Source |
|---|---|---|---|
| REQ-1 | … | … | SCRUM-12 AC-1, Q-1 |
Out of scope: …
```

In `04-test-plan-approval.md`, the *Presented* column names the plan cycle, and there is no baseline section.

## step 3 — `03-test-plan.md`

Front matter: `step: 3`, `cycle`, `reqs`, `risks_high`, `planned_cases_estimate`. The body has the sections from istqb.md §2, in that order. The risk table columns are `Risk | REQ | Likelihood | Impact | Score | Mitigation (techniques / priority)`. Then the technique matrix `REQ | Techniques | Planned case count`. Add `## Changes in cycle N` at the top whenever a gate requested changes, mapping each request to what changed.

## step 5 — `05-test-cases.yaml` (data) and `05-test-cases.md` (view)

```yaml
cycle: 2
project: FOODME
suite: { id: 41, path: "Web › SCRUM-12 Cart quantity limits", url: … }
cases:
  - id: 210
    url: https://app.qase.io/case/FOODME-210
    title: "Quantity cannot go above 99"
    reqs: [REQ-2]
    technique: BVA
    priority: high
    severity: major
    app: web               # web | admin | backend
    action: created        # created | updated | unchanged | deprecated
traceability:              # every REQ, even when uncovered
  REQ-1: [210, 211]
  REQ-2: [212]
changes:                   # per cycle: what changed and which judge finding it answers
  - { cycle: 2, finding: F-3, case: 212, change: "split into 212/213" }
```

The `.md` file is the same data for people: the suite link, a case table (`ID | Title | REQ | Technique | Priority`), the traceability matrix (`REQ | Cases | Covered?`), and the change log.

## judge reviews — `06-test-case-review.md` and `10-automation-review.md`

Front matter: `step`, `cycles`, `final_verdict`. Each cycle gets `## Cycle N — <time> — VERDICT` with the judge's final message copied verbatim. Then `### Response`: a table `Finding | Action (fixed / rejected) | Detail`, filled in by the AI step that addressed the findings.

## step 7 — `07-test-execution.json` and `07-test-execution.md`

```json
{
  "runLabel": "fqa-SCRUM-12-2026-10-14",
  "baseUrl": "https://foodme-artashesmkrtchyan.onrender.com",
  "deployedVersion": "assets/index-XXXX.js",
  "gitSha": "1ce9870",
  "qaseRun": { "id": 77, "url": "…" },
  "cases": [
    { "id": 210, "title": "…", "reqs": ["REQ-2"], "status": "failed", "failedStep": 3,
      "reason": "3: expected quantity 99, got 100", "knownIssue": null, "unstable": false,
      "evidence": ["07-evidence/c210-s3-a1.png"] }
  ],
  "summary": { "passed": 5, "failed": 1, "flaky": 0, "blocked": 1, "skipped": 0 }
}
```

The `.md` file holds a summary table, the failures (`Case | REQ | Step | Expected | Actual | Known issue | Evidence`), the blocked and skipped cases with their reasons, and the environment line.

## step 8 — `08-defects.md`

Front matter: `jira_task` (key and URL), `task_created` (bool), `bugs` (a list of `{key, url, case, severity, priority, duplicate_of}`). The body has the Task line (found / created, and why) and a table `Bug | Summary | Severity | Priority | Qase case | REQ | Known issue | Status`. Then the duplicate-check verdicts with the queries that were tried, and the approval line for the filing batch (who, when, comment).

## step 9 — `09-automation.md`

Front matter: `cycle`, `branch`, `specs` (paths), `automated_cases` (IDs), `manual_cases` (IDs). The body has:
- the selection table `Case | Decision (automate / manual) | Reason (istqb.md §7) | Spec › test title`
- the local run result (command, pass/fail, or "not run: backend not available")
- `## Changes in cycle N`, answering judge or CI findings

## step 11 — `11-flake-check.md`

Front matter: `runs` (a list of `{run_id, url, sha, repeat, conclusion}`) and `verdict` (`stable` / `flaky`). The body has a table `Spec › test | Passed/Total | Failure messages (unique)` and the decision (→ step 9 or → step 12).

## step 12 — `12-pull-request.md`

Front matter: `branch`, `commits` (sha and subject), `pr` (number and URL), `ci` (a check-to-status map). The body has the PR description as sent, the CI summary, and the merge command for the user.

## verdict — `99-verdict.md`

```markdown
---
feature: <title>
source: <url>
recommendation: Ready | Ready with risks | Not ready
req_coverage: 100%
cases: { planned: 12, executed: 11, passed: 9, failed: 1, flaky: 0, blocked: 1, automated: 8 }
defects: { total: 2, open: 2, by_severity: { critical: 0, major: 1, minor: 1 } }
---
# Verdict — <feature> — <date>
**Recommendation: <…>** — one-paragraph rationale.

## Implementation quality
## Coverage (REQ coverage, case results, automation %, CI stability)
## Defects (table with Jira links)
## Exit criteria (criterion | met? | evidence)
## Residual risks
## Human decisions (every gate: cycle, approver, decision, comment)
## Links (Jira task + bugs, Qase suite/cases/run, CI runs, PR)
## Lessons learned
```

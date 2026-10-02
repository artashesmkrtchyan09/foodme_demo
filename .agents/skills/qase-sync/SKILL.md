---
name: qase-sync
description: Compare and sync test cases between the Qase test management tool and the FoodMe codebase (backend JUnit tests, web and admin Playwright specs), then produce a detailed inconsistency report. Use when asked to sync, reconcile, audit or compare Qase test cases with the repo's automated tests, link tests to Qase IDs, find tests missing from Qase (or Qase cases missing from code), or check automation/flaky status drift.
---

# Qase ↔ FoodMe test case sync

Compares every automated test in the repo with the test cases in a Qase project, lists every inconsistency, and — only after the user approves — fixes them on either side. The final output is always a detailed report.

Scripts live in `.agents/skills/qase-sync/scripts/` (Node 18+, no dependencies). Run them from the repo root.

## 0. Prerequisites

- `QASE_API_TOKEN` — a Qase API token (Qase → user settings → API tokens). `QASE_PROJECT` — the project code (e.g. `FOODME`). Optional `QASE_API_URL` for self-hosted/enterprise (default `https://api.qase.io/v1`).
- If either is missing, stop and ask the user to set them in their shell (e.g. `! $env:QASE_API_TOKEN="..."` in PowerShell or `! export QASE_API_TOKEN=...`). Never ask them to paste the token into chat, never print it, and never write it to a tracked file.
- If a Qase MCP server is connected, you may use it to read cases instead of `qase.mjs`, but produce the same `qase.json` shape so `compare.mjs` still works.

Write intermediate files to a scratch directory, not the repo: `$CLAUDE_JOB_DIR/tmp` if set, otherwise the system temp dir. Below, `$OUT` means that directory.

## 1. How tests are linked to Qase

A test is linked to a Qase case by its numeric case ID. The inventory recognises any of these:

| Where | Preferred (no dependency) | Also recognised (Qase reporters) |
|---|---|---|
| Backend JUnit (`apps/backend/src/test/java`) | `// qase: 12` on the line(s) above `@Test` | `@QaseId(12)` |
| Web / admin Playwright (`apps/{web,admin}/e2e/*.spec.ts`) | `// qase: 12` on the line above `test(...)` | `test(qase(12, "title"), …)`, `qase.id(12)` in the body, `(Qase ID: 12)` in the title |

`// qase: 12, 15` links several cases; a project prefix (`// qase: FOODME-12`) is allowed. When adding links, use the `// qase:` comment form unless the app already uses a Qase reporter.

## 2. Collect both sides

```
node .agents/skills/qase-sync/scripts/inventory.mjs > "$OUT/inventory.json"
node .agents/skills/qase-sync/scripts/qase.mjs export > "$OUT/qase.json"
node .agents/skills/qase-sync/scripts/compare.mjs "$OUT/inventory.json" "$OUT/qase.json" > "$OUT/findings.json"
```

- `inventory.json` — one entry per test: app, file, line, suite path (Java class, or spec file + `describe` titles), title (method name / `@DisplayName` / Playwright title), linked Qase IDs, `skipped`, and any `FM-FLAKE-NN` / `FM-BUG-NN` markers in or right above the test.
- `qase.json` — project, suites (with full paths) and all cases with `automation` (0 not automated, 1 to be automated, 2 automated), `status` (0 actual, 1 draft, 2 deprecated) and `isFlaky`. If the numbers look wrong for this workspace, check them with `node qase.mjs GET /system_field`.
- Sanity-check the inventory count against a quick grep (`@Test` methods, `test(` calls) before trusting it; if the parser missed tests, read those files and add them by hand.

## 3. Interpret the findings

`compare.mjs` emits a `summary` and a list of `findings`. Review each one — it is a heuristic, not a verdict.

| Type | Meaning | Usual fix |
|---|---|---|
| `UNLINKED_TEST` | Test has no Qase ID. `candidates` are Qase cases with similar titles. | Link to the right candidate, or create a new Qase case. |
| `AUTOMATED_CASE_WITHOUT_TEST` | Qase says *automated*, but no test links to it. `candidates` are unlinked tests with similar titles. | Link the matching test, or set the case to *to be automated* / *not automated*. |
| `LINK_TO_MISSING_CASE` | Code references a Qase ID that doesn't exist (deleted, wrong project, typo). | Fix or remove the marker. |
| `DUPLICATE_LINK` | Several tests link to the same case. | Fine if intentional (e.g. API + E2E cover one case); otherwise split the case. |
| `AUTOMATION_STATUS_MISMATCH` | Linked test exists but the case isn't marked *automated*. | Set `automation: 2` in Qase. |
| `FLAKY_MISMATCH` | `FM-FLAKE` marker in code vs `is_flaky` in Qase disagree. | Usually update Qase `is_flaky`. |
| `SKIPPED_IN_CODE` | Linked test is `skip`/`fixme`/`@Disabled`. | Report; Qase may need a note or status change. |
| `LINKED_CASE_DEPRECATED` / `LINKED_CASE_DRAFT` | Code still runs a test for a deprecated/draft case. | Re-activate the case or drop the link/test. |
| `TITLE_MISMATCH` | Linked titles differ after normalisation (camelCase/underscores are ignored). | Usually cosmetic; align only if meaning differs. |
| `SUITE_MISMATCH` | Case isn't under a suite named like its app (Backend/API, Web/Storefront, Admin/Back office). | Move case or confirm the structure. |
| `TO_BE_AUTOMATED` | Qase backlog with no test yet. | Informational. |

Use judgement on top of the script:
- Pair `UNLINKED_TEST` and `AUTOMATED_CASE_WITHOUT_TEST` findings that point at each other — they are one inconsistency (a missing link), not two.
- For likely matches, open the test and the Qase case (`node qase.mjs GET /case/$QASE_PROJECT/<id>`) and compare steps/expected results with what the test actually asserts. Note real behavioural drift (the test checks something the case doesn't describe, or vice versa).
- **Seeded issues are intentional.** `FM-FLAKE-NN` tests are flaky on purpose and `FM-BUG-NN` code is a deliberate bug (see the root `AGENTS.md`). Never "fix" the code to make it match Qase; a Qase case may legitimately describe the correct behaviour that an `FM-BUG` breaks — report it as "expected failure due to FM-BUG-NN", not as drift. An `FM-FLAKE` marker whose comment says `FIX` should still be reported, with that note.

## 4. Sync (only with approval)

Present the report (section 5) first and propose concrete actions grouped by side. Ask the user which to apply — Qase writes are visible to their whole team. Then:

**In code** — add/fix `// qase: <id>` markers directly above the test (keep existing comments and `FM-*` markers intact; don't touch test logic).

**In Qase** — write a JSON body to `$OUT` and send it:
```
node .agents/skills/qase-sync/scripts/qase.mjs PATCH /case/$QASE_PROJECT/<id> "$OUT/body.json"   # e.g. {"automation": 2, "is_flaky": 1}
node .agents/skills/qase-sync/scripts/qase.mjs POST  /case/$QASE_PROJECT "$OUT/body.json"         # new case
node .agents/skills/qase-sync/scripts/qase.mjs POST  /suite/$QASE_PROJECT "$OUT/body.json"        # {"title": "Web", "parent_id": null}
```
For a new case, derive `title` from the test (human-readable, not camelCase), set `suite_id` to the app's suite (create `Backend` / `Web` / `Admin` suites, and a sub-suite per test class or spec file, if missing), `automation: 2`, `is_flaky: 1` when the test has an `FM-FLAKE` marker, `tags: ["<app>", "automated"]`, and `steps` (`[{ "action": "...", "expected_result": "..." }]`) summarising what the test does. Then add the returned `id` as a `// qase:` marker on the test.

Never delete Qase cases or suites (the client doesn't support DELETE on purpose) and never delete tests; suggest deprecation instead. After applying, re-run section 2 and confirm the fixed findings are gone.

## 5. Report

Always finish with this report (in the chat; if the user wants to share it, offer to publish it as a page). Be specific: every row names the file:line and/or Qase ID.

```
# Qase sync report — <project code> — <date>

## Summary
- Code: <n> tests (backend <n>, web <n>, admin <n>); <n> linked, <n> unlinked; <n> with FM-FLAKE markers; <n> skipped
- Qase: <n> cases (<n> automated, <n> to be automated, <n> manual, <n> deprecated, <n> flaky)
- Inconsistencies: <total> — <n> high, <n> medium, <n> low
- Sync coverage: <linked tests>/<total tests> tests linked; <automated cases with a test>/<automated cases> automated cases backed by code

## High
### Tests missing from Qase (<n>)
| App | Test (file:line) | Best Qase candidate (score) | Proposed action |
### Qase "automated" cases with no test (<n>)
| Case | Suite | Likely test | Proposed action |
### Broken links (<n>)
| Test (file:line) | Missing ID | Proposed action |

## Medium
### Automation status drift / Flaky status drift / Skipped tests / Duplicate links / Deprecated or draft cases
(one table each, only the non-empty ones)

## Low
### Title differences / Suite placement

## Behavioural drift
Cases whose steps or expected results don't match what the linked test asserts (from manual review).

## Expected differences (not action items)
FM-BUG / FM-FLAKE related items and why they're intentional.

## Proposed sync plan
Numbered list: code changes, Qase changes (PATCH/POST), and open questions for the user.
If changes were applied: what was changed, and the before/after finding counts.
```

Omit empty sections, but state "none" in the summary for categories that were checked and clean.

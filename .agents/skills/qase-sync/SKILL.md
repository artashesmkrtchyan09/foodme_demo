---
name: qase-sync
description: Compare and sync test cases between the Qase test management tool and the FoodMe codebase (backend JUnit tests, web and admin Playwright specs), then produce a detailed inconsistency report. Use when asked to sync, reconcile, audit or compare Qase test cases with the repo's automated tests, link tests to Qase IDs, find tests missing from Qase (or Qase cases missing from code), or check automation/flaky status drift.
---

# Qase ↔ FoodMe test case sync

Compares every automated test in the repo with the test cases in a Qase project, lists every inconsistency, and — only after the user approves — fixes them on either side. The final output is always a detailed report.

Qase is read and written through the **Qase MCP server** (`mcp__qase__*` tools). The code side is collected by `scripts/inventory.mjs` (Node 18+, no dependencies, run from the repo root).

## 0. Prerequisites

- The project code is `FOODME` unless the user names another one.
- The `qase` MCP server is configured in `.mcp.json` (`npx @qase/mcp-server`). It reads `QASE_API_TOKEN` from the environment of the shell that started Claude Code (`${QASE_API_TOKEN}`); Claude Code does not load `.env` files. The token itself is kept in AgentSecrets (OS keychain).
- If the `mcp__qase__*` tools are missing, the server isn't enabled: ask the user to enable it (`/mcp`) and restart the session.
- If a Qase tool fails with **401**, the token isn't reaching the server: `QASE_API_TOKEN` is unset or stale in the shell that started Claude Code. Ask the user to set it in that shell and restart the session (or reconnect with `/mcp`). If AgentSecrets reports "keychain-auth daemon is not running", ask the user to run `! agentsecrets doctor` first. Never ask for the token, never print it, never write it to a file.
- Load tool schemas before first use. The core tools are `qase_project_context`, `qql_help`, `qql_search`, `qase_get`, `qase_case_upsert`, `qase_case_bulk_create`, `qase_suite_upsert`. Anything else (plans, milestones, shared steps…) is activated with `qase_discover_tools`.

Write intermediate files to a scratch directory, not the repo: `$CLAUDE_JOB_DIR/tmp` if set, otherwise the system temp dir. Below, `$OUT` means that directory.

## 1. How tests are linked to Qase

A test is linked to a Qase case by its numeric case ID. The inventory recognises any of these:

| Where | Preferred (no dependency) | Also recognised (Qase reporters) |
|---|---|---|
| Backend JUnit (`apps/backend/src/test/java`) | `// qase: 12` on the line(s) above `@Test` | `@QaseId(12)` |
| Web / admin Playwright (`apps/{web,admin}/e2e/*.spec.ts`) | `// qase: 12` on the line above `test(...)` | `test(qase(12, "title"), …)`, `qase.id(12)` in the body, `(Qase ID: 12)` in the title |

`// qase: 12, 15` links several cases; a project prefix (`// qase: FOODME-12`) is allowed. When adding links, use the `// qase:` comment form unless the app already uses a Qase reporter.

## 2. Collect both sides

**Code:**
```
node .agents/skills/qase-sync/scripts/inventory.mjs > "$OUT/inventory.json"
```
One entry per test: app, file, line, suite path (Java class, or spec file + `describe` titles), title (method name / `@DisplayName` / Playwright title), linked `qaseIds`, `skipped`, and any `FM-FLAKE-NN` / `FM-BUG-NN` markers in or right above the test. Sanity-check the count against a quick grep (`@Test` methods, `test(` calls); if the parser missed tests, read those files and add them by hand.

**Qase:**
1. `qase_project_context` with `code: "FOODME"` — the suite tree. Check `coverage`; pass `full: true` if suites are truncated. Suite **descriptions** matter: the AC sub-suites (e.g. `Web › AC-WEB-05 …`) list the repo's **existing automated tests** that cover that AC — the best hint for which test belongs to which case.
2. Read `qql_help` (`entities`, `enumValues`) once, then page through every case with `qql_search`, 100 per page (`offset` 0, 100, …) until a page returns fewer than 100:
   ```
   entity = "case" and project = "FOODME"
   ```
   Keep per case: id, title, suite, automation, status, isFlaky, tags.
3. Use QQL for counts instead of paging when you only need numbers, e.g. `entity = "case" and project = "FOODME" and automation = "Automated"`, or the aggregation syntax (`qql_help` → `aggregation`).
4. `qase_get` (`entity: "case"`) only for the few cases you review in detail (steps, expected results).

Enum values in QQL: automation `Manual` / `To be automated` / `Automated`; status `Actual` / `Draft` / `Deprecated`; priority has no `Critical` (that is a severity).

## 3. Find the inconsistencies

Compare the inventory with the Qase cases and classify every difference:

| Type | Severity | Meaning | Usual fix |
|---|---|---|---|
| `UNLINKED_TEST` | high | Test has no Qase ID. Name up to 3 candidate cases (similar title, or listed in the AC sub-suite's "Existing automated tests"). | Link to the right candidate, or create a new Qase case. |
| `AUTOMATED_CASE_WITHOUT_TEST` | high | Qase says *Automated*, but no test links to it. | Link the matching test, or set the case to *To be automated* / *Manual*. |
| `LINK_TO_MISSING_CASE` | high | Code references a Qase ID that doesn't exist (deleted, wrong project, typo). | Fix or remove the marker. |
| `DUPLICATE_LINK` | medium | Several tests link to the same case. | Fine if intentional (e.g. API + E2E cover one case); otherwise split the case. |
| `AUTOMATION_STATUS_MISMATCH` | medium | Linked test exists but the case isn't *Automated*. | Set `automation: "2"` in Qase. |
| `FLAKY_MISMATCH` | medium | `FM-FLAKE` marker in code vs `isFlaky` in Qase disagree. | Usually update Qase `is_flaky`. |
| `SKIPPED_IN_CODE` | medium | Linked test is `skip`/`fixme`/`@Disabled`. | Report; Qase may need a note or status change. |
| `LINKED_CASE_DEPRECATED` / `LINKED_CASE_DRAFT` | medium / low | Code still runs a test for a deprecated/draft case. | Re-activate the case or drop the link/test. |
| `TITLE_MISMATCH` | low | Linked titles differ in meaning (ignore camelCase/underscore/punctuation differences). | Usually cosmetic; align only if meaning differs. |
| `SUITE_MISMATCH` | low | Case isn't under the suite for its app (`Backend`, `Web`, `Admin`). | Move case or confirm the structure. |
| `TO_BE_AUTOMATED` | info | *To be automated* case with no test yet. | Informational. |

Manual cases with no linked test (e.g. the AC scenarios nobody has automated) are not inconsistencies; count them in the summary only.

How to judge:
- Match on meaning, not wording: `createOrder_cashPayment_succeeds` and "Order total is calculated correctly" can be the same check. One test may cover several AC scenarios (link all of them), and one scenario may be covered by an API test and an E2E test.
- An `UNLINKED_TEST` and an `AUTOMATED_CASE_WITHOUT_TEST` that point at each other are one inconsistency (a missing link), not two.
- For likely matches, open the test and the case (`qase_get`) and compare its steps/expected results with what the test actually asserts. Note real behavioural drift (the test checks something the case doesn't describe, or vice versa).
- **Seeded issues are intentional.** `FM-FLAKE-NN` tests are flaky on purpose and `FM-BUG-NN` code is a deliberate bug (see the root `AGENTS.md`). Never "fix" the code to make it match Qase; a Qase case may legitimately describe the correct behaviour that an `FM-BUG` breaks — report it as "expected failure due to FM-BUG-NN", not as drift. An `FM-FLAKE` marker whose comment says `FIX` should still be reported, with that note.

## 4. Sync (only with approval)

Present the report (section 5) first and propose concrete actions grouped by side. Ask the user which to apply — Qase writes are visible to their whole team. Then:

**In code** — add/fix `// qase: <id>` markers directly above the test (keep existing comments and `FM-*` markers intact; don't touch test logic). This is a repo change: follow `.agents/rules/git-workflow.md` (new branch, then stop).

**In Qase:**
- Update a case: `qase_case_upsert` with `code`, `id`, `title` (required — pass the current title) and only the fields that change, e.g. `automation: "2"`, `is_flaky: "1"`.
- New cases: `qase_case_bulk_create` (up to 100 per call; never loop `qase_case_upsert` for creates). Derive `title` from the test (human-readable, not camelCase), set `suite_id` to the app's suite, `automation: "2"`, `is_flaky: "1"` when the test has an `FM-FLAKE` marker, `tags: ["<app>", "automated"]`, and `steps` (`[{ "action": "...", "expected_result": "..." }]`) summarising what the test does. Then add the returned IDs as `// qase:` markers.
- Missing suites: `qase_suite_upsert` (`Backend` / `Web` / `Admin` root suites, and a sub-suite per test class or spec file if needed). Read the tree from `qase_project_context` first and create parents before children.

Never delete Qase cases or suites and never delete tests; suggest deprecation instead. After applying, repeat section 2 (`qase_project_context` is cached for 5 minutes — rely on `qql_search` to see fresh case data) and confirm the fixed findings are gone.

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
| App | Test (file:line) | Best Qase candidate | Proposed action |
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
Numbered list: code changes, Qase changes (tool + case IDs + fields), and open questions for the user.
If changes were applied: what was changed, and the before/after finding counts.
```

Omit empty sections, but state "none" in the summary for categories that were checked and clean.

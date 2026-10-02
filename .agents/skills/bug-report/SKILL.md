---
name: bug-report
description: Write a complete, reproducible bug report for FoodMe (backend, web storefront or admin back office) following the project's bug report format rule. Use when asked to write, draft, file, log or improve a bug report / defect / issue, to turn a failing test, error, stack trace, Sentry/GlitchTip event or user complaint into a bug report, or to document a problem found while testing.
---

# Write a FoodMe bug report

The required format — sections, severity/priority definitions and FoodMe specifics — is defined in [`template.md`](template.md) in this skill's folder. Read it first and follow its template exactly; this skill is the workflow for filling it in with verified facts.

## 1. Gather what is already known

Collect from the conversation and the user's input: what went wrong, where (backend / web / admin, page or endpoint), test data used, error text, screenshots, logs, failing test output. Ask the user only for what you can't find or verify yourself (e.g. the device they saw it on). Ask all missing questions at once, not one by one.

## 2. Check it is a real, new bug

- **Seeded issues:** grep for `FM-BUG-` and `FM-FLAKE-` near the affected code (`rg "FM-(BUG|FLAKE)-\d+" apps`). If it matches one, the report must reference that tag.
- **Intentional demo behaviour:** simulated API latency, `FlakyHeartbeatJob` / `flakyHeartbeat` fake errors and `GET /api/debug/boom` are not bugs on their own. Say so instead of writing a report.
- **Duplicates:** if an issue tracker or Qase is connected, search it for the same symptom and link any match rather than creating a duplicate.

## 3. Reproduce and pin down the steps

Reproduce it when you can, so the steps and actual result are observed rather than guessed:
- **Backend/API:** call the endpoint (curl or the failing JUnit test: `./gradlew test --tests '<Class>.<method>'` in `apps/backend`). Record method, path, request body, status and response body.
- **Web / admin UI:** use the Playwright browser tools or the relevant E2E spec (`npx playwright test -g "<title>"`). Record the exact URL, clicks and inputs; take a screenshot of the actual result.
- **Intermittent:** repeat several times and record the rate (e.g. 3 of 10). Note whether it also fails with the `test` profile (no simulated latency).
- Reduce the steps to the shortest path that still reproduces it, starting from a clear precondition (logged out / logged in as a new customer / admin `admin` / empty cart, etc.).

If you can't reproduce it, still write the report from the user's evidence, set reproducibility to what was reported, and state that it was not reproduced and under which conditions you tried.

## 4. Collect environment and evidence

```
git rev-parse --short HEAD && git branch --show-current     # version
node -v; java -version                                      # only if relevant
```
- UI bugs: OS, device/viewport and browser + version (ask the user if it came from them; use the Playwright browser's version if you reproduced it).
- Deployed instance: the Render URL and deploy date/commit.
- Evidence: browser console errors, failing network request, backend log lines (Loki, or the console when running `bootRun`), the Sentry/GlitchTip event link, failing test output. Save screenshots/logs to a scratch dir (`$CLAUDE_JOB_DIR/tmp` if set) and list them under Attachments.
- **Redact** tokens (`Authorization: Bearer …`), passwords and personal data from everything you attach or quote.

## 5. Find the likely cause (optional, but useful)

If time allows, trace the symptom to code: endpoint → controller → service (backend), or page → hook/api call (web/admin). Put the finding in "Possible cause / suggested fix" with `path:line`, labelled **hypothesis** unless you confirmed it (e.g. by a test or by temporarily changing the code locally and reverting). Don't commit any fix as part of writing the report.

## 6. Write the report

Fill the rule's template:
- Summary: one specific line — what, where, when.
- Severity and priority chosen separately, using the rule's definitions; add a few words explaining the choice when it isn't obvious.
- Steps numbered, one action each, with concrete data; actual and expected results kept separate, and expected result tied to a source (spec, Qase case, API contract, previous behaviour).
- Every required section present; write "Unknown — <what is needed>" or "None" rather than omitting it.

Before finishing, check: could someone new to FoodMe reproduce this from the report alone, and does it contain anything secret? Fix the report if not.

## 7. Deliver

- Default: give the report in the chat as Markdown.
- If the user wants a file, save it where they say (e.g. `bug-reports/<yyyy-mm-dd>-<short-slug>.md`).
- If the user wants it filed in a tracker (Jira, Qase, GitHub issue), show the final report first and file it only after they confirm; then share the created issue link. Attach evidence files where the tracker supports it.
- Several bugs: write one report per bug, never combine them.

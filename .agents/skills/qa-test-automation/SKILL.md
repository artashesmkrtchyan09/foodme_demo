---
name: qa-test-automation
description: Step 9 of the feature-qa workflow. Chooses which of the feature's Qase cases to automate (ISTQB selection criteria), writes or updates Playwright specs in apps/web/e2e or apps/admin/e2e on a test/ branch following the repo's e2e rules, links them with // qase: ids, marks the cases Automated, and writes 09-automation.md. Also applies the automation judge's and the CI flake check's findings on later cycles. Use only when the feature-qa skill runs step 9 for a qa-runs/<folder>.
---

# Test automation with Playwright (step 9)

Input: the run folder. Read these:
- `05-test-cases.yaml`, `07-test-execution.json` and `08-defects.md`
- `09-automation.md`, `10-automation-review.md` and `11-flake-check.md`, if they exist (on a re-run, the latest judge findings or CI failures are your task list)
- `.agents/skills/feature-qa/references/istqb.md` §7–8 and `references/artifacts.md` (step 9)
- for each app you touch, all of these, in full:
  - `apps/<app>/AGENTS.md`
  - `apps/<app>/.agents/rules/e2e-tests.md`
  - `apps/<app>/.agents/rules/e2e-locators-and-waits.md`

## 1. Branch (first cycle only)

Follow `.agents/rules/git-workflow.md`:
1. `git switch main && git pull --ff-only`
2. `git switch -c test/<app>-<key-or-slug>`, lowercase (for example `test/web-scrum-12-cart-quantity-limits`)

If the working tree isn't clean, stop and return `BLOCKED: uncommitted changes on <branch>`. Record `branch` in `00-progress.yaml`. On later cycles, stay on that branch.

## 2. Select

For each case that isn't deprecated, decide whether to automate it or keep it manual, using istqb.md §7. Write down the reason.
- Cases that were `blocked` on prod because of admin or fault injection are good candidates for the admin suite against the CI backend, when the e2e rules allow them.
- If a case fails because of a seeded `FM-BUG`, it is still automated, with `test.fail(true, "FM-BUG-NN: …")`.
- A case that fails because of a new bug filed in step 8 is automated, asserting the **correct** behaviour, and marked `test.fail(true, "<JIRA-KEY>: <one line>")`. That way CI stays green and the test flags the fix.

## 3. Write

- **Placement.** Add to the matching area spec, or create `<area>.spec.ts`. Never name a file `flake-*`.
- **Structure.** One `test()` per Qase case, with `// qase: <id>` on the line above it, and a title that states the user-visible behaviour. The steps and assertions follow the Qase case's steps and expected results.
- **Data.** Each test creates its own data through the API (`e2e/auth.ts` helpers), and finds chefs and dishes through the API.
- **Locators.** Use roles, labels or `data-testid`. If a needed `data-testid` is missing, write it down as a testability gap in the artifact. Don't edit product code in this step.
- **Waits.** Use web-first assertions only: no `waitForTimeout`, no `networkidle`, no raised timeouts.

## 4. Verify locally

Run these in `apps/<app>`:
- `npm run lint`
- `npx tsc --noEmit -p .`, or `npm run build` for web

If the backend answers on `http://localhost:8081/actuator/health`, also run:
```
npx playwright test <specs> --repeat-each=3 --retries=0
```
If it doesn't answer, write `local run: not run (no backend on :8081); CI step 11 is the run`. Never point the specs at prod.

## 5. Update Qase

Run `qase_case_upsert` (with the current `title`) and set `automation` to Automated for every automated case. Set `is_flaky` only if CI step 11 proved the case flaky and the fix is still pending.

## 6. Findings (later cycles)

Handle every judge finding and every CI flake: fix it, or reject it with a reason. Answer each one in `## Changes in cycle N` and in the `### Response` table of the review artifact. A CI flake is fixed at its cause (a wait, data or order problem), never with retries or longer timeouts.

## 7. Write the artifact

Write `09-automation.md` and bump `cycle`. Leave the changes uncommitted; step 11 pushes them after approval.

Return one line: `cycle N: <n> automated, <n> manual; specs <paths>; local run <result>`. If nothing qualifies for automation, return `NONE: <reason>`.

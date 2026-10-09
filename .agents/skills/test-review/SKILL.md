---
name: test-review
description: Review the tests added or changed in a FoodMe pull request (backend JUnit/MockMvc, web and admin Playwright) and report badly written tests and missing tests. Use in CI on a PR, or when asked to review tests, check test quality, find test gaps or missing coverage for a diff, branch or PR number. Read-only; never edits files.
---

# Review tests in a FoodMe change

Reports two things, and only these two:

1. **Bad tests**: tests added or changed in the diff that break the project's test rules.
2. **Missing tests**: behaviour added or changed in the diff that no test covers.

The skill is read-only and non-interactive, so it can run unattended in CI. Never edit, commit, push or ask questions. If something is unclear, make the call from the code and say what you assumed.

## 1. Find what changed

Target = the PR number or branch given, else `HEAD`. Diff against the merge base:

```
git fetch origin main --depth=200 2>/dev/null
git diff --name-status origin/main...HEAD
```

Split the changed files:

| Area | Test files | Production code |
|---|---|---|
| backend | `apps/backend/src/test/**` | `apps/backend/src/main/**` |
| web | `apps/web/e2e/**` | `apps/web/src/**` |
| admin | `apps/admin/e2e/**` | `apps/admin/src/**` |

Ignore generated output, lockfiles, docs and agent files. If no test file and no production code changed in these areas, report "Nothing to review" and stop.

Review **only lines the diff adds or changes**. Existing problems in untouched tests are not this PR's fault: don't report them.

## 2. Bad tests

Read each changed test in full (not just the hunk), then check it against the rules for its area. The rules are the source of truth; read them, don't work from memory:

- backend: `apps/backend/.agents/rules/backend-tests.md`
- web: `apps/web/.agents/rules/e2e-tests.md` and `e2e-locators-and-waits.md` (same folder)
- admin: `apps/admin/.agents/rules/e2e-tests.md` and `e2e-locators-and-waits.md`

Look hardest for the failures that make tests flaky or worthless:

| Check | Backend | Playwright |
|---|---|---|
| Hard-coded or shared data | fixed emails/usernames, no `UUID` | shared accounts, fixed names or IDs from seed data |
| Absolute counts, IDs, `[0]` on unordered lists | `hasSize(n)`, `$[0]`, `FM-100001` style IDs | exact totals or "first item" on lists other runs grow |
| Time | `LocalDate.now()`, local clock | `waitForTimeout`, sleeps, `networkidle`, raised timeouts |
| Order dependence | `@Order`, `@TestMethodOrder`, `@DirtiesContext` | `test.describe.serial`, state left by another test |
| Weak or missing assertion | no `status()`, only `isOk()`, whole-JSON string compare | no assertion after the last action, one-shot `isVisible()` / `textContent()` |
| Wrong locator or layer | n/a | class, XPath, `nth()` without need; API-contract details tested through the UI |
| Cheating | assertion weakened to fit a seeded `FM-BUG` instead of `@Disabled("Blocked by FM-BUG-NN: …")` | same, instead of `test.fail(true, "FM-BUG-NN: …")` |
| Hygiene | hand-written JSON bodies, bad method name (not `action_condition_expectedResult`), no `// qase:` link, `@Disabled` without reason | `test.only`, `skip`/`fixme` without reason, hard-coded API URL, `flake-*` name on a normal spec |
| Test that can't fail | asserts a mock or the request it just built; empty body | `expect(true)`, assertion inside a swallowed `catch` |

Skip anything tagged `FM-FLAKE-NN`, files named `flake-*.spec.ts`, and code marked `FM-BUG-NN`: they are intentional (root `AGENTS.md`). Do flag a **new** test that copies one of their patterns.

Severity:
- **blocker**: will be flaky, can't fail, or hides a bug (shared data, absolute counts, hard waits, `test.only`, weakened assertion, no assertion).
- **warning**: breaks a convention but is stable (naming, locator choice, missing `// qase:` link).

Report a finding only when you can point at the line and say what goes wrong. No style nitpicks, no "consider".

## 3. Missing tests

Work from the production changes, then check what already covers them:

1. List the behaviour the diff adds or changes (read the production diff, not only file names).
2. For each, search for a test: `rg` the endpoint path, class or method in `apps/backend/src/test`, the page, route or visible text in `apps/*/e2e`. Count tests from the PR and from `main`.
3. A gap is real only if nothing found covers that behaviour. Never report a gap you didn't search for.

What to expect per area:

- **backend** (see `backend-tests.md`, *What to assert*): for every new or changed endpoint, the happy path, each validation failure (400 and its exact message), 404, no token (401) and wrong role (403) on protected paths, and each business-rule rejection (`BadRequestException`). A changed service rule needs a test of the new branch. A new Flyway migration or entity field needs `src/test/resources/data.sql` updated if tests read it.
- **web**: each new or changed user flow, route or form rule (cart, checkout, auth, tracking, order history) has an E2E test of the user-visible outcome, plus the edge cases users hit (empty, error, unauthenticated redirect). API-contract detail belongs in backend tests, not here.
- **admin**: each new or changed list, filter, show/edit page or status transition has an E2E test. Status flow changes must be covered for the allowed and the rejected transition.
- **cross-app**: a response field or status renamed in backend `src/main` with no matching test change in backend, web or admin is a gap.
- **new tests that stop short**: a new test file covering only the happy path of an endpoint with validation or auth rules is a gap, listed under the missing cases.

Do not ask for tests of: refactors with no behaviour change, comments, styling-only changes, docs, config, seeded `FM-BUG`/`FM-FLAKE` code, or demo-only behaviour (simulated latency, heartbeat, `/api/debug/boom`).

Priority: **high** = new endpoint/flow or changed business rule with no test; **medium** = missing negative/edge case on a covered behaviour; **low** = nice to have. Give a concrete suggested test name (`action_condition_expectedResult` for backend, user-visible title for Playwright) and the file it belongs in.

## 4. Report

The final message is the whole report, in exactly this format, so CI can post it as one comment and parse the verdict. No preamble, no closing chat.

```
## Test review

**Verdict:** PASS | CHANGES REQUESTED
**Scope:** <n> test files, <n> production files (backend / web / admin)

### Bad tests (<count>)
| Severity | Location | Problem | Fix |
|---|---|---|---|
| blocker | `path:line` | what goes wrong and why it matters | what to do |

### Missing tests (<count>)
| Priority | Covers | Suggested test | Goes in |
|---|---|---|---|
| high | `path:line` or endpoint it covers | `register_shortPassword_rejected` | `CustomerAuthControllerTest` |
```

- Verdict is `CHANGES REQUESTED` when there is any blocker or any high-priority gap; otherwise `PASS`. Warnings and medium/low gaps are listed but don't change the verdict.
- An empty section says `None found.` instead of an empty table.
- Order rows by severity/priority, then by file.
- Everything you list must be verified in the code. If you could not check something (for example, no backend to run), say so in one line under the verdict; don't guess.

## CI notes

- Static review only: don't build, start the backend or run suites. CI has other jobs for that.
- If the run has a GitHub comment tool, post the report as a single PR comment and update that comment on later pushes instead of adding new ones. Otherwise print it.
- The exit status must not depend on the verdict; the caller reads the **Verdict** line.

# Agentic Mutation Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A PR workflow where a Claude agent mutates the changed code of backend, web and admin, runs that module's tests per mutant, and a gate publishes a required commit status from the resulting reports.

**Architecture:** The procedure lives in a skill (`mutation-test`). A small dependency-free Node script validates reports, recomputes scores and renders markdown, so the gate does not trust the agent's arithmetic. One workflow runs the agent per changed module (matrix); a second, `workflow_run`-triggered gate downloads the reports, comments on the PR and sets `quality-gate/mutation-testing`.

**Tech Stack:** GitHub Actions, `anthropics/claude-code-action@v1`, Node 20 (`node:test`, no npm deps), Gradle/JUnit, Playwright, Postgres service container.

**Spec:** `docs/superpowers/specs/2026-10-13-mutation-testing-design.md`

## Global Constraints

- Modules: `backend`, `web`, `admin`. Report file name: `mutation-report-<module>.json`.
- Statuses: `KILLED`, `SURVIVED`, `INVALID`. Results: `PASS`, `FAIL`, `SKIPPED`, `ERROR`.
- `mutations` = killed + survived (INVALID listed, not counted). `score` = killed / mutations x 100, one decimal.
- `PASS` iff score >= threshold. Default threshold 70 via repo variable `MUTATION_SCORE_THRESHOLD`.
- 8-12 mutants per module. Never commit or push from the agent; revert every mutant.
- Commit status context: `quality-gate/mutation-testing`. PR comment marker: `<!-- claude-mutation-testing -->`.
- Repo git rule: leave changes uncommitted; commit only when the user asks. The "Commit" steps below are executed only on request (`/ship-pr`).
- Do not touch `ci.yml` or any `FM-BUG` / `FM-FLAKE` code.

## Review Focus

- Report with `mutations: 0` but result `PASS` (agent produced nothing) -> must be `ERROR`, not pass.
- Reported `score` / `killed` / `survived` disagree with the mutant list -> recomputed values win.
- Score exactly equal to the threshold -> `PASS`.
- A changed module has no report artifact -> gate fails.
- Malformed JSON or unknown status value in a report -> `ERROR`, never a crash that skips the gate.

---

## File Structure

- `.github/scripts/mutation-report.mjs` - validate / recompute / render / aggregate (pure functions + tiny CLI)
- `.github/scripts/mutation-report.test.mjs` - `node --test` suite for the above
- `.agents/skills/mutation-test/SKILL.md` - the agent procedure
- `.github/workflows/claude-mutation-testing.yml` - detect + per-module agent run
- `.github/workflows/claude-mutation-testing-gate.yml` - comment + commit status
- `AGENTS.md` (root) - list the new skill

### Task 1: Report script

**Files:**
- Create: `.github/scripts/mutation-report.mjs`
- Test: `.github/scripts/mutation-report.test.mjs`

**Interfaces:**
- Produces (named exports):
  - `normalize(report: object, threshold: number) -> Report` - recomputes `mutations`, `killed`, `survived`, `score`, `threshold` from `report.mutants`; keeps `module`; sets `result` per the rules below. Never throws: invalid input returns `{module, result: "ERROR", error: string, mutants: []}`.
  - `overall(reports: Report[], expectedModules: string[]) -> {state: "success"|"failure", description: string}`
  - `renderMarkdown(reports: Report[], marker: string) -> string` - starts with `marker`, a summary table (module, mutations, killed, survived, score, result) and, per module, a table of every mutant (id, file:line, type, description, status).
- CLI: `node mutation-report.mjs <reportsDir> <threshold> <modulesCsv>` reads `mutation-report-*.json` recursively, writes `summary.md` and `status.json` (`{state, description}`) into `<reportsDir>`, exits 0 always (the gate reads `status.json`).
- Result rules in `normalize`: incoming `result` of `SKIPPED` or `ERROR` is kept; otherwise `mutations === 0` -> `ERROR`; `score >= threshold` -> `PASS`; else `FAIL`. Unknown mutant status -> `ERROR`.

- [ ] **Step 1: Write failing tests** in `mutation-report.test.mjs` (`node:test`, `node:assert/strict`):
  - `normalize recomputes counts and score from mutants` - 7 KILLED + 3 SURVIVED + 1 INVALID, reported score 99 -> `{mutations: 10, killed: 7, survived: 3, score: 70, result: "PASS"}` at threshold 70.
  - `score equal to threshold passes`, `score just below threshold fails` (6 killed / 4 survived at 70 -> `FAIL`, score 60).
  - `zero counted mutants is ERROR` - only INVALID mutants and reported `PASS` -> `ERROR`.
  - `SKIPPED is preserved` with empty mutants.
  - `unknown status is ERROR`; `non-object input returns ERROR without throwing`.
  - `overall succeeds when all PASS or SKIPPED`; `overall fails on any FAIL or ERROR`; `overall fails when an expected module has no report` (description names the module).
  - `renderMarkdown starts with the marker and lists every mutant id and status`.
- [ ] **Step 2:** Run `node --test .github/scripts/` -> Expected: FAIL (module missing).
- [ ] **Step 3:** Implement the exports and CLI in `mutation-report.mjs` (ES module, only `node:fs`/`node:path`). Round score with `Math.round(x * 10) / 10`.
- [ ] **Step 4:** Run `node --test .github/scripts/` -> Expected: all PASS.
- [ ] **Step 5: Commit** (only when asked): `Add mutation report validator and renderer`.

### Task 2: `mutation-test` skill

**Files:**
- Create: `.agents/skills/mutation-test/SKILL.md`

**Interfaces:**
- Consumes: report schema from Task 1 (field names and statuses above).
- Produces: the procedure the workflow prompt invokes as "use the mutation-test skill for module <m> with threshold <t>". Output file: `mutation-report-<module>.json` in the repo root of the checkout.

- [ ] **Step 1:** Write `SKILL.md` with frontmatter `name: mutation-test` and a `description` in the style of `test-review` (what it does, when to use: in CI on a PR or when asked to mutation-test a diff/module). Body sections, mirroring the spec:
  1. Inputs and non-interactive rules (never commit/push/ask; mutate one thing at a time; always revert).
  2. Find scope: `git diff origin/main...HEAD -- apps/<module>/src`, exclusions, `SKIPPED` rule (write the report with empty `mutants`).
  3. Baseline run per module with exact commands: backend `cd apps/backend && ./gradlew test`; web/admin `cd apps/<module> && npx playwright test` (backend already running on :8081); re-run failures once, record known failures, `ERROR` report if still fully red.
  4. Mutant catalog: classic list, and a FoodMe product-specific list grounded in the files (`OrderService`, `AdminOrderService`, `ChefService`, `DishService`, `CustomerAuthService`, `SecurityConfig` role checks, translation columns/`hy` vs `Am`, pagination `{ dishDtoList, count }` / `{ list, count }`; web `useCart.ts`, order/checkout pages, schemas; admin `dataProvider`, `OrderShow.jsx`). Instruct: do not "fix" `FM-BUG` code; mutating a line next to one is fine, mutating the tagged line itself is not.
  5. Loop with statuses and the double-run rule; 8-12 mutants, riskiest first; related-test selection (backend `--tests` by controller/service name; frontend by spec keyword), full suite for survivors.
  6. Report: exact JSON schema example, `type` is `classic` or `product`, `killedBy` is the first failing test name or `null`.
  7. Final check: `git status --porcelain` must show no source changes (only the report); otherwise `git checkout -- apps/` before finishing.
- [ ] **Step 2: Verify** by reading the file against the spec checklist (every section of spec component 1 and 2 is present) and run `git diff --stat` to confirm only the intended files changed.
- [ ] **Step 3: Commit** (only when asked): `Add mutation-test skill`.

### Task 3: Mutation workflow

**Files:**
- Create: `.github/workflows/claude-mutation-testing.yml`

**Interfaces:**
- Consumes: the skill (Task 2) and the script tests (Task 1).
- Produces: artifacts `mutation-modules` (file `modules.json`: JSON array of changed modules) and `mutation-report-<module>` (file `mutation-report-<module>.json`) for the gate (Task 4).

- [ ] **Step 1:** Write the workflow:
  - `on: pull_request` types `[opened, synchronize, ready_for_review, reopened]`; permissions `contents: read, id-token: write`, plus `pull-requests: read` on the agent job.
  - Job `detect` (ubuntu-latest): checkout `fetch-depth: 0`; run `node --test .github/scripts/`; compute changed modules from `git diff --name-only origin/${{ github.base_ref }}...HEAD` matching `apps/<m>/src/` (and excluding `src/test`); write `modules.json`; upload as `mutation-modules`; output `modules` (JSON array) for the matrix.
  - Job `mutate`: `needs: detect`, `if: needs.detect.outputs.modules != '[]'`, `strategy.fail-fast: false`, `matrix.module: ${{ fromJSON(needs.detect.outputs.modules) }}`, `timeout-minutes: 90`, Postgres `postgres:16` service (db/user/password `foodme`, port 5432, health-checked).
  - Steps: checkout `fetch-depth: 0`; setup-java 17 + setup-gradle (backend root `apps/backend`) for every module (the frontends need the backend); build and start the backend in the background (`./gradlew bootRun`, log to file) and poll `http://localhost:8081/actuator/health` up to 5 min, tail the log and fail on timeout; for web/admin: setup-node 20 with npm cache, `npm ci`, `npx playwright install --with-deps chromium`; run `claude-code-action@v1` with `CLAUDE_CODE_OAUTH_TOKEN`, prompt `Use the mutation-test skill for module ${{ matrix.module }} with threshold ${{ vars.MUTATION_SCORE_THRESHOLD || '70' }}. Write mutation-report-${{ matrix.module }}.json to the repository root.`, `claude_args: --allowedTools "Read,Write,Edit,Grep,Glob,Bash(git:*),Bash(./gradlew:*),Bash(npx playwright:*),Bash(npm:*),Bash(cd:*),Bash(curl:*)"`; final `if: always()` upload of `mutation-report-<module>.json` as artifact `mutation-report-<module>` with `if-no-files-found: warn`.
- [ ] **Step 2: Verify:** `python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/claude-mutation-testing.yml'))"` (or `npx --yes yaml-lint`) parses; grep confirms the artifact names match Task 4.
- [ ] **Step 3: Commit** (only when asked): `Add Claude mutation testing workflow`.

### Task 4: Gate workflow

**Files:**
- Create: `.github/workflows/claude-mutation-testing-gate.yml`

**Interfaces:**
- Consumes: artifacts from Task 3; CLI from Task 1 (`status.json`, `summary.md`).
- Produces: commit status `quality-gate/mutation-testing` and the marked PR comment.

- [ ] **Step 1:** Write the gate, modelled on `claude-tests-review-gate.yml`: `on: workflow_run: workflows: ["Claude Mutation Testing"], types: [completed]` (workflow `name:` in Task 3 must be exactly `Claude Mutation Testing`); permissions `contents: read, pull-requests: write, issues: write, statuses: write, actions: read`; checkout (for the script); `gh run download ${{ github.event.workflow_run.id }} -D reports` with `GH_TOKEN`; read `reports/mutation-modules/modules.json` (missing -> publish failure); run `node .github/scripts/mutation-report.mjs reports <threshold> <modulesCsv>`; upsert the PR comment containing the marker (PATCH when found, `gh pr comment --body-file` otherwise) from `reports/summary.md`; publish the status from `status.json` with `target_url` = comment URL, same `publish()` helper style as the existing gate; a run whose conclusion is not `success` publishes failure unless the matrix was skipped because no module changed (empty `modules.json` -> success "No source changes to mutate").
- [ ] **Step 2: Verify:** YAML parses; dry-run the CLI locally on a fixture directory with one passing and one failing report and confirm `status.json` and `summary.md` content (`node .github/scripts/mutation-report.mjs <fixtureDir> 70 backend,web`).
- [ ] **Step 3: Commit** (only when asked): `Add mutation testing quality gate workflow`.

### Task 5: Docs

**Files:**
- Modify: `AGENTS.md` (root) - add `mutation-test` to "Current skills" with one line: agentic mutation testing of a diff per module, writes `mutation-report-<module>.json`, used by `claude-mutation-testing.yml`.
- Modify: `.github/workflows/claude-mutation-testing-gate.yml` header comment - note that `quality-gate/mutation-testing` must be made required in `main` branch protection (user action).

- [ ] **Step 1:** Make both edits.
- [ ] **Step 2: Verify:** `git status --short` lists exactly the six new/changed paths plus the spec and plan; no `.env`, build output or report JSON present.
- [ ] **Step 3: Commit** (only when asked): `Document mutation-test skill`.

## Self-review

- Spec coverage: skill (T2), report schema and recompute (T1), workflow with detect/matrix/Postgres (T3), gate/status/comment (T4), threshold variable (T3/T4), out-of-scope respected (no `ci.yml`).
- Names consistent: artifacts `mutation-modules`, `mutation-report-<module>`; marker, context and workflow name identical across T3/T4/T5.
- Not verifiable locally: the agent run itself and GitHub-hosted behaviour; first real check is a PR run. Note this in the final report.

# Agentic mutation testing with a quality gate

Date: 2026-10-13 · Branch: `feat/ci-mutation-testing`

## Goal

On every pull request, a Claude agent mutates the code the PR adds or changes in `apps/backend`, `apps/web` and `apps/admin`, runs that module's tests after each mutation, and reports how many mutants the tests caught. A paired gate workflow publishes a required commit status.

Mutations are both classic (operator flips, negated conditions, boundaries, dropped statements) and product-specific (order totals, status transitions, cart quantities, auth checks, validation, translations, pagination).

## Components

### 1. Skill `.agents/skills/mutation-test/SKILL.md`

Holds the whole procedure so the workflow prompt stays short (same pattern as `test-review`). Input: a module (`backend` | `web` | `admin`) and a threshold.

**Scope.** Lines added or changed by the PR (`git diff origin/main...HEAD -- apps/<module>/src`). Excluded: tests, e2e specs, generated files, config, lock files. No changed source in the module → result `SKIPPED`.

**Baseline.** Run the module's suite before mutating. Failing tests are re-run once; tests that still fail are recorded as known failures (including `FM-FLAKE-NN`) and ignored when judging mutants. A fully red baseline stops the run with result `ERROR`.

**Mutant catalog.**
- Classic: relational/arithmetic operator flip, negated condition, boundary change, `&&`/`||` swap, removed statement, changed return value.
- Product-specific: fee or discount skipped in an order total, invalid status transition allowed, cart quantity off by one, auth/role check dropped, validation dropped, wrong translation language, pagination `count` wrong, `{ list, count }` shape changed.

**Per-mutant loop.** Apply one mutation → confirm it compiles/lints → run the module's tests → record the status → revert with `git checkout -- <file>`. Only one mutation is ever applied at a time. 8–12 mutants per module, spread over the changed files, riskiest logic first.

**Statuses.**
- `KILLED`: a baseline-passing test failed, and failed again on a re-run (or the run timed out).
- `SURVIVED`: all tests passed. Before it is final, the full module suite is run once more.
- `INVALID`: did not compile or lint. Excluded from the score.

**Test commands.**
- backend: `./gradlew test --tests <related>`, full `./gradlew test` for survivors.
- web / admin: `npx playwright test <related specs>` against a running backend; full suite for survivors.

### 2. Report `mutation-report-<module>.json`

```json
{
  "module": "backend",
  "mutations": 10,
  "killed": 7,
  "survived": 3,
  "score": 70.0,
  "threshold": 70,
  "result": "PASS",
  "mutants": [
    { "id": "M1", "file": "path", "line": 42, "type": "product",
      "description": "...", "status": "KILLED", "killedBy": "OrderControllerTest#..." }
  ]
}
```

- `mutations` = killed + survived (INVALID mutants are listed but not counted).
- `score` = killed / mutations × 100, one decimal.
- `result` = `PASS` if score ≥ threshold, `FAIL` if below, `SKIPPED` if no changed source, `ERROR` if the baseline was red or no report was produced.
- Every mutant is listed with its status. The workflow also renders a markdown table of all mutants into the job summary and a PR comment marked `<!-- claude-mutation-testing -->`.

### 3. Workflow `.github/workflows/claude-mutation-testing.yml`

- Trigger: `pull_request` (opened, synchronize, ready_for_review, reopened).
- A `detect` job finds which modules have changed source files.
- A matrix job runs per changed module: set up JDK 17 or Node 20, start Postgres as a service container, build and start the backend (`bootRun`), install Playwright for web/admin, then run `anthropics/claude-code-action@v1` with the `mutation-test` skill.
- Uploads `mutation-report-<module>.json` as an artifact (always).
- Never commits or pushes. The mutated working tree is discarded with the runner.
- Threshold comes from the repo variable `MUTATION_SCORE_THRESHOLD` (default 70).

### 4. Gate `.github/workflows/claude-mutation-testing-gate.yml`

Clone of the tests-review gate. Runs on `workflow_run` completion, downloads the report artifacts, and publishes the commit status `quality-gate/mutation-testing`:
- success: every module is `PASS` or `SKIPPED`.
- failure: any module `FAIL` or `ERROR`, a missing report for a changed module, or a run that did not complete.

The status is made required in the `main` branch protection by the user.

## Out of scope

PIT / Stryker, mutating unchanged code, auto-fixing survivors, changes to `ci.yml`.

## Risks

- Frontend E2E per mutant is slow; scoping to related specs and the mutant cap bound the runtime. Add job timeouts.
- Seeded `FM-FLAKE` tests can fake a kill; handled by the baseline and the double-run rule.
- Agent-reported results are only as honest as the agent; the gate validates the JSON schema and recomputes the score from the mutant list.

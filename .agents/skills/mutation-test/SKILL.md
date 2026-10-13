---
name: mutation-test
description: Mutation-test the code added or changed in a FoodMe pull request for one module (backend, web or admin). Applies classic and product-specific logic mutations one at a time, runs the module's tests after each, and writes mutation-report-<module>.json with mutations, killed, survived, score and pass/fail plus every mutant. Use in CI on a PR, or when asked to mutation-test a diff, branch or module, or to check how well tests catch logic changes.
---

# Mutation-test a FoodMe change

Measures whether the tests catch logic changes in the code a PR adds or changes. You break the code on purpose, one small change at a time, and see if the module's tests notice.

Input: a **module** (`backend`, `web` or `admin`) and a **threshold** (percent, default 70). Output: `mutation-report-<module>.json` in the repository root.

The skill is non-interactive. Never ask questions, commit, push or leave a mutation behind. If something is unclear, decide from the code and say what you assumed in a mutant's `description`.

## 1. Find the scope

```
git fetch origin main --depth=200 2>/dev/null
git diff -U0 origin/main...HEAD -- apps/<module>/src
```

Mutate only lines the diff **adds or changes**. Never mutate:
- tests (`apps/backend/src/test/**`, `apps/*/e2e/**`), generated files, config, lock files, `node_modules`, `build`, `dist`
- a line tagged `FM-BUG-NN` or `FM-FLAKE-NN` (they are intentionally broken; a line next to one is fine)

If the module has no added or changed source lines, write the report with `"result": "SKIPPED"` and `"mutants": []`, then stop.

## 2. Baseline

Run the module's whole suite once before mutating anything.

| Module | Command (run from the module dir) |
|---|---|
| backend | `./gradlew test` |
| web, admin | `npx playwright test` (the backend is already running on `:8081`) |

Re-run each failing test once. Tests that still fail are **known failures** (this includes the seeded `FM-FLAKE-NN` tests): remember their names and ignore them when judging mutants. If the suite is red beyond that, for example it does not build or nothing runs, write the report with `"result": "ERROR"`, an `"error"` string and `"mutants": []`, then stop.

## 3. Choose mutants

Pick **8 to 12**, spread across the changed files, riskiest logic first. Each mutant is one small edit to one place.

**Classic**
- flip a relational or arithmetic operator (`>` to `>=`, `+` to `-`, `<` to `<=`)
- negate a condition, swap `&&` and `||`
- change a boundary or constant by one
- remove a statement or a call
- change a return value (`true` to `false`, a value to `null` or `0`)

**Product-specific** (prefer these where the diff touches them)
- order: delivery fee or discount skipped in the total, wrong sum or rounding, an invalid status transition allowed or a valid one blocked
- cart: quantity add or decrement off by one, item not removed at zero, totals ignore quantity
- auth: a role or JWT check dropped (`ROLE_CUSTOMER`, `ROLE_ADMIN`), an admin-only route opened
- validation: a required-field or bean-validation rule removed or weakened
- translations: wrong language picked or fallback broken (`Am` columns vs `hy` DTO lang, `en` / `ru`)
- lists: pagination `page` / `size` / `count` wrong, the `{ list, count }` or `{ dishDtoList, count }` shape changed (the admin `dataProvider` depends on it)
- errors: wrong exception or status code (`NotFoundException` vs `BadRequestException`), error `message` changed
- web and admin UI: a filter, sort, disabled-state or conditional render inverted; a form schema rule loosened; a request field renamed

## 4. Run each mutant

For every mutant, in order, one at a time:

1. Apply the edit.
2. Check it still builds: backend `./gradlew compileJava`, web `npx tsc -b`, admin `npx eslint <file>`. If it does not, set status `INVALID`, revert, and move on.
3. Run only the **related tests**. Backend: `./gradlew test --tests <Controller or Service test class>`. Web and admin: `npx playwright test <spec files>` whose names match the area, for example the cart specs for a cart mutant. Use `--workers=1` for admin.
4. A failing test that is **not** a known failure means a candidate kill. Re-run that test once. It must fail again: then status `KILLED`, with `killedBy` set to the first failing test name. A test that passes on the re-run is a flake: ignore it.
5. If nothing failed, run the module's **full suite** once. If that finds a new failure, status `KILLED` (same re-run rule). If not, status `SURVIVED`.
6. Revert: `git checkout -- <file>`. Confirm with `git diff --stat -- apps/` that nothing is left before the next mutant.

A test run that exceeds its time limit counts as `KILLED` (`killedBy`: `"timeout"`).

## 5. Write the report

Write `mutation-report-<module>.json` in the repository root:

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
    {
      "id": "M1",
      "file": "apps/backend/src/main/java/am/foodme/backend/service/OrderService.java",
      "line": 42,
      "type": "product",
      "description": "Skip the delivery fee when computing the order total",
      "status": "KILLED",
      "killedBy": "OrderControllerTest#createOrder_totalIncludesFee"
    }
  ]
}
```

- `id`: `M1`, `M2`, ... in the order you ran them. `type`: `classic` or `product`. `status`: `KILLED`, `SURVIVED` or `INVALID`. `killedBy`: the test name, or `null` when not killed.
- `mutations` = killed + survived (INVALID mutants are listed but not counted). `score` = killed / mutations × 100, one decimal.
- `result`: `PASS` if `score >= threshold`, otherwise `FAIL`. List **every** mutant, including survivors and invalid ones.

The workflow's gate recomputes every number from `mutants`, so make the list the source of truth.

## 6. Leave the tree clean

Run `git status --porcelain`. Only `mutation-report-<module>.json` (and build output) may differ. If any source file under `apps/` is modified, run `git checkout -- apps/` before you finish.

Finish with a short summary: module, mutations, killed, survived, score, result, and one line per survivor saying what test is missing.

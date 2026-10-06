---
name: backend-test
description: Write, run and debug FoodMe backend tests (apps/backend, JUnit 5 + MockMvc on H2) — cover an endpoint or feature, add missing cases, reproduce a bug as a failing test, investigate a red or flaky backend test, or run the backend suite and report the result. Use when asked to add, extend, fix, run or review backend/API/JUnit tests, check backend test coverage of an endpoint, or explain why ./gradlew test / gradle test fails.
---

# Test the backend

How to write the tests is defined in [`backend-tests.md`](../../rules/backend-tests.md): kind of test, naming, data isolation, auth, what and how to assert, seeded bugs and flakes. Read it first and follow it. The test profile and H2 setup are under *Tests* in [`apps/backend/AGENTS.md`](../../../AGENTS.md). This skill is the procedure.

Paths below are relative to `apps/backend`. Tests live in `src/test/java/am/foodme/backend`, seed data in `src/test/resources/data.sql`.

## 1. Branch

Unless the tests are part of a change already on a branch, update `main` and create `test/backend-<what>` (or `flake/fm-flake-NN-…` when stabilising a seeded flake). See `.agents/rules/git-workflow.md`.

## 2. How to run the suite

`gradle/wrapper/gradle-wrapper.jar` isn't in the repo, so `./gradlew` doesn't work. Use a local Gradle 8.6 + JDK 17 if there is one (`gradle test …`), otherwise the Docker image the Dockerfile builds with. From `apps/backend` in Git Bash:

```sh
gt() { MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W)":/app -v foodme-gradle-cache:/home/gradle/.gradle \
  -w /app gradle:8.6-jdk17 gradle test --no-daemon --console=plain "$@"; }
gt                                        # whole suite
gt --tests 'OrderControllerTest'          # one class
gt --tests 'OrderControllerTest.createOrder_*'
gt --tests 'DishControllerTest' --rerun   # rerun even if up to date
```

(On macOS/Linux use `$(pwd)` instead of `$(pwd -W)`. The first run downloads dependencies into the `foodme-gradle-cache` volume.)

Results: the console lists each test as PASSED/FAILED/SKIPPED. Details and stack traces are in `build/test-results/test/TEST-*.xml` and `build/reports/tests/test/index.html`. Neither goes into git.

## 3. Write tests for an endpoint or feature

1. **Read the code under test:** the controller method, its service, the request DTO's validation annotations and messages, the `SecurityConfig` matcher for the path, and the exceptions the service throws. The exact `message` strings come from there.
2. **Read the existing test class** for that controller, if there is one, and add to it. Otherwise create `<Feature>ControllerTest` copying the setup of `CustomerAuthControllerTest`.
3. **List the cases before writing,** using *What to assert* in the rule: happy path, each validation rule, not found, no token / wrong role, each business-rule rejection. Skip the ones already covered. For a bug, the case is the steps from the bug report.
4. **Check the seed data** in `data.sql` for the read-only rows you can assert against (chefs, dishes, tags, `admin`). Create everything else in the test with unique values.
5. **Write the tests,** one behaviour each, helpers at the bottom of the class. Add `// qase: <id>` above `@Test` when the case exists in Qase (the `qase-sync` skill finds the ids).
6. **Seeded bugs:** if a test fails because of an `FM-BUG-NN` (`rg -n "FM-BUG-\d+" src/main`), keep the correct assertion and add `@Disabled("Blocked by FM-BUG-NN: <one line>")`, as the rule says.

## 4. Verify the new tests

1. Run the class three times (`--rerun`). All three must pass.
2. Run the whole suite. A test that passes alone but fails here depends on shared data or order: fix the test, not the order.
3. Prove each new test can fail: change one expected value (or temporarily revert the fix it covers), run it, check the failure message points at the problem, then undo the change.

## 5. Investigate a failing test

Decide which of these it is before changing anything:

| Signal | It is | Do |
|---|---|---|
| Marked `// FM-FLAKE-NN` | a seeded flake | Leave it unless the task is that flake. In a report, name the tag. |
| Fails because the product is wrong and the code carries `FM-BUG-NN` | a seeded bug | Not a test problem. Name the tag. |
| Passes alone, fails in the full suite, or fails 1 in N runs | shared-data or order dependency, clock, unordered list | Rerun 5–10 times and record the rate, then fix per *Test data and isolation* and *What to assert* in the rule. |
| `ApplicationContext` fails to load, every test red | schema/seed mismatch, bad bean, config | Read the first `Caused by` in the XML report. Often a new entity field without values in `data.sql`, or an H2-incompatible column definition. |
| Fails only on H2 | Postgres-only SQL | Rewrite the query in JPQL or as a derived query (see the rule). |
| Consistent failure after a code change | a regression or a stale assertion | Read the diff of the code under test. Fix the code if the behaviour is wrong; update the assertion only when the behaviour change was intended, and say so. |

Never weaken an assertion, add sleeps or retries, or `@Disabled` a test just to get green. If a real, untagged product bug turns up, keep the failing test, disable it with a reason, and offer a report with the `bug-report` skill.

## 6. Report and stop

Leave the changes uncommitted and report:
- branch and files changed
- the cases added or changed, grouped by endpoint, with Qase ids where linked
- run results: the class ×3 and the full suite (passed / failed / skipped counts), naming any `FM-FLAKE` failures and anything disabled for an `FM-BUG`
- for an investigation: the cause, the evidence (rerun rate, stack trace line) and the fix or recommendation
- anything left open

Commit, push or open a PR only when the user asks (`ship-pr`).

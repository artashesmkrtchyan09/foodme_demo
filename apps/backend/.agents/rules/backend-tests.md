---
paths:
  - "src/test/**"
  - "apps/backend/src/test/**"
---

# Backend tests (`src/test`)

Applies to every test class and test resource in `apps/backend/src/test/`, new or changed. The test profile, H2 setup and `data.sql` loading are described under *Tests* in `apps/backend/AGENTS.md`. Seeded `FM-BUG`/`FM-FLAKE` code is described in the root `AGENTS.md`. This rule covers how to write tests that stay correct and stable.

## What kind of test to write

- **Endpoint behaviour: a MockMvc integration test** (`@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")`). It runs the real security, validation, services and H2 database. This is what every existing test does, and it's the default.
- **Pure logic with no Spring or DB** (a price calculation, a status-transition check): a plain JUnit 5 test with no Spring annotations is fine and much faster. Mockito and AssertJ come with `spring-boot-starter-test`, but don't mock repositories just to avoid the database. Use a MockMvc test instead.
- The Playwright suites cover what a user sees. Backend tests own the API contract: status codes, response fields, validation messages and authorization. Test those exhaustively here, not through the UI.

## Structure and naming

- One class per controller or feature, `<Feature>ControllerTest`, in package `am.foodme.backend` (where the existing ones are).
- Method names are `action_condition_expectedResult`, as in `CustomerAuthControllerTest`: `register_duplicateEmail_rejected`, `login_withRegisteredAccount_succeeds`.
- One behaviour per test. Several `andExpect` calls about the same response are fine. Two unrelated requests and checks should be two tests.
- Put request builders and token helpers in private methods at the bottom of the class (`uniqueEmail()`, `registerPayload(...)`, `customerToken()`). If a second class needs the same helper, move it into a shared test utility class rather than copying it.
- Link the test to its Qase case with `// qase: <id>` on the line above `@Test` (see the `qase-sync` skill). Keep existing `// FM-FLAKE-NN` comments as they are.

## Test data and isolation

**All test classes share one Spring context and one H2 database for the whole run.** Data a test creates stays there and is visible to every later test, in any class. So:

- **Create the data you need, with unique values.** Use `"<prefix>-" + UUID.randomUUID() + "@example.com"` for emails, as `uniqueEmail()` does. Never reuse a fixed email or username a previous test may already have registered.
- **Don't assert absolute counts, IDs or sequence numbers on tables that tests write to** (orders, customers, addresses). Assert relative to what you created: "the order I just placed is in my list", not "the list has 1 order". `FM-FLAKE-02` (`FM-100001`) shows what goes wrong.
- **Don't rely on test order.** No `@TestMethodOrder` / `@Order` to pass state between tests. Each test sets up its own preconditions.
- Read-only seed data in `src/test/resources/data.sql` (chefs, dishes, tags, admin) is stable. Assertions against it are fine (for example, "chef 1 has 2 active dishes").
  - When you add rows, use IDs that don't collide, and don't change existing rows that other tests count on.
  - A new entity field that tests need must get values in `data.sql`, because H2's schema comes from the entities, not from Flyway.
- H2 in Postgres mode isn't Postgres. A query using native SQL or Postgres-only functions can pass here and fail in production, or the reverse. When a test fails only on H2, prefer rewriting the query in JPQL or as a derived query over special-casing the test.
- Don't use `@DirtiesContext` to clean up. It rebuilds the Spring context and makes the suite much slower. Use unique data instead.

## Auth in tests

- **Customer:** register through `POST /api/auth/register` with a unique email and read `token` from the response (see `customerToken()` in `OrderControllerTest`).
- **Admin:** `POST /admin/auth/login` with `admin` / `admin123`. `data.sql` seeds the same password hash as `V1__init.sql`. There are no admin endpoint tests yet, so add a shared `adminToken()` helper when you write the first ones.
- Send tokens as `.header("Authorization", "Bearer " + token)`. Prefer real tokens over `@WithMockUser`, so the JWT filter and role mapping are tested too.
- For every protected endpoint, cover no token (401) and the wrong role (403, for example a customer token on a customer-only path, or on an admin path once it checks roles).

## What to assert

For each endpoint, cover:
- the happy path
- validation failures: 400, with `jsonPath("$.message")` equal to the exact user-facing message
- not found: 404
- auth (above)
- business-rule rejections (`BadRequestException` messages such as "Only CASH payment is supported")

How to assert:
- Check `status()` first, then specific fields with `jsonPath`. Don't compare whole JSON strings, because unrelated new fields would break the test.
- **Order:** assert positions only when the endpoint defines an order (for example, `priority_index`). Otherwise use `hasItem(...)` or a `jsonPath` filter. `FM-FLAKE-03` asserts `[0]` on an order the endpoint doesn't guarantee.
- **Time:** never compare with `LocalDate.now()` or the local clock (`FM-FLAKE-04`). Production sets Hibernate to UTC, the test profile doesn't, and the date can roll over during a run. Assert that the value parses and lies within a window around the request, or check only the fields that matter.
- **Numbers:** prices are `Double`, so compare with a tolerance or against values computed from seed data, not hand-rounded literals.
- **Request bodies:** build them with `objectMapper.writeValueAsString(...)` from a `Map` or DTO, not hand-written JSON strings. `Map.of` takes at most 10 pairs and throws on duplicate keys, so use `Map.ofEntries` or a `LinkedHashMap` for larger payloads.

## Seeded bugs and flakes

- Don't fix, reorder or "stabilise" `FM-FLAKE-NN` tests unless the task is that flake. Don't copy their patterns.
- **If a new test fails because of a seeded `FM-BUG-NN`,** assert the correct behaviour and mark it `@Disabled("Blocked by FM-BUG-NN: <one line>")`. Don't weaken the assertion to match the bug. The `qase-sync` skill reports disabled tests, so the link stays visible.

## Before you commit

- `gradle/wrapper/gradle-wrapper.jar` is not in the repo, so `./gradlew` doesn't run locally or in CI until it's restored. Use a local Gradle install (`gradle test`), or restore the wrapper in a separate `chore/` PR.
- Run the new or changed class several times (`--tests '<Class>'`) and then the full suite. A test that passes alone but fails in the full run depends on shared data or order.
- Check the test fails for the right reason: break the expectation once, or run it against the bug it covers, and confirm the failure message points at the problem.

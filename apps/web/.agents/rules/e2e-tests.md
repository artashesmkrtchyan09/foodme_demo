---
paths:
  - "e2e/**"
  - "apps/web/e2e/**"
  - "playwright.config.ts"
  - "apps/web/playwright.config.ts"
---

# Web E2E tests (`e2e/`): structure, data and stability

Applies to every Playwright spec and helper in `apps/web/e2e/`, new or changed. How to pick locators and wait for state is covered by `e2e-locators-and-waits.md` next to this file. The commands and environment variables are in *Commands* in `apps/web/AGENTS.md`. Seeded `FM-BUG`/`FM-FLAKE` code is described in the root `AGENTS.md`.

## What belongs in the web suite

- **User flows through the storefront**, driven through the UI, against the real backend: browse → chef → dish → cart → checkout → tracking, sign-up and sign-in, order history, and layout of key pages.
- **Not here:**
  - API contract details (every validation message, status code or auth case). Those belong in backend tests.
  - Back-office behaviour. That belongs in the admin suite.
  - The existing `happy-path.spec.ts` › "admin can login…" test calls the admin API directly. Don't add more cross-app tests here.
- There are no frontend unit tests, so an E2E test is the only check for UI logic (cart rules, form validation, redirects). Cover the edge cases that matter to users, not every branch.

## Files and naming

- Group specs by area: `storefront-flows.spec.ts`, `layout.spec.ts`, `happy-path.spec.ts`. Add to the matching spec, or create `<area>.spec.ts` when a new area has several tests.
- `flake-*.spec.ts` names are reserved for seeded `FM-FLAKE` cases. Never give a normal spec that name.
- Wrap tests in `test.describe("<Area>")`.
- Write titles as user-visible behaviour in plain words: `"cart quantity increase and remove item"`, `"takeaway checkout succeeds without address"`. Don't use internal names.
- Link the test to its Qase case with `// qase: <id>` on the line above `test(...)` (see the `qase-sync` skill).
- Put shared helpers in `e2e/<topic>.ts` (`auth.ts` for customers). A helper used by only one spec can sit at the top of that spec (like `addFirstDishToCart`). There's no page-object layer, so keep helpers as small functions that return what the test needs, such as `{ email, password }` or a scoped locator.

## Test data

- **Each test creates its own data.** Register a fresh customer per test with `registerCustomerViaApi` (fast, through the API) or `createAccountAtCheckout` (when sign-up itself is under test). Both generate unique emails. Never share accounts or orders between tests.
- **Set up preconditions through the API, and do in the UI only the behaviour under test.** For example, register through the API when the test is about order history, not about sign-up.
- Use one API base: `const API = process.env.VITE_API_BASE_URL || "http://localhost:8081"`, as in `happy-path.spec.ts`. `layout.spec.ts` hard-codes the URL; don't copy that.
- **The backend data is a real, long-lived Postgres database, seeded by migrations, that grows with every run.**
  - Don't assert exact totals, counts or "first item" on lists other runs add to (orders, customers).
  - Prefer finding chefs and dishes through the API (`/api/chef/active`, `/api/chef/{id}`) over hard-coding names or IDs, because seed data may change.
- Cart state (IndexedDB) and auth (localStorage) are per browser context, so each test starts with an empty cart and signed out. Don't rely on state left by another test.

## Isolation and stability

- The web suite runs `fullyParallel`, so any test can run alongside any other. Tests must not depend on order, timing or shared records.
- CI retries failed tests twice and records a trace on the first retry. **A test that passes only on retry is flaky. Fix the cause; don't count on retries.**
- Never commit `test.only`, because CI fails on it (`forbidOnly`). `test.skip` and `test.fixme` need a reason in the call, for example `test.fixme(true, "Blocked by FM-BUG-NN: …")`.
- Don't raise timeouts, add retries in the test body, or catch and ignore errors to make a test pass. See `e2e-locators-and-waits.md` for waiting correctly.

## Assertions

- Assert the outcome a user would notice: the URL, a heading, a confirmation message, the cart contents, totals. Make at least one assertion after the final action.
- Assert in the test body. Helpers may assert only their own preconditions (like `auth.ts` checking that sign-in worked).
- For money, assert the formatted text the user sees (for example `"5,400 AMD"`), or compute the expected value from data fetched in the test. Don't hard-code totals that depend on seed prices.

## Seeded bugs

- **If a new test hits a seeded `FM-BUG-NN`,** assert the correct behaviour and mark the test `test.fail(true, "FM-BUG-NN: <one line>")`. It then passes while the bug exists and fails when the bug is fixed, which flags it. Don't weaken the assertion to fit the bug the way `layout.spec.ts` does for `FM-BUG-02`.

## Before you commit

- Run the new or changed test several times to check it's stable: `npx playwright test <file> -g "<title>" --repeat-each=5`. Then run the whole web suite.
- Make sure it fails for the right reason: break the expectation once and check the error points at the problem.
- Don't commit `test-results/`, `playwright-report/` or traces. They're gitignored, so attach them to the PR or bug report instead.

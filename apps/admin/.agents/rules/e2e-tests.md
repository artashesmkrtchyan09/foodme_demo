---
paths:
  - "e2e/**"
  - "apps/admin/e2e/**"
  - "playwright.config.ts"
  - "apps/admin/playwright.config.ts"
---

# Admin E2E tests (`e2e/`): structure, data and stability

Applies to every Playwright spec and helper in `apps/admin/e2e/`, new or changed. How to pick locators and wait for state is covered by `e2e-locators-and-waits.md` next to this file. The commands, credentials and environment variables are in *Commands* in `apps/admin/AGENTS.md`. Seeded `FM-BUG`/`FM-FLAKE` code is described in the root `AGENTS.md`.

## What belongs in the admin suite

- **Back-office flows through the UI**, against the real backend: sign-in, lists and filters, show and edit pages, order status changes, and navigation.
- **Not here:**
  - Storefront behaviour. That belongs in the web suite.
  - API contract details (every validation message or auth case). Those belong in backend tests.
  - Set up storefront data, like orders, through the public API instead of driving the storefront UI.

## Files and naming

- `admin-flows.spec.ts` holds the current tests in `test.describe` blocks per area ("Admin auth", "Admin resources"). Add to the matching block. For a large new feature, create `e2e/<area>.spec.ts`.
- Write titles as behaviour in plain words: `"order show + mark ACCEPTED"`, `"rejects bad password"`.
- Link the test to its Qase case with `// qase: <id>` on the line above `test(...)` (see the `qase-sync` skill).
- `loginAsAdmin` and `createOrderViaApi` live at the top of `admin-flows.spec.ts`. When a second spec needs them, move them to `e2e/helpers.ts` and import them in both specs; don't copy them.
- Use one API base: `const API = process.env.VITE_API_BASE_URL || "http://localhost:8081"`, as the spec does.

## Test data

- **Create what the test needs through the public API.** Use `createOrderViaApi`, which registers a unique customer and places an order. Then find that record by its unique value (the order `number`), not by its position in a list.
- **Chefs and dishes can't be created (there's no create endpoint), so edit tests change shared seed records.** These are the same records the storefront suite and other runs use. So:
  - Prefer tests that open the edit form and check it without saving.
  - If a test must save, change one harmless field and put the original value back at the end, ideally through the API in a `finally`.
  - Never change `status`, prices or anything the storefront suite relies on.
  - Saving an edit sends the whole record to the backend, which may clear translated fields (see `admin-feature-development.md`). Check that before writing a test that saves.
- Order status changes are permanent, so always use a fresh order from `createOrderViaApi`, never a seeded or listed one.
- The database is long-lived and grows with every run. Don't assert totals, row counts or "first row is X". Lists are sorted on the client and paginated, so a new record may not be on page 1. After creating a record, click **Refresh** and search for it by its unique value, as the existing tests do.
- Sign in through the UI with `loginAsAdmin` (in `beforeEach` for resource tests). Auth is stored per browser context, so every test starts signed out.

## Isolation and stability

- The admin suite runs serially (`fullyParallel: false`) because tests share the one admin account and seed records. Still write each test so it passes alone and in any order. Don't pass state between tests.
- CI retries failed tests once and records a trace on the first retry. **A test that passes only on retry is flaky. Fix the cause.**
- Never commit `test.only` (`forbidOnly` fails CI). `test.skip` and `test.fixme` need a reason in the call.
- Several existing assertions use explicit timeouts of 10–15 s for lists that load slowly under simulated latency. Don't raise them further to make a test pass. Find what the test is really waiting for (see `e2e-locators-and-waits.md`).
- Navigate with hash URLs (`/#/orders`, `/#/orders/<id>/show`).

## Assertions

- Assert what the operator sees: the URL, the page heading, the success notification text ("Order status updated"), the changed field or status chip.
- Assert in the test body. Helpers may check only their own preconditions (like `createOrderViaApi` checking the API call succeeded).
- For status changes, assert both the notification and the new status on the page, and only use transitions the backend allows (`constants/OrderStatus.jsx`).

## Seeded bugs

- Don't change `OrderShow.jsx` around `FM-BUG-08` unless that's the task. Seeded flakes are covered in `e2e-locators-and-waits.md`.
- **If a new test hits a seeded `FM-BUG-NN`,** assert the correct behaviour and mark the test `test.fail(true, "FM-BUG-NN: <one line>")`. Don't weaken the assertion.

## Before you commit

- Run the new or changed test several times: `npx playwright test -g "<title>" --repeat-each=5`. Then run the whole admin suite, or `npm run test:e2e:all` from `apps/web` if storefront data could be affected.
- Make sure it fails for the right reason: break the expectation once and check the error points at the problem.
- Don't commit `test-results/`, `playwright-report/` or traces.

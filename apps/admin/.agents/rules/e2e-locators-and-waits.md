---
paths:
  - "e2e/**"
  - "apps/admin/e2e/**"
---

# E2E tests: locators and waits (admin)

Applies to every Playwright spec and helper in `apps/admin/e2e/` — new tests and any test you change.

## Locators

Pick the first option that works, in this order:

1. **User-facing locators** — what a user sees or a screen reader announces. react-admin/MUI components expose good roles and labels:
   - `page.getByRole("button", { name: "Save" })`, `getByRole("link", { name: "Orders" })` (sidebar menu), `getByRole("heading" | "row" | "cell" | "columnheader" | "combobox" | "option", { name })`
   - `page.getByLabel("Username")` / `getByLabel("Password")` for inputs (MUI `TextInput` labels)
   - `page.getByText(...)`, `page.getByTitle(...)`
2. **Test IDs** — `page.getByTestId("order-status")` (Playwright's default `data-testid` attribute) when there is no stable user-facing handle. Add the `data-testid` to the component in `src/` as part of the same change; use kebab-case names.
3. **CSS / class selectors** — last resort only, with a comment explaining why 1 and 2 don't work.

Rules:
- Never select by MUI's generated classes (`.MuiButton-root`, `.css-1x2y3z`), `RaDatagrid-*` internals, XPath or DOM structure. They change between library versions.
- Scope instead of indexing:
  - Rows: `page.getByRole("row", { name: /FM-100001/ }).getByRole("link", { name: "Show" })`.
  - Dialogs and toasts: `page.getByRole("dialog")`, `page.getByRole("alert")`.
  - Avoid `.nth()` / `.first()` unless the order itself is what's being tested.
- Use exact names (`{ exact: true }`) or regexes when text could match more than one element, e.g. "Orders" in both the menu and the page title.
- Order status labels come from `src/constants/OrderStatus.jsx`. Use those labels, not raw enum values.
- Navigation uses the hash router (`/#/orders`). Assert with `await expect(page).toHaveURL(/#\/orders/)`.

## Waits

- **No hard-coded waits:** never use `page.waitForTimeout()`, `setTimeout`/sleep helpers, or fixed delays inside loops.
- **No implicit/blind waits:** no `waitForLoadState("networkidle")`, and no raising timeouts to make a test pass.
- **Wait for the state you need, using auto-waiting:**
  - Use web-first assertions, which retry: `await expect(locator).toBeVisible()`, `.toHaveText()`, `.toHaveCount()`, `.toBeEnabled()`, `await expect(page).toHaveURL(...)`.
  - Actions (`click`, `fill`, `selectOption`) already wait for the element to be actionable. Don't add a wait before them.
  - react-admin loads lists asynchronously and shows a loading state first. Wait for real content, e.g. `await expect(page.getByRole("row").nth(1)).toBeVisible()` or a specific row, not for time.
  - After a save, react-admin shows a notification. Wait for it with `await expect(page.getByRole("alert")).toContainText(...)`, or wait for the updated value in the page.
  - For a specific request, use `page.waitForResponse(r => r.url().includes("/admin/order") && r.ok())`, started *before* the action that triggers it.
  - For a non-DOM condition, use `await expect.poll(() => …).toBe(…)` or `expect(async () => { … }).toPass()`.
- **Don't snapshot state with a one-time check:** `expect(await locator.isVisible()).toBe(true)` and `expect(await locator.textContent())…` read the page once and don't retry. Use the web-first assertion instead.
- The backend adds 200–1500 ms of simulated latency to every API call (`SimulatedLatencyConfig`). Tests must pass with it, which works only if they wait for UI or network state rather than for time.

## Seeded flakes

Tests marked `FM-FLAKE-NN` are flaky on purpose. Don't fix them or "improve" them unless the task is explicitly about that flake. Don't copy their patterns into other tests.

# E2E tests: locators and waits (web)

Applies to every Playwright spec and helper in `apps/web/e2e/` — new tests and any test you change.

## Locators

Pick the first option that works, in this order:

1. **User-facing locators** — what a user sees or a screen reader announces:
   - `page.getByRole("button", { name: "Add to cart" })`, `getByRole("link" | "heading" | "dialog" | "radio" | "textbox", { name })`
   - `page.getByLabel("Phone")` for form fields
   - `page.getByPlaceholder(...)`, `page.getByText(...)`, `page.getByAltText(...)`, `page.getByTitle(...)`
2. **Test IDs** — `page.getByTestId("cart-total")` (Playwright's default `data-testid` attribute) when there is no stable user-facing handle (repeated cards, totals, icon-only containers). Add the `data-testid` to the component in `src/` as part of the same change; use kebab-case names.
3. **CSS / class selectors** — last resort only, with a comment explaining why 1 and 2 don't work.

Rules:
- Scope instead of indexing: `page.getByRole("form", { name: "Checkout" }).getByLabel("Email")` or `cartPanel.getByRole("link", { name: "Go to checkout" })`. Avoid `.nth()` / `.first()` unless the order itself is what's being tested.
- Never use XPath, generated class names, DOM structure (`div > div:nth-child(2)`) or Tailwind utility classes.
- Use exact names (`{ name: "Add to cart", exact: true }`) or regexes when text could match more than one element.
- Text comes from `src/locales/en/translation.json` — copy it from there rather than retyping it.
- **Legacy class locators:** many existing specs use the prefixed class names (`a.cc_card`, `button.dc_card`, `aside.uc-panel`, `.cic_root`). Don't add new ones. When you edit a test that uses them, switch to a role/label/test-id locator if it's straightforward. Keep the class names in the markup either way, because other specs still depend on them.
- If an element has no accessible name, fix the component (e.g. `aria-label` on an icon button) rather than falling back to CSS.

## Waits

- **No hard-coded waits:** never use `page.waitForTimeout()`, `setTimeout`/sleep helpers, or fixed delays inside loops.
- **No implicit/blind waits:** no `waitForLoadState("networkidle")`, and no raising timeouts to make a test pass.
- **Wait for the state you need, using auto-waiting:**
  - Use web-first assertions, which retry: `await expect(locator).toBeVisible()`, `.toHaveText()`, `.toHaveCount(2)`, `.toBeEnabled()`, `await expect(page).toHaveURL(/\/checkout/)`.
  - Actions (`click`, `fill`, `check`) already wait for the element to be actionable. Don't add a wait before them.
  - For a specific request, use `page.waitForResponse(r => r.url().includes("/api/order") && r.ok())`, started *before* the action that triggers it.
  - For a non-DOM condition, use `await expect.poll(() => …).toBe(…)` or `expect(async () => { … }).toPass()`.
- **Don't snapshot state with a one-time check:** `expect(await locator.isVisible()).toBe(true)` and `expect(await locator.textContent())…` read the page once and don't retry. Use the web-first assertion instead.
- The backend adds 200–1500 ms of simulated latency to every API call (`SimulatedLatencyConfig`). Tests must pass with it, which works only if they wait for UI or network state rather than for time.

## Seeded flakes

Specs named `flake-*.spec.ts` contain intentional `FM-FLAKE-NN` problems (e.g. the `waitForTimeout(300)` in `flake-dish-modal.spec.ts` is `FM-FLAKE-01`). Don't fix them or "improve" them unless the task is explicitly about that flake. Don't copy their patterns into other tests.

# AC-WEB-01 — Explore page lists every active chef

| | |
|---|---|
| **App** | Web (storefront) |
| **Area** | Home / Explore |
| **Priority** | High |
| **Depends on** | Backend: `GET /api/chef` (active chefs, paginated) |
| **Existing automated tests** | `apps/web/e2e/layout.spec.ts` — "Home page structure and sections", "Explore page layout"; `apps/web/e2e/storefront-flows.spec.ts` — "home CTA navigates to explore and header Explore chefs works", "chef page from home popular section" |

**User story:** As a customer, I want to see every kitchen that is currently open, so that I can choose where to order from.

## Acceptance criteria

1. **Given** the database has N chefs with status `ACTIVE`, **when** I open `/explore` and scroll or paginate through all results, **then** exactly N chef cards are shown, each chef appears once, and the shown count matches the total the page reports.
2. **Given** a chef has status `INACTIVE`, **when** I open `/explore` or the home page, **then** that chef is not shown anywhere.
3. **Given** I am on the last page of results, **when** the page loads, **then** it still shows every remaining active chef. No chef is dropped from the final page.
4. **Given** I am on the home page, **when** I click the main call to action or "Explore chefs" in the header, **then** I land on `/explore`.
5. **Given** I am on `/explore` or in the home "popular" section, **when** I click a chef card, **then** I land on `/chef/<id>` for that chef and see their name and active dishes.
6. **Given** I open `/chef/<id>` for an id that doesn't exist or is inactive, **when** the page loads, **then** a "Chef not found" message is shown instead of a menu.

## Test data / notes
- The test seed has 6 `ACTIVE` chefs. Compare the UI against `GET /api/chef?page=0&size=100`, or against the database.
- Check with a page size that puts exactly one chef on the last page, as well as with a page size that holds everything.

## Out of scope
- Search and filtering by cuisine tags.

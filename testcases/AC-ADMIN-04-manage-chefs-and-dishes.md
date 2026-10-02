# AC-ADMIN-04 — Manage chefs and dishes

| | |
|---|---|
| **App** | Admin (back office) |
| **Area** | Chefs / Dishes |
| **Priority** | High |
| **Depends on** | Backend: `/admin/chef`, `/admin/dish`; Web: changes visible in the storefront (AC-WEB-01, AC-WEB-02) |
| **Existing automated tests** | `apps/admin/e2e/admin-flows.spec.ts` — "chefs list loads and opens edit", "dishes list loads and opens edit" |

**User story:** As an admin, I want to edit chefs and their dishes, so that the storefront shows correct menus, prices and availability.

## Acceptance criteria

1. **Given** I open Chefs, **when** the list loads, **then** I see each chef's id, username, phone, rating, status, delivery price and "free delivery from" amount (in AMD). The search box filters the list.
2. **Given** I edit a chef, **when** I change the phone, status, rating (0–5), delivery price or free-delivery threshold and save, **then** I see a success notification and the list shows the new values.
3. **Given** I set a chef's status to `INACTIVE`, **when** a customer opens the storefront, **then** that chef no longer appears on Explore or the home page. Setting the chef back to `ACTIVE` makes them appear again.
4. **Given** I open Dishes, **when** the list loads, **then** I see each dish's id, name, chef id, price (AMD), status and priority. I can filter by text and by chef id.
5. **Given** I edit a dish, **when** I change the name, description, portion, price, minimum order count, priority or status and save, **then** the change is saved. The chef id is read-only.
6. **Given** I change a dish's price or minimum order count, **when** a customer adds it to the cart, **then** the new price and minimum quantity are used.
7. **Given** I enter invalid values (a negative price, a minimum order count below 1, or a rating outside 0–5), **when** I save, **then** the save is refused with a clear error and the stored values don't change.

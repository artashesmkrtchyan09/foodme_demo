# AC-WEB-02 — Add a dish with additions to the cart

| | |
|---|---|
| **App** | Web (storefront) |
| **Area** | Chef page / dish modal / cart |
| **Priority** | High |
| **Depends on** | Backend: `GET /api/chef/{id}`, `GET /api/dish/...` |
| **Existing automated tests** | `apps/web/e2e/happy-path.spec.ts` — "dish modal additions raise cart line price"; `apps/web/e2e/flake-dish-modal.spec.ts` — "dish modal opens and dish can be added to cart" |

**User story:** As a customer, I want to customise a dish with additions and add it to my cart, so that I order exactly what I want and see the right price.

## Acceptance criteria

1. **Given** I am on a chef page, **when** I click a dish card, **then** a dish dialog opens showing the dish name, description, portion, price, any available additions and a quantity selector.
2. **Given** the dish dialog is open, **when** I select one or more additions, **then** the price shown in the dialog increases by the sum of the selected additions' prices.
3. **Given** I selected additions and a quantity Q, **when** I click "Add to cart", **then** the cart shows one line for that dish whose unit price is (dish price + additions) and whose line total is (dish price + additions) × Q.
4. **Given** I add the same dish with the same additions again, **when** I look at the cart, **then** the existing line's quantity increases. No duplicate line is created.
5. **Given** I add the same dish with different additions, **when** I look at the cart, **then** it appears as a separate line.
6. **Given** a dish has a minimum order count M > 1, **when** I add it to the cart, **then** its quantity in the cart is at least M.
7. **Given** adding fails (for example, the network is down), **when** I click "Add to cart", **then** I see "Could not add this dish. Try again." and the cart is unchanged.

## Test data / notes
- Use a seeded dish that has at least two priced additions, and one dish with `minimumOrderCount` > 1.

## Out of scope
- Server-side price calculation (see AC-API-01).

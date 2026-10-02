# AC-WEB-04 — Cart quantity controls and persistence

| | |
|---|---|
| **App** | Web (storefront) |
| **Area** | Cart |
| **Priority** | High |
| **Depends on** | — (cart is stored in the browser, in IndexedDB) |
| **Existing automated tests** | `apps/web/e2e/storefront-flows.spec.ts` — "cart quantity increase and remove item"; `apps/web/e2e/flake-cart-persistence.spec.ts` — "cart item survives a page reload right after add-to-cart"; `apps/web/e2e/layout.spec.ts` — "cart and checkout item details stay aligned" |

**User story:** As a customer, I want to change quantities in my cart and keep my cart when I reload or come back later, so that I don't lose my selection.

## Acceptance criteria

1. **Given** a cart line with quantity Q, **when** I click "Increase quantity", **then** the quantity becomes Q + 1 and the line total and cart subtotal update.
2. **Given** a cart line with minimum order count M and quantity Q > M, **when** I click "Decrease quantity", **then** the quantity becomes Q − 1 and the line stays in the cart. For example, with M = 1, going from 2 to 1 keeps the line with quantity 1.
3. **Given** a cart line whose quantity equals its minimum order count M, **when** I click "Decrease quantity", **then** the line is removed from the cart. The quantity never goes below M.
4. **Given** a cart line, **when** I click "Remove item", **then** the line is removed and the subtotal updates. When the last line is removed, the empty-cart state ("Add dishes from the menu") is shown.
5. **Given** I added dishes to the cart, **when** I reload the page right after adding, or close and reopen the browser tab, **then** the cart still contains the same lines and quantities.
6. **Given** the cart has items, **when** I open the checkout, **then** the dish names, additions, quantities and prices there match the cart.

## Test data / notes
- Check decreasing for both a dish with minimum order count 1 and one with a higher minimum.

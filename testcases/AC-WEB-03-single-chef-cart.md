# AC-WEB-03 — Cart holds dishes from one chef only

| | |
|---|---|
| **App** | Web (storefront) |
| **Area** | Cart |
| **Priority** | High |
| **Depends on** | — (cart is stored in the browser, in IndexedDB) |
| **Existing automated tests** | `apps/web/e2e/storefront-flows.spec.ts` — "missing chef does not ask to clear another chef's cart" |

**User story:** As a customer, I want my cart to contain food from a single kitchen, so that one order is delivered by one chef.

## Acceptance criteria

1. **Given** my cart has dishes from chef A, **when** I try to add a dish from chef B, **then** I see a "Cart has another kitchen" prompt and nothing is added yet.
2. **Given** the "Cart has another kitchen" prompt is shown, **when** I choose to replace the cart, **then** chef A's dishes are removed and only chef B's dish is in the cart.
3. **Given** the prompt is shown, **when** I choose "Go to current cart" or close it, **then** the cart still contains only chef A's dishes, unchanged.
4. **Given** my cart has dishes from chef A, **when** I open a chef page that doesn't exist, **then** I am not asked to clear my cart and the cart is unchanged.
5. **Given** my cart is empty, **when** I add a dish from any chef, **then** no prompt is shown.

## Test data / notes
- Use two different active chefs from the seed.

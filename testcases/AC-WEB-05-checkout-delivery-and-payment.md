# AC-WEB-05 — Checkout: delivery method, validation and payment

| | |
|---|---|
| **App** | Web (storefront) |
| **Area** | Checkout |
| **Priority** | Critical |
| **Depends on** | Backend: `POST /api/order`, delivery price endpoint; AC-WEB-06 (signed-in customer) |
| **Existing automated tests** | `apps/web/e2e/happy-path.spec.ts` — "explore -> chef -> add 2 dishes -> cart total -> cash checkout -> success", "takeaway checkout succeeds without address"; `apps/web/e2e/storefront-flows.spec.ts` — "empty checkout shows browse message", "delivery shows address fields; takeaway hides them", "payment methods are selectable visual options", "idram checkout still places a cash order", "full delivery checkout shows order number and track link", "failed order page renders recovery link" |

**User story:** As a customer, I want to choose delivery or takeaway, enter my details and place the order, so that I receive my food.

## Acceptance criteria

1. **Given** my cart is empty, **when** I open `/checkout`, **then** I see "Nothing to check out" with a link to browse chefs, and no order form.
2. **Given** I am not signed in, **when** I open the checkout with items in the cart, **then** I am asked to sign in or create an account before I can place the order.
3. **Given** I choose "Delivery", **when** the form is shown, **then** the address fields (City, Street, Building, Apartment) are visible, and City and Street are required.
4. **Given** I choose "Takeaway", **when** the form is shown, **then** the address fields are hidden and the order can be placed without an address. The delivery fee is 0.
5. **Given** I leave required fields empty or invalid, **when** I click "Place order", **then** no order is created and errors are shown next to the fields:
   - Full name: at least 2 characters.
   - Phone: at least 8 characters.
   - Email: must be a valid address.
   - City and Street: required for delivery.
6. **Given** the note is longer than 300 characters, **when** I submit, **then** a validation error is shown.
7. **Given** delivery is selected, **when** the checkout loads, **then** it shows the subtotal, the chef's delivery fee (or "Free" when the free-delivery threshold is reached, see AC-API-02) and a total equal to subtotal + delivery fee.
8. **Given** the payment options "Cash on delivery", "Bank card" and "Idram", **when** I select any of them and place the order, **then** the order is created with payment type `CASH`. Online payment isn't supported yet.
9. **Given** valid data, **when** I click "Place order", **then** I land on `/orders/success`, which shows the order number (format `FM-<number>`) and a link to track the order, and the cart is cleared.
10. **Given** the backend rejects the order, **when** I place it, **then** I land on `/orders/failed` with "We could not place your order. Please try again." and a recovery link, and my cart is kept.

## Test data / notes
- Use a test phone number such as `+37491234567` and a unique email per run.

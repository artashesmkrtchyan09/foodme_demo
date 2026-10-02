# AC-API-02 — Delivery fee and free-delivery threshold

| | |
|---|---|
| **App** | Backend API |
| **Area** | Delivery price calculation, order creation |
| **Priority** | High |
| **Depends on** | Chef settings `deliveryPrice` and `freeDeliveryFrom` (editable in Admin, AC-ADMIN-04); shown in Web checkout (AC-WEB-05) |
| **Existing automated tests** | None |

**User story:** As a customer, I want free delivery once my order reaches the chef's threshold, so that I get the advertised deal.

## Acceptance criteria

1. **Given** a chef with delivery price D and free delivery from F, **when** the delivery price is requested for a delivery order with subtotal S < F, **then** the delivery price is D.
2. **Given** the same chef, **when** S is exactly F, **then** the delivery price is 0. "Free delivery from F" includes F itself.
3. **Given** the same chef, **when** S > F, **then** the delivery price is 0.
4. **Given** a chef with no free-delivery threshold, **when** any subtotal is requested, **then** the delivery price is always D.
5. **Given** a takeaway order, **when** the delivery price is requested, **then** it is 0, whatever the subtotal is.
6. **Given** an unknown chef id, **when** the delivery price is requested, **then** the API returns 404 with a "Chef … not found" message.
7. **Given** the checkout page and the created order, **when** they're compared, **then** both use the same delivery price for the same cart.

## Test data / notes
- Boundary values: F − 1, F and F + 1 (also F − 0.01 if prices can have decimals).

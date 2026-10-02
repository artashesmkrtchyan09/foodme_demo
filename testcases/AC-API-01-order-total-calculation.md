# AC-API-01 — Order total is calculated correctly

| | |
|---|---|
| **App** | Backend API |
| **Area** | Orders — `POST /api/order` |
| **Priority** | Critical |
| **Depends on** | Seed data (chefs, dishes, additions); used by Web checkout (AC-WEB-05) and Admin orders (AC-ADMIN-02/03) |
| **Existing automated tests** | `apps/backend/.../OrderControllerTest.java` — `createOrder_cashPayment_succeeds` |

**User story:** As a customer, I want to be charged exactly what the storefront showed me, so that I trust the price.

## Acceptance criteria

1. **Given** an order with lines of (dish price P, additions A, quantity Q), **when** it is created, **then** the subtotal is the sum over all lines of (P + A) × Q. Additions are charged per unit, not once per line.
2. **Given** prices with decimals, **when** the subtotal is calculated, **then** no rounding or truncation happens per line. The total matches the storefront's cart and checkout total to the smallest currency unit.
3. **Given** a delivery order, **when** it is created, **then** `totalPrice = subtotal + deliveryPrice`, using the delivery rules in AC-API-02. **Given** a takeaway order, **then** `deliveryPrice = 0` and `totalPrice = subtotal`.
4. **Given** an order is created, **when** I read it through `GET /api/order/{number}` or the admin API, **then** the stored line prices, quantities, additions, delivery price and total equal the values returned at creation.
5. **Given** a dish's price changes after the order was placed, **when** I read the old order, **then** it still shows the price at the time of ordering.

## Test data / notes
- Include cases with quantity > 1 plus additions, a dish with a decimal price, and several lines in one order.

# AC-API-04 — Order number and creation time

| | |
|---|---|
| **App** | Backend API |
| **Area** | Orders |
| **Priority** | Medium |
| **Depends on** | Shown in Web (success page, order history, tracking) and Admin (orders list/details) |
| **Existing automated tests** | `apps/backend/.../OrderControllerTest.java` — `createOrder_firstOrderGetsNumber100001`, `getOrderByNumber_firstOrderIsFm100001`, `createOrder_createdAtFallsOnToday` |

**User story:** As a customer and as an admin, I want every order to have a unique, readable number and a correct creation time, so that orders can be referenced and sorted reliably.

## Acceptance criteria

1. **Given** a fresh database, **when** the first order is created, **then** its number is `FM-100001`. Each following order gets the next number (`FM-100002`, …).
2. **Given** many orders are created at the same time, **when** they are saved, **then** every order number is unique and no number is reused.
3. **Given** an order number, **when** `GET /api/order/{number}` is called, **then** that order is returned. **Given** an unknown number, **then** it returns 404 "Order … not found".
4. **Given** an order is created, **when** its `createdAt` is returned by the API, **then** it is the actual creation instant, in a format that includes the time zone or offset (e.g. ISO-8601 with `Z` or `+04:00`).
5. **Given** an order is created close to midnight, **when** its date is shown in the storefront and back office, **then** it is shown on the correct calendar day for the viewer's time zone.
6. **Given** a customer's orders, **when** `GET /api/customer/orders` is called, **then** they are sorted by `createdAt`, newest first.

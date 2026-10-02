# AC-API-03 — Order request validation

| | |
|---|---|
| **App** | Backend API |
| **Area** | Orders — `POST /api/order` |
| **Priority** | Critical |
| **Depends on** | Customer token (AC-API-05) |
| **Existing automated tests** | `apps/backend/.../OrderControllerTest.java` — `createOrder_nonCashPayment_rejectedWithBadRequest`, `createOrder_withoutToken_unauthorized` |

**User story:** As the business, I want the API to reject impossible orders, so that kitchens never receive orders that can't be fulfilled or priced correctly. The API must not rely only on the storefront's checks.

## Acceptance criteria

1. **Given** a payment type other than `CASH`, **when** an order is posted, **then** the API returns 400 "Only CASH payment is supported" and no order is created.
2. **Given** a line with quantity 0, a negative quantity or no quantity, **when** an order is posted, **then** the API returns 400 with a message naming the quantity, and no order is created.
3. **Given** a line with a quantity below the dish's minimum order count, **when** an order is posted, **then** the API returns 400.
4. **Given** a line with a dish that belongs to a different chef than the order's `chefId`, **when** an order is posted, **then** the API returns 400 and no order is created.
5. **Given** a line with a dish that is inactive or doesn't exist, **when** an order is posted, **then** the API returns 400 or 404 and no order is created.
6. **Given** an addition id that doesn't belong to the dish, **when** an order is posted, **then** the API rejects the request rather than silently ignoring the addition.
7. **Given** an empty dish list, **when** an order is posted, **then** the API returns 400.
8. **Given** delivery method `DELIVERY` and no address (or no city or street), **when** an order is posted, **then** the API returns 400.
9. **Given** any validation error, **when** the API responds, **then** the body is an `ErrorResponseDto` (`timestamp`, `status`, `error`, `message`, `path`) with a human-readable `message`, and no partial order or order number is used up.

# AC-ADMIN-03 — Order details and status changes

| | |
|---|---|
| **App** | Admin (back office) |
| **Area** | Orders |
| **Priority** | Critical |
| **Depends on** | Backend: `GET /admin/order/{id}`, status update endpoint; Web: tracking page (AC-WEB-06) |
| **Existing automated tests** | `apps/admin/e2e/admin-flows.spec.ts` — "order show + mark ACCEPTED" |

**User story:** As an admin, I want to see everything about an order and move it through its statuses, so that the kitchen and the customer know what is happening.

## Acceptance criteria

1. **Given** an order, **when** I open its details, **then** I see:
   - the number, status, creation date and time
   - the receiver's name, phone and email
   - the delivery method, plus the address when it is a delivery
   - the payment type and the note
   - each dish with its additions, quantity and price
   - the delivery fee and the total
2. **Given** an order with status `NEW`, **when** I view it, **then** only "Mark as ACCEPTED" and "Mark as REJECTED" are offered.
3. **Given** an order with status `ACCEPTED`, **when** I view it, **then** only "Mark as DELIVERED" and "Mark as REJECTED" are offered.
4. **Given** an order with status `DELIVERED` or `REJECTED`, **when** I view it, **then** no status change is offered. If one is attempted through the API, it is refused with 400 "Cannot transition order from X to Y".
5. **Given** I click "Mark as REJECTED", **when** the dialog opens, **then** I must enter a rejection reason. **When** I confirm, **then** the order becomes `REJECTED` and the reason is saved and shown.
6. **Given** a status change succeeds, **when** the API responds, **then** I see "Order status updated", the new status chip is shown, and the storefront tracking page shows the new status.
7. **Given** a status change fails, **when** the API responds with an error, **then** I see "Failed to update order status" and the status is unchanged.
8. **Given** a customer wrote a note containing HTML or a script (e.g. `<img src=x onerror=alert(1)>`), **when** I open the order, **then** the note is shown as plain text exactly as typed, and no HTML is rendered or script run.

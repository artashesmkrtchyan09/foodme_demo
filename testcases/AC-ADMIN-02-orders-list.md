# AC-ADMIN-02 — Orders list

| | |
|---|---|
| **App** | Admin (back office) |
| **Area** | Orders |
| **Priority** | High |
| **Depends on** | Backend: `GET /admin/order`; Web: orders placed in the storefront (AC-WEB-05) |
| **Existing automated tests** | `apps/admin/e2e/admin-flows.spec.ts` — "orders list shows rows after API order", "sidebar navigates between resources"; `apps/web/e2e/happy-path.spec.ts` — "admin can login and list orders after a storefront checkout" |

**User story:** As an admin, I want to see all incoming orders, so that I can process new ones quickly.

## Acceptance criteria

1. **Given** orders exist, **when** I open Orders, **then** I see a table with Number, Chef, Receiver, Total (in AMD), Status and Created date and time, newest orders first.
2. **Given** a customer has just placed an order in the storefront, **when** I open or refresh the Orders list, **then** the new order appears at the top with status `NEW` and the same number and total the customer saw.
3. **Given** the status filter, **when** I select a status (`NEW`, `ACCEPTED`, `DELIVERED`, `REJECTED`), **then** only orders with that status are listed and the total count updates.
4. **Given** more orders than one page holds, **when** I move between pages, **then** each order appears exactly once across all pages and the total count matches the number of orders.
5. **Given** an order was placed at a known local time, **when** I look at its Created value, **then** it shows that time correctly in my time zone, not shifted by the server's offset.
6. **Given** the list, **when** I click a row, **then** that order's details open (AC-ADMIN-03).

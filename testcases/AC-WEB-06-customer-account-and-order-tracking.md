# AC-WEB-06 — Customer account, order history and tracking

| | |
|---|---|
| **App** | Web (storefront) |
| **Area** | Register / Login / Orders / Tracking |
| **Priority** | High |
| **Depends on** | Backend: `/api/auth/*`, `/api/customer/*`, `GET /api/order/{number}` (AC-API-05) |
| **Existing automated tests** | `apps/web/e2e/storefront-flows.spec.ts` — "register from header opens orders history" |

**User story:** As a customer, I want an account where I can see my past orders and track the current one, so that I know where my food is.

## Acceptance criteria

1. **Given** I am signed out, **when** I register with a full name, a valid email, a phone number and a password of at least 8 characters, **then** I am signed in and taken to my order history (`/orders`).
2. **Given** an email is already registered, **when** I try to register with it again, **then** I see an error and no second account is created.
3. **Given** a registered account, **when** I sign in with the correct email and password, **then** I am signed in. **When** the password is wrong, **then** I see an error and stay signed out.
4. **Given** I open `/login?next=<path>`, **when** I sign in, **then** I am redirected to `<path>` if it is a path within the site. External URLs and `//host` values are ignored and I go to `/orders` instead.
5. **Given** I am signed in and have placed orders, **when** I open `/orders`, **then** I see only my own orders, newest first, each with its number, status, date and total.
6. **Given** I am signed in in one browser tab, **when** I sign out in another tab, **then** the first tab also shows me as signed out.
7. **Given** an existing order number, **when** I open `/tracking/<number>`, **then** I see the order's current status as a step tracker (New → Accepted → Delivered). A rejected order shows the "couldn't be fulfilled" message instead.
8. **Given** an order number that doesn't exist, **when** I open `/tracking/<number>`, **then** I see "Couldn't load this order" with advice to check the number.
9. **Given** an admin changes the order status (AC-ADMIN-03), **when** I reload the tracking page, **then** the new status is shown.

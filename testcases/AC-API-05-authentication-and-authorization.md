# AC-API-05 — Authentication and authorisation

| | |
|---|---|
| **App** | Backend API |
| **Area** | Customer auth (`/api/auth`, `/api/customer`), admin auth (`/admin/auth`), security rules |
| **Priority** | Critical |
| **Depends on** | Used by Web account pages (AC-WEB-06) and Admin login (AC-ADMIN-01) |
| **Existing automated tests** | `apps/backend/.../CustomerAuthControllerTest.java` — `register_returnsTokenAndProfile`, `register_duplicateEmail_rejected`, `login_withRegisteredAccount_succeeds`, `login_wrongPassword_rejected`, `meAndOrders_requireCustomerToken`; `OrderControllerTest.java` — `createOrder_withoutToken_unauthorized` |

**User story:** As the business, I want each API to be available only to the right users, so that customer data and back-office operations are protected.

## Acceptance criteria

1. **Given** valid registration data, **when** a customer registers, **then** the API returns a JWT and the customer profile. The password is never returned and is stored only as a hash.
2. **Given** an email that is already registered (case-insensitive, e.g. `Ann@x.com` vs `ann@x.com`), **when** someone registers with it, **then** the API returns an error and no duplicate account is created.
3. **Given** wrong credentials, **when** a customer or admin logs in, **then** the API returns 401 with a message that doesn't reveal whether the email or username exists.
4. **Given** no token or an invalid or expired token, **when** `/api/customer/**` or `POST /api/order` is called, **then** the API returns 401.
5. **Given** a customer token, **when** any `/admin/**` endpoint other than `/admin/auth/login` and `GET /admin/dish/**` is called, **then** the API returns 401 or 403.
6. **Given** an admin token, **when** admin endpoints are called, **then** they work. **Given** an admin token without a customer account, **when** `POST /api/order` is called, **then** the API refuses it.
7. **Given** customer A's token, **when** customer A requests their orders, **then** only A's orders are returned, never another customer's.
8. **Given** public endpoints (chefs, dishes, images, order tracking by number), **when** they are called without a token, **then** they work.

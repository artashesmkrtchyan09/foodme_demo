# AC-ADMIN-01 — Back office login and access control

| | |
|---|---|
| **App** | Admin (back office, `/backoffice`) |
| **Area** | Authentication |
| **Priority** | Critical |
| **Depends on** | Backend: `POST /admin/auth/login`, JWT-protected `/admin/**` (AC-API-05) |
| **Existing automated tests** | `apps/admin/e2e/admin-flows.spec.ts` — "rejects bad password", "logs in with seeded credentials" |

**User story:** As an admin, I want only authorised staff to get into the back office, so that orders and menus can't be changed by anyone else.

## Acceptance criteria

1. **Given** I am signed out, **when** I open any back-office page (e.g. `/backoffice/#/orders`), **then** I am redirected to the login page.
2. **Given** the seeded admin account (`admin` / `admin123`), **when** I sign in, **then** I land on the dashboard and the sidebar shows Orders, Chefs and Dishes.
3. **Given** a wrong password or unknown username, **when** I sign in, **then** an error notification is shown and I stay on the login page.
4. **Given** I am signed in, **when** my token expires or the API returns 401/403, **then** I am signed out and sent to the login page.
5. **Given** I am signed in, **when** I click log out, **then** I return to the login page, and using the browser's back button doesn't show protected data.
6. **Given** a customer account from the storefront, **when** its credentials are used on the back-office login, **then** login fails.

# FoodMe acceptance criteria

Acceptance criteria (ACs) for the three FoodMe apps, used as the source for test cases in Qase.

## Naming

`AC-<APP>-<NN>-<short-slug>.md`. The prefix says which app the AC belongs to:

| Prefix | App | Code |
|---|---|---|
| `AC-WEB-` | Customer storefront | `apps/web` |
| `AC-ADMIN-` | Back office (`/backoffice`) | `apps/admin` |
| `AC-API-` | Backend REST API | `apps/backend` |

Each file has a header table with the app, area, priority, **Depends on** (the other apps or ACs involved) and the **existing automated tests** that already cover parts of it. Scenarios are written as Given / When / Then. Each numbered scenario is meant to become one or more Qase test cases.

## Index

| ID | Title | Priority | Depends on |
|---|---|---|---|
| [AC-WEB-01](AC-WEB-01-explore-active-chefs.md) | Explore page lists every active chef | High | API |
| [AC-WEB-02](AC-WEB-02-add-dish-with-additions.md) | Add a dish with additions to the cart | High | API |
| [AC-WEB-03](AC-WEB-03-single-chef-cart.md) | Cart holds dishes from one chef only | High | — |
| [AC-WEB-04](AC-WEB-04-cart-quantity-and-persistence.md) | Cart quantity controls and persistence | High | — |
| [AC-WEB-05](AC-WEB-05-checkout-delivery-and-payment.md) | Checkout: delivery method, validation and payment | Critical | API, AC-WEB-06 |
| [AC-WEB-06](AC-WEB-06-customer-account-and-order-tracking.md) | Customer account, order history and tracking | High | API, AC-ADMIN-03 |
| [AC-ADMIN-01](AC-ADMIN-01-login-and-access.md) | Back office login and access control | Critical | API |
| [AC-ADMIN-02](AC-ADMIN-02-orders-list.md) | Orders list | High | API, AC-WEB-05 |
| [AC-ADMIN-03](AC-ADMIN-03-order-details-and-status.md) | Order details and status changes | Critical | API, AC-WEB-06 |
| [AC-ADMIN-04](AC-ADMIN-04-manage-chefs-and-dishes.md) | Manage chefs and dishes | High | API, AC-WEB-01/02 |
| [AC-API-01](AC-API-01-order-total-calculation.md) | Order total is calculated correctly | Critical | AC-API-02 |
| [AC-API-02](AC-API-02-delivery-fee-rules.md) | Delivery fee and free-delivery threshold | High | — |
| [AC-API-03](AC-API-03-order-request-validation.md) | Order request validation | Critical | AC-API-05 |
| [AC-API-04](AC-API-04-order-number-and-timestamps.md) | Order number and creation time | Medium | — |
| [AC-API-05](AC-API-05-authentication-and-authorization.md) | Authentication and authorisation | Critical | — |

## Moving to Qase

- Suggested structure: one root suite per app (`Web`, `Admin`, `Backend`), and one sub-suite per AC (e.g. `Web › AC-WEB-05 Checkout`).
- Use one case per numbered scenario, titled `AC-WEB-05.3 — Delivery shows required address fields`. The Given goes into preconditions, the When into steps, and the Then into the expected result.
- Mark cases already covered by the tests listed in the header as *automated*, and link them with the `qase-sync` skill.
- The ACs describe **intended** behaviour. Where the current app behaves differently, the test case should fail and a bug should be reported (see the `bug-report` skill and its `.agents/skills/bug-report/template.md`).

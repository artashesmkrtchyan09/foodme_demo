# Admin back office: architecture and adding features

Applies to every change in `apps/admin`. This rule covers how the parts fit together and the steps for adding a feature. It doesn't repeat the other files:
- Root `AGENTS.md`: seeded `FM-BUG`/`FM-FLAKE` code, demo behaviour (`flakyHeartbeat`), deployment under `/backoffice` and the API base URL.
- `apps/admin/AGENTS.md`: commands, E2E setup, and the structure of resources, routing, data provider, auth, HTTP and look and feel. The checklist below names those sections instead of repeating them.
- `e2e-locators-and-waits.md` (next to this file): how to write the Playwright specs.

## Stack and dependencies

- react-admin 5, React 18, MUI 6, Vite 6, axios, notistack (`SnackbarProvider`), `@sentry/react`, ESLint 9 (flat config) and Playwright.
- **Plain JavaScript/JSX, not TypeScript.** New files are `.jsx` (components) or `.js` (providers, API, utils). Only the E2E specs are TypeScript.
- React 18 and react-router 6 here are **different majors from the storefront** (React 19, router 7). Don't copy code between the apps, or upgrade one to match the other, in passing.
- Before adding a dependency, check whether react-admin or MUI already provides it (inputs, fields, dialogs, grids, filters, theming). Keep react-admin, MUI and `@mui/icons-material` on compatible versions, and commit `package-lock.json` with the change.

## How it fits together

```
main.jsx → Sentry, flakyHeartbeat → App.jsx
<Admin dataProvider authProvider layout=AppLayout dashboard loginPage theme requireAuth>
  <Resource name="orders|chefs|dishes" list/show/edit=pages/<resource>/*>
react-admin views and hooks (List, Edit, Show, useGetList, useRecordContext …)
  → dataProvider.js   CRUD contract ↔ backend shapes
  → api/base-api.js    axios: /admin prefix, Bearer token, 401 → login
  → backend /admin/<singular>
Custom actions (e.g. order status) → api/<resource>-api.js → base-api
```

Things `AGENTS.md` doesn't cover:

- **`dataProvider` supports only** `getList`, `getOne`, `getMany`, `getManyReference` and `update` (a `PUT` of the whole record). `create`, `delete`, `updateMany` and `deleteMany` throw. Filters are passed straight through as query params.
- `requireAuth` on `<Admin>` protects every route. `security/GuestRoute.jsx` and `security/ProtectedRoute.jsx` aren't used anywhere, so don't build on them.

## Adding a feature: checklist

1. **Backend first.** The endpoint must exist under `/admin/<singular>`, returning `{ list, count }` for lists and records with an `id` field (see the backend rule). Check that the backend accepts the filter params you'll send, because unknown ones are silently ignored.
2. **New resource.**
   - Add the mapping to `RESOURCE_TO_PATH` in `dataProvider.js`.
   - Create `pages/<resource>/<Resource>List.jsx`, plus `Edit` / `Show` as needed.
   - Register the `<Resource name icon list|edit|show recordRepresentation>` in `App.jsx`.
   - **Add a `Menu.Item` to `CustomMenu` in `layout/AppLayout.jsx`.** The menu is hand-written, so a new resource doesn't appear in the sidebar without this.
   - Add a count card to `pages/Dashboard.jsx` (`useGetList`) if it's worth showing there.
3. **New write operation.**
   - Create, delete or bulk actions: implement them in `dataProvider.js`, not by calling the API from a page. The backend has none of these yet.
   - Actions that aren't plain CRUD (like order status): add a function to `api/<resource>-api.js`, then `notify(...)` and `refresh()`, as `pages/orders/OrderShow.jsx` does.
   - `OrderShow` shows a generic failure message. New actions should show the backend's `error.response?.data?.message` when there is one, so the user sees the reason.
4. **Edit forms.**
   - `update` sends the **whole record** to the backend's `PUT`, including fields not shown in the form. Check what the backend binds the body to before adding inputs. Existing admin `PUT`s bind it to the JPA entity, whose translated-field names differ from the DTO (`nameHy` vs `fullNameAm`).
   - Use react-admin inputs whose `source` matches the DTO field, with a human-readable `label`. E2E tests select by label.
   - Mark read-only fields `disabled` (like `chefId` in `DishEdit`).
   - Add validators (`required()`, `minValue()`, …) that mirror the backend's rules.
5. **Lists.**
   - Use `<List filters={[...]}>` + `<Datagrid rowClick="show|edit">` with typed fields (`NumberField` with `currency: 'AMD'`, `DateField showTime`).
   - Every filter needs a `key` and a `source` the backend understands. Mark common filters `alwaysOn`.
   - Sorting is client-side and per page (see *Data provider*), so don't present it as a global sort.
6. **Order statuses.**
   - Transitions in `constants/OrderStatus.jsx` must match `AdminOrderService.ALLOWED_TRANSITIONS` and the storefront labels. Change all three together (see the backend rule).
   - Offer only transitions the backend allows; others are rejected with a 400.
7. **Look and feel.**
   - Use MUI components, the `theme/theme.js` theme and `@mui/icons-material`. Don't add one-off colours or global CSS.
   - In custom fields, use `useRecordContext()` and return `null` until the record has loaded.
8. **Config.** New `VITE_*` variables are baked into the bundle at build time, so never put secrets in them. Build redirect URLs from `import.meta.env.BASE_URL` so they work under `/backoffice/`.
9. **Tests.**
   - Extend `e2e/admin-flows.spec.ts`, or add a spec for a large feature, following `e2e-tests.md` (structure, data, stability) and `e2e-locators-and-waits.md`. Both load when you open a file in `e2e/`.
   - Run `npm run lint`, `npm run build` and `npm run test:e2e` against a running backend.

## Don't

- Don't touch seeded-bug code (`FM-BUG-08` in `OrderShow.jsx`) or demo behaviour unless that's the task (see root `AGENTS.md`).
- Don't add a `basename` or a `BrowserRouter` (see *Routing*), and don't hard-code `/backoffice` or `/admin` in links. Use react-admin's `Link` / `useCreatePath`, and let `base-api.js` add `/admin`.
- Don't call axios or `fetch` from pages. Go through `dataProvider` or `api/*-api.js`.
- Don't rely on the stored `role` for security. It's only for UI decisions; the backend must enforce access.
- Don't rename menu items, labels, headings or button text without updating `e2e/admin-flows.spec.ts`.

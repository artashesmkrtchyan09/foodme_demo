# Admin back office: architecture and adding features

Applies to every change in `apps/admin`. Commands, the folder layout and the core conventions are in `apps/admin/AGENTS.md`. How to write E2E tests is in `e2e-locators-and-waits.md` next to this file. This rule explains how the parts fit together and what to check when adding a feature.

## Stack and dependencies

- react-admin 5 on React 18 + MUI 6 (`@mui/material`, `@mui/icons-material`), built with Vite 6.
- **Plain JavaScript/JSX, not TypeScript.** Keep new files as `.jsx` (components) and `.js` (providers, API, utils). The E2E specs are the only TypeScript files.
- HTTP: axios (`api/base-api.js`). Notifications: react-admin's `useNotify`, with notistack's `SnackbarProvider` wrapping the app.
- Sentry (`@sentry/react`), ESLint 9 flat config (`eslint.config.js`, with react, react-hooks and react-refresh plugins), and Playwright.
- React 18 and react-router 6 here are **different majors from the storefront** (React 19, router 7). Don't copy code or upgrade one app to match the other in passing.
- Before adding a dependency, check whether react-admin or MUI already provides it. They cover inputs, fields, dialogs, data grids, filters and theming. Keep react-admin, MUI and `@mui/icons-material` on compatible versions, and commit `package-lock.json` with the change.

## How it fits together

```
main.jsx → Sentry, flakyHeartbeat → App.jsx
<Admin dataProvider authProvider layout=AppLayout dashboard loginPage theme requireAuth>
  <Resource name="orders|chefs|dishes" list/show/edit=pages/<resource>/*>
react-admin hooks/views (List, Edit, Show, useGetList, useRecordContext …)
  → dataProvider.js    (react-admin contract ↔ backend shapes)
  → api/base-api.js     (axios, prefixes /admin, adds Bearer token, 401 → login)
  → backend /admin/<singular>
Custom actions (e.g. order status) → api/<resource>-api.js → base-api
```

- **Routing** is react-admin's hash router (`/#/orders/1/show`). Don't add a `basename` or a `BrowserRouter`. Production is served under `/backoffice/` (`vite.config.js` `base`).
- **Auth:** `authProvider.js` stores `token`, `username` and `role` in localStorage. `checkError` logs out on 401 or 403, and `getPermissions` returns the `role`. `requireAuth` on `<Admin>` protects every route. `security/GuestRoute.jsx` and `security/ProtectedRoute.jsx` aren't used anywhere, so don't build on them.
- **dataProvider supports only** `getList`, `getOne`, `getMany`, `getManyReference` and `update` (a `PUT` of the whole record). `create`, `delete`, `updateMany` and `deleteMany` throw. Sorting is client-side, within the current page only. Filters are passed straight through as query params.

## Adding a feature: checklist

1. **Backend first.** The admin API must exist under `/admin/<singular>`, returning `{ list, count }` for lists (`AdminListResponseDto`) and records with an `id` field. See the backend rule. Check that the backend accepts the filter params you'll send, because unknown params are silently ignored.
2. **New resource:**
   - Add the plural → singular mapping to `RESOURCE_TO_PATH` in `providers/dataProvider.js`.
   - Create `pages/<resource>/<Resource>List.jsx`, and `…Edit.jsx` / `…Show.jsx` as needed.
   - Register a `<Resource name=... icon=... list=... recordRepresentation=...>` in `App.jsx`.
   - **Add a `Menu.Item` to `CustomMenu` in `layout/AppLayout.jsx`.** The menu is hand-written, so a new resource doesn't appear in the sidebar without this.
   - Add a count card to `pages/Dashboard.jsx` (`useGetList`) if the resource is important enough to show there.
3. **New write operation:**
   - Create, delete or bulk actions: implement the method in `dataProvider.js`, mapping it to the backend endpoint, instead of calling the API from a page. The backend currently has none of these.
   - Actions that aren't plain CRUD (like changing order status): add a function to `api/<resource>-api.js` and call it from the page. Then call `notify(...)` for the result and `refresh()`, as `pages/orders/OrderShow.jsx` does. That page shows a generic failure message. New actions should show the backend's error `message` (`error.response?.data?.message`) when there is one, so the reason, such as an invalid status transition, reaches the user.
4. **Edit forms:**
   - `update` sends the **whole record** back to the backend's `PUT`, including fields not shown in the form. Check what the backend binds the body to before adding inputs. Existing admin `PUT`s bind it to the JPA entity, whose field names differ from the DTO for translated fields (`nameHy` vs `fullNameAm`).
   - Use react-admin inputs (`TextInput`, `NumberInput`, `SelectInput` with `choices`) with `source` matching the DTO field and a human-readable `label`. Labels are what E2E tests select by.
   - Use `disabled` for read-only fields (as `chefId` in `DishEdit` does).
   - Add validation with react-admin validators (`required()`, `minValue()`, …) that match the backend's rules.
5. **Lists:**
   - `<List filters={[...]}>` + `<Datagrid rowClick="show|edit">` with typed fields (`TextField`, `NumberField` with `currency: 'AMD'`, `DateField showTime`).
   - Every filter needs a `key` and a `source` the backend understands. Mark common filters `alwaysOn`.
   - Default sort only affects the current page, because sorting is client-side. Don't present it as a global sort.
6. **Order statuses:**
   - Labels, colours and allowed transitions live in `constants/OrderStatus.jsx`.
   - They must match `AdminOrderService.ALLOWED_TRANSITIONS` in the backend and the storefront's status labels. Change all of them together.
   - Only offer transitions the backend allows; the backend rejects others with a 400.
7. **Look and feel:**
   - Use MUI components and the theme in `theme/theme.js`. Don't add one-off colours or global CSS.
   - Use `@mui/icons-material` for icons.
   - Use `useRecordContext()` inside custom fields, and return `null` while the record is loading.
8. **Config:** new settings are `VITE_*` env vars read via `import.meta.env`. They're baked in at build time, so never put secrets in them. Build login and other redirect URLs from `import.meta.env.BASE_URL` so they work under `/backoffice/`.
9. **Tests:**
   - Extend `e2e/admin-flows.spec.ts`, or add a spec for a large feature, following `e2e-locators-and-waits.md`.
   - Specs run serially, log in as `admin` / `admin123`, navigate to `/#/<resource>`, and create the data they need through the public API (`createOrderViaApi`).
   - Run `npm run lint`, `npm run build` and `npm run test:e2e` against a running backend.

## Don't

- Don't change `pages/orders/OrderShow.jsx` around `FM-BUG-08` unless the task is that bug.
- Don't remove `lib/flakyHeartbeat.js` or the Sentry setup. They're intentional demo behaviour.
- Don't switch to browser routing or add `basename` (you get a blank page), and don't hard-code `/backoffice` or `/admin` in links. Use react-admin's `Link` / `useCreatePath`, and let `base-api.js` add the `/admin` prefix.
- Don't call axios or `fetch` directly from pages. Go through `dataProvider` or `api/*-api.js`.
- Don't rely on the stored `role` for security. It's only for UI decisions; the backend must enforce access.
- Don't rename menu items, field labels, headings or button text without updating `e2e/admin-flows.spec.ts`, because the tests select by them.

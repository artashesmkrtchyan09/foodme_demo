# AGENTS.md — admin (back office)

Back-office app built with react-admin 5 + MUI 6, plain JavaScript/JSX, React 18, and Vite 6. See the repo-root `AGENTS.md` for the overall architecture, the seeded `FM-BUG` / `FM-FLAKE` markers, and how this SPA is bundled into the backend at `/backoffice`.

**Adding a feature?** Follow `.agents/rules/admin-feature-development.md`. It covers `dataProvider` limits, adding a resource and a step-by-step checklist, building on the structure below without repeating it. E2E specs follow `.agents/rules/e2e-locators-and-waits.md`.

## Commands

Run from `apps/admin`:
```
npm run dev                              # Vite dev server at /, API defaults to http://localhost:8081
npm run lint                             # eslint (eslint.config.js)
npm run build                            # production build with base '/backoffice/'
npm run test:e2e                         # Playwright, starts vite on :5174 itself (strictPort)
npx playwright test -g "<test title>"
```
The E2E tests run serially, call the backend at `http://localhost:8081` (`VITE_API_BASE_URL` overrides it), and log in as the seeded admin `admin` / `admin123`. Set `ADMIN_BASE_URL` to test a deployed back office.

## Structure

- **Resources:** `src/App.jsx` declares the react-admin `<Admin>` with three resources: `orders` (list/show), `chefs` (list/edit) and `dishes` (list/edit). Their pages live in `src/pages/<resource>/`.
- **Routing:** react-admin's default **hash router** is used on purpose, with no `basename`, so URLs look like `/backoffice/#/orders`. Adding `basename` without an external `BrowserRouter` renders a blank page. The E2E specs navigate to `/#/...`.
- **Data provider:** `providers/dataProvider.js` connects react-admin to the backend.
  - It maps the plural resource names to the singular admin paths (`orders` → `/admin/order`).
  - It converts the backend's `{ list, count }` into `{ data, total }`, and react-admin's 1-based pages into the backend's 0-based `page`.
  - Sorting happens on the client, within the fetched page.
  - To add a resource, update `RESOURCE_TO_PATH`.
- **Auth:** `providers/authProvider.js` logs in through `api/auth-api.js` (`/admin/auth/login`) and stores `token`, `username` and `role` in localStorage. A 401 or 403 logs the user out.
- **HTTP:** `api/base-api.js` is a shared axios instance that adds `Authorization: Bearer <token>` and redirects to the login route. That route respects the Vite `BASE_URL`, so it works under `/backoffice/`. Per-resource helpers live in `api/*-api.js`.
- **Look and feel:** `theme/theme.js` (MUI theme), `layout/AppLayout.jsx`, `pages/Dashboard.jsx` and `pages/LoginPage.jsx`. Order status labels and colours are in `constants/OrderStatus.jsx`.
- **Startup:** Sentry (`lib/sentry.js`, using `VITE_SENTRY_DSN`) and the demo `lib/flakyHeartbeat.js` are initialised in `src/main.jsx`.

`OrderShow.jsx` contains a seeded bug (`FM-BUG-08`).
# AGENTS.md — web (storefront)

Customer storefront: React 19 + TypeScript + Vite 8 + Tailwind 4. See the repo-root `AGENTS.md` for the overall architecture, the seeded `FM-BUG` / `FM-FLAKE` markers, and how this SPA is bundled into the backend at `/`.

**Adding a feature?** Follow `.agents/rules/web-feature-development.md`. It covers how a page is wired and gives a step-by-step checklist, building on the structure below without repeating it. E2E specs follow `.agents/rules/e2e-tests.md` (structure, data, stability) and `.agents/rules/e2e-locators-and-waits.md`. Both load when a file in `e2e/` is opened.

## Commands

Run from `apps/web`:
```
npm run dev                              # Vite dev server; API defaults to http://localhost:8081
npm run lint                             # oxlint (.oxlintrc.json)
npm run build                            # tsc -b && vite build; type errors fail the build
npm run test:e2e                         # Playwright, starts vite on :5180 itself
npx playwright test e2e/layout.spec.ts
npx playwright test -g "dish modal opens"
npm run test:e2e:all                     # web suite, then the admin suite
```
The E2E tests call the real backend at `http://localhost:8081` (`VITE_API_BASE_URL` overrides it, except in `layout.spec.ts`, which hard-codes it). Set `PLAYWRIGHT_BASE_URL` to test a deployed storefront.

TypeScript is strict about unused code (`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`), so use `import type` for type-only imports.

## Structure

- **Routing:** `src/router.tsx` (`createBrowserRouter`) wraps each page in `AppLayout`. Pages live in `src/pages/<Name>/index.tsx`.
- **API:**
  - `src/api/client.ts` is a thin `fetch` wrapper. It adds the customer JWT from `lib/auth-storage`, throws `ApiRequestError(message, status)` using the backend's `ErrorResponseDto.message`, and clears stored auth on a 401 from `/api/customer/*`.
  - Every endpoint is a method on `foodmeApi` in `src/api/foodme.ts`, and the DTO types live in `src/types`. Add new calls there rather than calling `fetch` from components.
  - Components fetch data with TanStack Query.
- **Imports:** `@/` is an alias for `src/`.
- **Auth:** `providers/auth-provider.tsx` keeps customer auth in localStorage through `lib/auth-storage`, and syncs across tabs via the `storage` event and a custom `AUTH_CHANGED_EVENT`. `lib/auth-next.ts` cleans up the post-login `?next=` redirect, defaulting to `/orders` and rejecting `//` and absolute URLs.
- **Cart:** the cart lives only in the browser, in Dexie/IndexedDB (`lib/db.ts`, database `FoodMeCart`, table `products`). All changes go through the functions in `hooks/useCart.ts`.
  - The cart can hold dishes from only one chef. `addDishToCart` returns `"mismatch"` unless called with `replaceOtherChef`.
  - Item `uid` is `chefId-dishId-sortedAdditionIds`.
  - Each item keeps a `minimumOrderCount` floor.
- **Forms:** react-hook-form + zod schemas in `src/schemas`.
- **i18n:** i18next, English only, strings in `src/locales/en/translation.json`.
- **UI:**
  - `components/ui` holds shadcn-style primitives (`components.json`; `cn` in `lib/utils`).
  - `components/sections` holds feature components.
  - Components also carry short prefixed class names (`cc_card`, `dc_card`, `uc-panel`, `cic_root`, …). The Playwright specs select elements by these, so keep them when refactoring markup.
- **Startup:** `src/main.tsx` initialises Sentry (`lib/sentry.ts`, using `VITE_SENTRY_DSN`) and the demo `flakyHeartbeat`.

## E2E specs

The specs are in `e2e/`, and `e2e/auth.ts` has helpers to register customers in the UI or through the API. The specs named `flake-*.spec.ts` contain `FM-FLAKE` cases that are flaky on purpose.
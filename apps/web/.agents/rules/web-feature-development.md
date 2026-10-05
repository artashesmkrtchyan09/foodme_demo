# Web storefront: architecture and adding features

Applies to every change in `apps/web`. Commands, the folder layout and the core conventions are in `apps/web/AGENTS.md`. How to write E2E tests is in `e2e-locators-and-waits.md` next to this file. This rule explains how the parts fit together and what to check when adding a feature.

## Stack and dependencies

- React 19 + TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`, `verbatimModuleSyntax`), built with Vite 8. `npm run build` runs `tsc -b`, so type errors fail the build and CI.
- Routing: `react-router-dom` 7 (`createBrowserRouter`).
- Server state: TanStack Query 5. The `QueryClient` in `App.tsx` uses `staleTime: 30s` and `retry: 1`.
- Client state: React context (`AuthProvider`), localStorage (auth) and Dexie/IndexedDB (cart). There is no Redux or Zustand; don't add one.
- Forms: react-hook-form + zod (`@hookform/resolvers/zod`).
- UI: Tailwind 4 (`@tailwindcss/vite`, CSS-first config in `src/index.css`), shadcn-style primitives on Radix (`components.json`), `class-variance-authority`, `clsx` + `tailwind-merge` via `cn()`, and `lucide-react` icons.
- i18next / react-i18next, Sentry (`@sentry/react`), Playwright for E2E, and oxlint for linting.
- Before adding a dependency, check the list above. Radix primitives, lucide icons and the existing helpers cover most needs. The bundle is served from a 0.1 CPU instance, so keep it small. Use `npm install` and commit `package-lock.json` in the same commit.

## How a page works

```
main.tsx → initSentry, startFlakyHeartbeat, i18n → App.tsx
App: QueryClientProvider → AuthProvider → RouterProvider(router.tsx)
router.tsx: path → withLayout(<Page/>)  (AppLayout = header + footer)
Page (pages/<Name>/index.tsx)
  ├─ useQuery({ queryKey, queryFn: () => foodmeApi.x() })   server data
  ├─ useAuth()                                               customer session
  ├─ useCart() / addDishToCart() …                          cart (IndexedDB)
  └─ components/sections/* → components/ui/*                 feature UI → primitives
foodmeApi (api/foodme.ts) → apiClient (api/client.ts) → fetch(API_BASE_URL + path)
```

## Adding a feature: checklist

1. **Types** (`src/types/index.ts`): add interfaces that mirror the backend DTOs exactly, including field names. Translated fields are either `ITranslation[]` (`{ lang: "en" | "hy" | "ru", value }`, read with `translate()` from `lib/utils`) or flat `nameEn` / `nameHy` / `nameRu`, depending on what the endpoint returns.
2. **API** (`src/api/foodme.ts`): add one method per endpoint on `foodmeApi`, typed with `apiClient.get<T>` / `apiClient.post<T>`.
   - `apiClient` only has `get` and `post`. If you need `PUT`/`PATCH`/`DELETE`, add it to `apiClient` in `client.ts` following the same pattern, rather than calling `fetch` directly.
   - Never call `fetch` from a component.
   - Build query strings the way existing methods do, and encode user input with `encodeURIComponent`.
3. **Page** (if it's a new route):
   - Create `src/pages/<Name>/index.tsx` with a default export.
   - Register it in `router.tsx` wrapped in `withLayout(...)`, above the `*` catch-all.
   - Add a nav link in `components/layout/header.tsx` if users need to reach it.
   - The backend's `SpaWebConfig` already falls back to `index.html` for extension-less paths, so deep links work without backend changes.
4. **Data fetching:**
   - `useQuery` with a descriptive array key that includes every input (`["my-orders", customer?.id]`).
   - Use `enabled:` for queries that depend on auth or on another query.
   - Mutations are currently plain `async` handlers that call `foodmeApi` and then navigate (see `pages/Checkout`, `AuthProvider`). For new mutations that change data shown elsewhere, use `useMutation` and invalidate the affected query keys.
   - Always render all three states: loading (`aria-live` skeleton), error (`role="alert"` with a retry button), and empty. `pages/Orders` is the reference.
   - Show `ApiRequestError.message` to the user. It's the backend's `ErrorResponseDto.message`.
5. **Auth-only pages:**
   - Use `const { isAuthenticated } = useAuth()`. If not authenticated, `return <Navigate to="/login?next=/your-path" replace />` after the hooks run, as in `pages/Orders`.
   - `next` is sanitised by `lib/auth-next.ts`. Only pass same-origin relative paths.
   - A 401 from `/api/customer/*` clears stored auth automatically.
6. **Forms:**
   - Put the zod schema in `src/schemas/<feature>-schema.ts` and export `z.infer` types.
   - Use `useForm({ resolver: zodResolver(schema) })` and connect each input to a `<Label>` so `getByLabel` works.
   - Keep the client rules in line with the backend's bean validation (for example, password 8–72, phone 8–32), so users don't pass the client check and then fail on the server.
7. **Cart changes:**
   - Change the cart only through `hooks/useCart.ts`.
   - Keep the rules: one chef per cart (`"mismatch"` / `replaceOtherChef`), `uid = chefId-dishId-sortedAdditionIds`, and the `minimumOrderCount` floor.
   - If the shape of `ICartItem` changes, add a new `db.version(n)` in `lib/db.ts` with an upgrade. Don't edit `version(1)`, because existing browsers already have that schema.
   - `useCart.ts` contains seeded bug history (`FM-BUG-07`). Re-check decrement and removal behaviour after any change.
8. **UI:**
   - Reuse `components/ui` primitives (`Button`, `Card`, `Dialog`, `Input`, `Label`, `RadioGroup`, `SafeImage` for remote images).
   - Put feature components in `components/sections/<kebab-name>.tsx` as named exports (`export function ChefCard`).
   - Use the `@/` import alias and `import type` for types.
   - Style with Tailwind utilities, the theme variables in `index.css` (`--card`, `--border`, `--muted-foreground`, …) and its shared helper classes (`bezel-outer`/`bezel-inner`, `shadow-diffuse`). Use `cn()` to merge classes.
   - `font-display` and `animate-fade-up` appear in components but aren't defined in `index.css`, so they currently have no effect. Don't rely on them. Define them in `index.css` first if you need them.
   - Prices go through `formatAmd()`.
   - Give new feature roots a short prefixed class (like `cc_card`, `dc_card`) only if existing specs follow that pattern for the area. New tests should use roles, labels or `data-testid` instead.
9. **Accessibility** (the E2E rule depends on it): use semantic elements and roles, an accessible name on every interactive element (`aria-label` on icon-only buttons), labelled form fields, and `alt` text on images.
10. **Text:** most copy is written inline in English. `src/locales/en/translation.json` holds only a few shared labels (`generic.*`) used through `useTranslation()`. Follow whatever the surrounding component does. Don't half-migrate a page to i18n.
11. **Config:** new build-time settings are `VITE_*` env vars read through `import.meta.env`, with a dev default. Remember they're baked into the bundle at build time, so never put secrets in them.
12. **Tests:** add or extend a Playwright spec in `e2e/` for the user flow, following `e2e-locators-and-waits.md`. Register customers with the helpers in `e2e/auth.ts`. Run `npm run lint`, `npm run build` and `npm run test:e2e` against a running backend.

## Cross-app contracts

- Response shapes come from the backend DTOs: storefront lists are named arrays plus `count` (`exploreChefResponseDtoList`, `dishDtoList`), and customer orders return `{ list, count }`. If a backend field is renamed, nothing fails at compile time, so update `src/types` in the same change.
- Order status labels (`STATUS_LABEL` in `pages/Orders`, the status map in `pages/Tracking`) must cover every backend status: `NEW`, `ACCEPTED`, `DELIVERED`, `REJECTED`.
- In production the app is served by the backend at `/`, with relative API calls. Locally it calls `http://localhost:8081`. Don't hard-code hosts.

## Don't

- Don't remove or change `lib/flakyHeartbeat.ts` or the Sentry setup. They're intentional demo behaviour.
- Don't touch `FM-BUG-NN` / `FM-FLAKE-NN` code unless the task is about that bug or flake.
- Don't rename or remove the prefixed class names (`cc_card`, `dc_card`, `uc-panel`, `cic_root`, …) or existing visible text and labels without updating the specs that use them. Search `e2e/` first.
- Don't store anything sensitive in localStorage beyond the existing auth payload, and don't read the token directly. Go through `lib/auth-storage`.
- Don't add global CSS for one component. Use utilities, or a small class in `index.css` if it's reused.

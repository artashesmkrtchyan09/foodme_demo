# Web storefront: architecture and adding features

Applies to every change in `apps/web`. This rule covers how the parts fit together and the steps for adding a feature. It doesn't repeat the other files:
- Root `AGENTS.md`: seeded `FM-BUG`/`FM-FLAKE` code, demo behaviour (`flakyHeartbeat`), single-origin deployment and the API base URL.
- `apps/web/AGENTS.md`: commands, TypeScript strictness, and the structure of routing, API, auth, cart, forms, i18n and UI. The checklist below names those sections instead of repeating them.
- `e2e-locators-and-waits.md` (next to this file): how to write the Playwright specs.

## Stack and dependencies

- React 19, TypeScript, Vite 8. `npm run build` runs `tsc -b`, so type errors fail CI.
- `react-router-dom` 7, TanStack Query 5 (`App.tsx`: `staleTime: 30s`, `retry: 1`), and react-hook-form + zod.
- Dexie (cart), i18next, `@sentry/react`, and oxlint.
- UI: Tailwind 4 (CSS-first, configured in `src/index.css`), Radix primitives in shadcn style, `class-variance-authority`, `clsx` + `tailwind-merge` via `cn()`, and `lucide-react` icons.
- Client state lives only in React context (auth), localStorage and IndexedDB. Don't add Redux, Zustand or similar.
- Before adding a dependency, check whether Radix, lucide or an existing helper already covers it. Keep the bundle small. Commit `package-lock.json` with the change.

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

1. **Types** (`src/types/index.ts`). Mirror the backend DTOs exactly, including field names. Translated fields come either as `ITranslation[]` (read with `translate()` from `lib/utils`) or as flat `nameEn`/`nameHy`/`nameRu`, depending on the endpoint.
2. **API** (see *API* in `AGENTS.md`).
   - Add one typed method per endpoint on `foodmeApi`.
   - `apiClient` only has `get` and `post`. For `PUT`/`PATCH`/`DELETE`, add the method to `apiClient` following the same pattern.
   - Encode user input in query strings with `encodeURIComponent`.
3. **Route** (if it's a new page).
   - Register it in `router.tsx` wrapped in `withLayout(...)`, above the `*` catch-all.
   - Add a link in `components/layout/header.tsx` if users need to reach it.
   - Deep links need no backend change, because `SpaWebConfig` falls back to `index.html`.
4. **Data fetching.**
   - Use `useQuery` with an array key that includes every input (`["my-orders", customer?.id]`), and `enabled:` for queries that depend on auth or on another query.
   - Existing mutations are plain `async` handlers (`pages/Checkout`, `AuthProvider`). For new mutations that change data shown elsewhere, use `useMutation` and invalidate the affected keys.
   - Always render loading (`aria-live` skeleton), error (`role="alert"` with a retry button) and empty states. `pages/Orders` is the reference.
   - Show `ApiRequestError.message` to the user.
5. **Auth-only pages.** After the hooks, if `!isAuthenticated`, `return <Navigate to="/login?next=/your-path" replace />` (see `pages/Orders`). Pass only same-origin relative paths in `next` (see *Auth* in `AGENTS.md`).
6. **Forms** (see *Forms*).
   - Create `src/schemas/<feature>-schema.ts` exporting `z.infer` types, and use `useForm({ resolver: zodResolver(schema) })`.
   - Connect every input to a `<Label>`.
   - Mirror the backend's bean-validation limits (for example, password 8–72, phone 8–32), so users don't pass the client check and then fail on the server.
7. **Cart** (see *Cart*).
   - If `ICartItem` changes shape, add a new `db.version(n)` with an upgrade in `lib/db.ts`. Never edit `version(1)`, because existing browsers already have it.
   - `useCart.ts` has seeded-bug history (`FM-BUG-07`), so re-check decrement and removal after any change.
8. **UI** (see *UI*).
   - Put feature components in `components/sections/<kebab-name>.tsx` as named exports.
   - Use `SafeImage` for remote images and `formatAmd()` for prices.
   - Style with Tailwind utilities, the theme variables in `index.css` (`--card`, `--border`, `--muted-foreground`, …) and its shared classes (`bezel-outer`/`bezel-inner`, `shadow-diffuse`). Merge classes with `cn()`.
   - `font-display` and `animate-fade-up` appear in components but are defined nowhere, so they have no effect. Define them in `index.css` before relying on them.
   - Only add a prefixed class (`cc_card`-style) where existing specs use that pattern. New tests use roles, labels or `data-testid`.
9. **Accessibility** (the E2E rule depends on it): use semantic elements, give every control an accessible name (`aria-label` on icon-only buttons), label every field, and add `alt` text to images.
10. **Text.** Most copy is written inline in English. `translation.json` holds only a few shared `generic.*` labels. Follow what the surrounding component does, and don't half-migrate a page to i18n.
11. **Config.** New `VITE_*` variables are baked into the bundle at build time, so never put secrets in them.
12. **Tests.**
   - Add or extend a spec in `e2e/` following `e2e-locators-and-waits.md`. Use `e2e/auth.ts` for customers.
   - Run `npm run lint`, `npm run build` and `npm run test:e2e` against a running backend.

## Shared with the backend and admin

- Response shapes come from backend DTOs. Storefront lists are named arrays plus `count` (`exploreChefResponseDtoList`, `dishDtoList`), and customer orders are `{ list, count }`. Renaming a field doesn't fail at compile time, so update `src/types` in the same change.
- The order status maps (`STATUS_LABEL` in `pages/Orders`, the map in `pages/Tracking`) must cover every backend status: `NEW`, `ACCEPTED`, `DELIVERED`, `REJECTED`. See the backend rule for the full flow.

## Don't

- Don't touch seeded-bug code or demo behaviour unless that's the task (see root `AGENTS.md`).
- Don't rename prefixed classes, visible text or labels without updating the specs that use them. Search `e2e/` first.
- Don't read the token or store anything new in localStorage directly. Go through `lib/auth-storage`.
- Don't add global CSS for a single component.

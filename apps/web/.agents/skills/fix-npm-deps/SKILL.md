---
name: fix-npm-deps
description: Diagnose and fix npm dependency problems in the web storefront (apps/web) by reinstalling with npm ci or installing a specific package. Use when dev/build/lint/test fails with "Cannot find module", "Failed to resolve import", "Could not resolve", "command not found" (vite, tsc, oxlint, playwright), missing type declarations (TS2307/TS7016), missing native binaries (@rollup/rollup-*, lightningcss-*, @oxlint/*), "Executable doesn't exist" for Playwright browsers, ERESOLVE peer-dependency errors, or a stale/out-of-sync node_modules or package-lock.json.
---

# Fix npm dependency issues — web

Run every command from `apps/web`. CI and the Dockerfile use **Node 20** and `npm ci`, so the lockfile `package-lock.json` is the source of truth.

## 1. Identify the problem

Read the exact error before installing anything, and check the basics:

```
node -v                     # expect v20+ (CI uses 20)
ls node_modules >/dev/null  # does node_modules exist at all?
npm ls <package>            # is it installed, and at which version?
```

Then pick the matching case below.

## 2. Fixes by case

**`node_modules` missing, or a CLI is not found (`vite`, `tsc`, `oxlint`, `playwright`)** → install from the lockfile:
```
npm ci
```

**A package that `package.json` lists can't be found, or `npm ls` shows `missing` / `invalid` / `extraneous`** → node_modules is out of sync with the lockfile. Run `npm ci` (it deletes `node_modules` and reinstalls).

**A missing native/optional binary** (`Cannot find module @rollup/rollup-win32-x64-msvc`, `lightningcss.win32-x64-msvc.node`, `@tailwindcss/oxide-*`, `@oxlint/*`). This is the known npm bug with optional dependencies, usually after switching OS or Node version. Remove `node_modules` and run `npm ci`. If it still fails, run `npm install` (keep `package-lock.json`) so npm adds the platform binary, and review the lockfile diff.

**Code imports a package that is not in `package.json`** → add it as a real dependency, choosing the right section:
```
npm install <pkg>        # runtime code under src/
npm install -D <pkg>     # build/lint/test/type-only (vite plugins, @types/*, playwright helpers)
```
First check `src/` to make sure it's not a typo or a path that should use the `@/` alias (`@/` = `src/`, not an npm package).

**TS2307 / TS7016: cannot find module or its type declarations** → if the package ships no types, add `npm install -D @types/<pkg>`. If the import is `@/...`, it is a path issue, not a missing package.

**Playwright: `Executable doesn't exist` / browser not installed** →
```
npx playwright install chromium
```

**`ERESOLVE` / peer-dependency conflict** → this app is on React 19, Vite 8, Tailwind 4, TypeScript ~6 and zod 4. Pick a version of the new package that supports them (`npm view <pkg> peerDependencies`) rather than downgrading existing packages.

## 3. Rules

- Prefer `npm ci`. Use `npm install` only when you intend to change `package.json` / `package-lock.json`.
- Never delete `package-lock.json` to "fix" an install, and never run `npm audit fix --force`.
- Don't use `--force` or `--legacy-peer-deps` unless the user approves; say which conflict made it necessary.
- Don't bump or downgrade unrelated packages while fixing one issue.
- These apps contain seeded `FM-BUG` / `FM-FLAKE` issues. A failing test or wrong behaviour is not a dependency problem unless the error is about module resolution.

## 4. Verify

Re-run the command that failed, then:
```
npm run lint
npm run build      # tsc -b && vite build; catches missing types
```
Report what was wrong, what you ran, and any changes to `package.json` / `package-lock.json`.

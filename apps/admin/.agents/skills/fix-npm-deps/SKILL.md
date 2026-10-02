---
name: fix-npm-deps
description: Diagnose and fix npm dependency problems in the admin back office (apps/admin) by reinstalling with npm ci or installing a specific package. Use when dev/build/lint/test fails with "Cannot find module", "Failed to resolve import", "Could not resolve", "command not found" (vite, eslint, playwright), missing native binaries (@rollup/rollup-*, @esbuild/*), "Executable doesn't exist" for Playwright browsers, ERESOLVE peer-dependency errors, or a stale/out-of-sync node_modules or package-lock.json.
---

# Fix npm dependency issues — admin

Run every command from `apps/admin`. CI and the Dockerfile use **Node 20** and `npm ci`, so the lockfile `package-lock.json` is the source of truth.

## 1. Identify the problem

Read the exact error before installing anything, and check the basics:

```
node -v                     # expect v20+ (CI uses 20)
ls node_modules >/dev/null  # does node_modules exist at all?
npm ls <package>            # is it installed, and at which version?
```

Then pick the matching case below.

## 2. Fixes by case

**`node_modules` missing, or a CLI is not found (`vite`, `eslint`, `playwright`)** → install from the lockfile:
```
npm ci
```

**A package that `package.json` lists can't be found, or `npm ls` shows `missing` / `invalid` / `extraneous`** → node_modules is out of sync with the lockfile. Run `npm ci` (it deletes `node_modules` and reinstalls).

**A missing native/optional binary** (`Cannot find module @rollup/rollup-win32-x64-msvc`, `@esbuild/win32-x64`). This is the known npm bug with optional dependencies, usually after switching OS or Node version. Remove `node_modules` and run `npm ci`. If it still fails, run `npm install` (keep `package-lock.json`) so npm adds the platform binary, and review the lockfile diff.

**Code imports a package that is not in `package.json`** → add it as a real dependency, choosing the right section:
```
npm install <pkg>        # runtime code under src/
npm install -D <pkg>     # build/lint/test only (vite plugins, eslint plugins, playwright helpers)
```
First check `src/` to make sure it's not a typo or a relative path that is wrong.

**Playwright: `Executable doesn't exist` / browser not installed** →
```
npx playwright install chromium
```

**`ERESOLVE` / peer-dependency conflict** → this app is pinned to **React 18**, MUI 6, react-admin 5, react-router-dom 6, Vite 6 and ESLint 9. Pick a version of the new package that supports them (`npm view <pkg> peerDependencies`). Don't upgrade React to 19 or MUI/react-admin to a new major just to make an install pass.

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
npm run build      # production build with base '/backoffice/'
```
Report what was wrong, what you ran, and any changes to `package.json` / `package-lock.json`.

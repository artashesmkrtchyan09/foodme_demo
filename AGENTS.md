# AGENTS.md

This file provides guidance to coding agents working with code in this repository. Each app has its own `AGENTS.md` with commands, structure and conventions: `apps/backend`, `apps/web`, `apps/admin`. Rules and skills are listed in *Where agent guidance lives* at the end.

## What this repo is

FoodMe is a food-ordering demo app used for an **agentic-QA course**. It is deployed by students to Render's free tier (see `README.md`, written for non-technical users). The codebase **intentionally contains seeded bugs and flaky tests**, tagged with comments:

- `FM-BUG-NN` — deliberate product bugs (e.g. in `OrderService.java`, `ChefService.java`, `useCart.ts`, `OrderShow.jsx`).
- `FM-FLAKE-NN` — deliberately flaky tests (backend JUnit and Playwright specs).

Grep for these markers before "fixing" odd-looking code — only change them when the task is explicitly about that bug/flake. Fixes are usually committed referencing the tag (e.g. "Adjust cart quantity decrement threshold (FM-BUG-07)").

Other demo-only behaviour that is intentional, not a bug:
- `SimulatedLatencyConfig` adds a random 200–1500 ms delay to `/api/**` and `/admin/**` (disabled in the `test` profile).
- `FlakyHeartbeatJob` (backend) and `lib/flakyHeartbeat.*` (web/admin) report a fake failure to Sentry/GlitchTip ~1 in 10 ticks.
- `GET /api/debug/boom` throws on purpose to exercise the error tracker.

## Layout

- `apps/backend` — Spring Boot 3.3 / Java 17 / Gradle API, Postgres + Flyway, JWT auth.
- `apps/web` — customer storefront: React 19 + TypeScript + Vite 8 + Tailwind 4.
- `apps/admin` — back office: react-admin 5 + MUI, plain JSX, React 18.
- `infra/monitoring/stack` — single-container Prometheus + Loki + Grafana + Grafana MCP behind nginx (see `infra/monitoring/README.md`).
- `render.yaml` (app + DB) and `render-monitoring.yaml` (monitoring, `autoDeploy: false` on purpose since redeploys wipe data).

## Local development

Run the backend on `:8081` (needs Postgres), then either frontend. Both frontends' E2E suites hit that real backend; there are no frontend unit tests. `npm run test:e2e:all` in `apps/web` runs the web suite and then the admin suite.

CI (`.github/workflows/ci.yml`) runs backend build, web/admin lint + build, Docker builds, and an E2E job. Note: the E2E job references `infra/docker-compose.yml`, which does not currently exist in the repo. `claude-pr-review.yml` runs Claude review on PRs.

## Architecture

**Single-origin deployment.** `apps/backend/Dockerfile` uses the *repo root* as build context: it builds both SPAs, copies `web/dist` into `static/` and `admin/dist` into `static/backoffice/`, then builds the Spring Boot jar. `SpaWebConfig` serves the storefront at `/` and admin at `/backoffice`, falling back to each SPA's `index.html` for extension-less paths. Admin is at `/backoffice` because `/admin/**` is the admin REST API. Admin's `vite.config.js` sets `base: '/backoffice/'` only in production mode.

**API base URL.** Both frontends default to relative URLs in production and `http://localhost:8081` in dev; `VITE_API_BASE_URL` overrides. `VITE_SENTRY_DSN` is baked in at build time (Render passes `VITE_SENTRY_DSN_WEB` / `VITE_SENTRY_DSN_ADMIN` as build args).

**Free-tier constraints.** Render's instance is 512 MB / 0.1 CPU; the backend's JVM flags, Tomcat thread cap and Flyway retries exist for that (see `apps/backend/AGENTS.md`).

## Where agent guidance lives

Each fact is written in one place. Link to it rather than copying it.

| Layer | Holds | Location |
|---|---|---|
| This file | What the repo is, seeded bugs and flakes, demo-only behaviour, layout, deployment architecture | `AGENTS.md` |
| App `AGENTS.md` | Commands, structure and conventions of one app | `apps/<app>/AGENTS.md` |
| Rules | Standing instructions loaded automatically (app rules when working in that app) | `.agents/rules/` (repo-wide), `apps/<app>/.agents/rules/` (per app) |
| Skills | Step-by-step procedures, loaded only when the task matches | `.agents/skills/`, `apps/<app>/.agents/skills/` |
| Agents | Subagents that run one job in their own context | `.agents/agents/` |
| Commands | Slash commands that run a longer workflow | `.agents/commands/` |

Current rules:
- `.agents/rules/git-workflow.md`: branches, commits, PRs and what never goes into git.
- `apps/<app>/.agents/rules/<app>-feature-development.md`: the architecture and a checklist for adding a feature to that app.
- `apps/backend/.agents/rules/backend-tests.md`: JUnit/MockMvc test structure, data isolation and assertions (loads for `src/test/**`).
- `apps/{web,admin}/.agents/rules/e2e-tests.md`: Playwright spec structure, test data and stability (loads for `e2e/**`).
- `apps/{web,admin}/.agents/rules/e2e-locators-and-waits.md`: Playwright locators and waits (loads for `e2e/**`).

Current skills:
- `ship-pr`: commit, push and open a ready-to-merge PR for changes already on a branch. Only when the user asks.
- `bug-report`: write a reproducible bug report.
- `test-review`: read-only review of tests added in a diff or PR (backend, web, admin). Reports badly written tests and missing tests; built to run in CI.
- `qase-sync`: reconcile Qase test cases with the repo's tests.
- `web-regression` (web): run the Qase Web test cases in Chrome through the Playwright MCP server and report a comparable result.
- `jira`: search, create, update and link issues in the SCRUM Jira project.
- `backend-dev` (backend): implement a backend change bottom up, build it, run it against Postgres and check it through the API.
- `backend-test` (backend): write, run and debug JUnit/MockMvc tests, including telling seeded flakes and bugs from real failures.
- `fix-npm-deps` (web, admin): repair dependency installs.

Current agents:
- `web-regression-runner`: runs one `web-regression` run in a fresh context and returns its report. It never edits files.

Current commands:
- `/web-regression-goal [runs] [base-url]`: runs `web-regression` 10 times (by default), compares the results and improves the skill (`SKILL.md`, `case-notes.md`, `improvement-log.md`) until runs agree.

`.claude` (and each `apps/<app>/.claude`) is a symlink to the matching `.agents` folder, and each `CLAUDE.md` is a symlink to `AGENTS.md`, so the same files serve Claude Code and other agents.

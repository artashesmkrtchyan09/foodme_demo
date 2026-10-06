---
name: backend-dev
description: Implement or change FoodMe backend code (apps/backend, Spring Boot) end to end — a new or changed endpoint, entity, Flyway migration, DTO, service rule, security matcher or config — then build it, run it against Postgres and check it through the real API. Use when asked to add, change, extend or fix backend/API behaviour, add a column or table, expose new data to the web or admin app, or run the backend locally to try a change. Not for writing tests only (use backend-test).
---

# Develop a backend change

The architecture, the feature checklist and the conventions are written down once. Read them first and follow them; this skill is the procedure around them:
- [`backend-feature-development.md`](../../rules/backend-feature-development.md): request flow, layer-by-layer checklist, contracts shared with the frontends, *Don't* list.
- [`apps/backend/AGENTS.md`](../../../AGENTS.md): commands, structure and conventions (routes, errors, translations, entities, list responses, auth, images).
- [`.agents/rules/git-workflow.md`](../../../../../.agents/rules/git-workflow.md): branch first, then stop without committing.

Paths below are relative to `apps/backend`.

## 1. Branch

Update `main` and create a branch before the first edit (`feat/backend-…`, or `fix/fm-bug-NN-…` for a seeded bug). See the git-workflow rule.

## 2. Understand the change

- **Seeded code:** run `rg -n "FM-(BUG|FLAKE)-\d+" src`. If the code you'd touch carries a marker and the task isn't that bug, work around it and say so. If the task *is* that bug, fix only that and keep the tag in the branch name.
- **Find the existing pattern:** pick the closest existing feature and read it top to bottom (controller → service → repository → entity → DTO). The storefront side lives in `controller/api`, the back office in `controller/admin`.
- **Find the client:** the web app calls the API from `apps/web/src/api/foodme.ts` with types in `apps/web/src/types/index.ts`; the admin from `apps/admin/src/providers` and `apps/admin/src/api/*-api.js`. Note which fields they read, so the contract doesn't break silently.
- Write down, before coding: the HTTP method and path, request and response shape, status codes and error messages, who may call it (public / customer / admin), and whether the schema changes. Ask the user only about product decisions you can't infer (e.g. what a new status means).

## 3. Implement bottom up

Follow the checklist in `backend-feature-development.md` in order: migration → entity → repository → DTOs → service → controller → security/routing → images → config. Things that are easy to miss:

- **Migration:** next free number after the files in `src/main/resources/db/migration`. Never edit `V1`–`V<last>`.
- **Test seed:** H2 builds its schema from the entities, not Flyway. A new non-null column also needs values in `src/test/resources/data.sql`, or the test context fails to start.
- **Security:** a new path needs a matcher in `SecurityConfig`; `/admin/**` only checks that a token exists.
- **Image fields:** add the DTO to `ImageUrlResponseAdvice`.
- **New env settings:** `${ENV_VAR:default}` in `application.properties`, plus `render.yaml` if production needs it.

## 4. Build and test

`gradle/wrapper/gradle-wrapper.jar` isn't in the repo, so `./gradlew` doesn't work. Use a local Gradle 8.6 + JDK 17 if there is one (`gradle test`), otherwise the same Docker image the Dockerfile builds with. From `apps/backend` in Git Bash:

```sh
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W)":/app -v foodme-gradle-cache:/home/gradle/.gradle \
  -w /app gradle:8.6-jdk17 gradle build --no-daemon --console=plain
```

(`pwd -W` gives a Windows path Docker Desktop can mount; on macOS/Linux use `$(pwd)`. The named volume caches dependencies between runs. Swap `build` for `test --tests 'DishControllerTest'` to run one class.)

Add or update tests with the `backend-test` skill. Expected failures in the full run: the `FM-FLAKE-NN` tests may fail intermittently, and that's not caused by your change. Anything else red is yours to explain.

## 5. Run it against Postgres and try it

Tests run on H2, which isn't Postgres. Run the app for real once when you add a migration, a native/complex query, or anything the frontends will call.

1. **Postgres** (user/password/db `foodme`, as `application.properties` expects):
   ```sh
   docker run -d --name foodme-pg -e POSTGRES_DB=foodme -e POSTGRES_USER=foodme \
     -e POSTGRES_PASSWORD=foodme -p 5432:5432 postgres:16
   ```
   Reuse it next time with `docker start foodme-pg`. If a migration fails half-way, fix it and recreate the container (`docker rm -f foodme-pg`) rather than patching `flyway_schema_history`.
2. **Backend** on `:8081`: `gradle bootRun` locally, or in Docker:
   ```sh
   MSYS_NO_PATHCONV=1 docker run --rm -p 8081:8081 -v "$(pwd -W)":/app -v foodme-gradle-cache:/home/gradle/.gradle \
     -e DB_HOST=host.docker.internal -w /app gradle:8.6-jdk17 gradle bootRun --no-daemon --console=plain
   ```
   Run it in the background and wait for `Started FoodmeBackendApplication`. Startup errors to read first: Flyway validation (a migration problem) and `Schema-validation: missing column` (entity and migration disagree).
3. **Call the endpoint** with curl, or through Swagger UI at `http://localhost:8081/swagger-ui.html`. Every `/api/**` and `/admin/**` call has 200–1500 ms simulated latency outside the test profile — that's intentional. Tokens:
   ```sh
   # admin
   curl -s -X POST localhost:8081/admin/auth/login -H 'Content-Type: application/json' \
     -d '{"username":"admin","password":"admin123"}'
   # customer: register a unique email, read "token"
   curl -s -X POST localhost:8081/api/auth/register -H 'Content-Type: application/json' \
     -d '{"fullName":"Dev Test","email":"dev-'$RANDOM'@example.com","phoneNumber":"+37491234567","password":"secret123"}'
   ```
   Check the happy path, one validation error (400 with a readable `message`), not found (404) and no token (401) where it applies. Check the request DTOs if a payload above is rejected — they are the source of truth for field names.
4. **Frontends,** if they use the endpoint: start the web (`npm run dev` in `apps/web`) or admin app against `:8081` and click through the affected screen, or run its E2E spec.
5. Stop what you started (`docker stop foodme-pg`, the bootRun process).

## 6. Report and stop

Leave the changes uncommitted and report:
- branch name and files changed, grouped by layer
- the API change: method, path, request/response, status codes; and whether it's a breaking change for web or admin
- migrations added and whether they ran on Postgres
- how it was verified: build result (with any `FM-FLAKE` failures named), the curl/Swagger checks, frontend checks
- anything left open, such as frontend updates not done or a seeded bug that got in the way

Commit, push or open a PR only when the user asks (`ship-pr`).

# Backend: architecture and adding features

Applies to every change in `apps/backend`. This rule covers how the parts fit together and the steps for adding a feature. It doesn't repeat the other files:
- Root `AGENTS.md`: seeded `FM-BUG`/`FM-FLAKE` code, intentional demo behaviour (latency, heartbeat, `/api/debug/boom`) and free-tier limits.
- `apps/backend/AGENTS.md`: commands, structure (layering, security, database, observability) and conventions (routes, errors, translations, entities, list responses, auth, images, tests). The checklist below names those conventions instead of repeating them.

## Stack and dependencies

- Spring Boot 3.3 on Java 17, built with Gradle (`build.gradle`). Starters used: web, data-jpa, security, validation, actuator.
- `com.auth0:java-jwt` for tokens and BCrypt for passwords.
- springdoc-openapi for Swagger, Lombok for boilerplate.
- Micrometer Prometheus, logstash-logback JSON logs, a Loki appender, and Sentry (GlitchTip).
- Before adding a dependency, check that Spring Boot or an existing library doesn't already cover it. Every jar adds memory on the 512 MB instance. Let the Spring dependency-management plugin choose versions where it can. Add a one-line comment in `build.gradle` saying why the library is needed, as the observability libraries do.

## Request flow

```
HTTP → SimulatedLatencyConfig → HttpLoggingFilter → JwtAuthenticationFilter
     → SecurityConfig matchers (first match wins)
     → Controller (controller/api or controller/admin)
     → Service (business rules, @Transactional, throws NotFound/BadRequest)
     → Repository (Spring Data JPA; custom queries in *RepositoryImpl)
     → Entity (model/) → Postgres schema "foodme"
Response ← DTO.mapEntityToDto(...) ← ImageUrlResponseAdvice
Errors   ← GlobalExceptionHandler → ErrorResponseDto
```

Each feature belongs to one of the two controller groups described in `AGENTS.md`. They serve different clients and have their own services:

| | `controller/api` (`/api/**`) | `controller/admin` (`/admin/**`) |
|---|---|---|
| Used by | `apps/web` (`foodmeApi`) | `apps/admin` (`dataProvider`, `api/*-api.js`) |
| Services | `ChefService`, `DishService`, `OrderService`, … | `AdminChefService`, `AdminDishService`, `AdminOrderService` |

**`/admin/**` checks only that a token is present, not its role.** A customer JWT passes too. New admin endpoints that must be admin-only need an explicit role check, such as `.hasRole("ADMIN")` in `SecurityConfig`. Changing the existing matchers is a behaviour change, so do it in its own PR.

## Adding a feature: checklist

Work from the bottom up and keep each layer thin.

1. **Migration.** Add `V<next>__<what>.sql` (see *Entities* in `AGENTS.md`).
   - Never edit a migration that has already shipped, because Flyway checksums would fail on deployed databases.
   - Seed data inserted by migrations uses explicit IDs (see `V3__more_menu_items.sql`). Keep them clear of the IDs the sequences generate.
2. **Entity** (`model/`), following *Entities* and *Translations* in `AGENTS.md`.
   - Give every field an explicit `@Column(name = "...")`.
   - Statuses are plain `String`s with the allowed values in a comment (`/** ACTIVE | INACTIVE */`), not Java enums. Keep that unless you're changing it everywhere.
3. **Repository** (`repository/`).
   - Use derived query methods first (`findByStatusOrderByPriorityIndexAscIdAsc`).
   - For dynamic search, use the `DishSearchRepository` / `DishSearchRepositoryImpl` pattern.
   - Paginate with `PageRequest.of(page, size)`.
4. **DTOs** (`dto/`).
   - Use a Lombok `@Getter @Setter @NoArgsConstructor @AllArgsConstructor` class with a `static mapEntityToDto(Entity)` that returns `null` for a `null` input.
   - Never return entities from controllers. Entities have lazy collections and cycles, and `open-in-view` is off.
   - For translated fields (see *Translations*), the admin uses flat `nameEn`/`nameHy`/`nameRu`, while the storefront reads `List<NameDtoTranslation>` through `translate()`. Match the client that will use the endpoint.
   - Request DTOs get bean-validation annotations, and the controller takes `@Valid @RequestBody`. The first field error is shown to users, so make the messages readable.
5. **Service** (`service/`).
   - Use constructor injection with `private final` fields, not field `@Autowired`.
   - Put business rules here, not in controllers.
   - Use `@Transactional` on writes and `@Transactional(readOnly = true)` on reads that touch lazy relations.
   - Report failures with the exceptions described in *Errors*. Never return `null` or build error responses yourself.
   - Use Java `record`s for internal multi-value results (`ChefService.ActiveChefsResult`).
6. **Controller**, following *Routes* and *List responses* in `AGENTS.md`.
   - Paginated lists take `@RequestParam(defaultValue = "0") int page` and `size`.
   - Get the current customer from `Authentication authentication` → `authentication.getName()` (their email).
7. **Security and routing.**
   - Add `SecurityConfig` matchers for any path the existing ones don't cover, keeping the first-match order in mind.
   - For a new top-level prefix, also add it to the `startsWith(...)` exclusions in `SpaWebConfig`. Today those are `api/`, `admin/`, `actuator/`, `swagger-ui` and `v3/`.
8. **Images.** `ImageUrlResponseAdvice` makes image paths absolute only for the DTO classes it lists with `instanceof`. Add a branch there for any new DTO with an image field, or the frontends get a relative path.
9. **Config.**
   - Read new settings from `application.properties` as `${ENV_VAR:default}`, and add the variable to `render.yaml` if production needs it.
   - Disable background, latency or external behaviour in `application-test.properties`.
10. **Tests** (see below), then `./gradlew build`.
11. **Frontends.** Update the web `foodmeApi` and `src/types`, or the admin `dataProvider` / `api/*-api.js`. Renaming or reshaping a response field breaks them silently, because nothing checks the contract at compile time.

## Shared with the frontends

These are duplicated across apps, so change them together:

- **Order status flow:** `NEW → ACCEPTED | REJECTED`, then `ACCEPTED → DELIVERED | REJECTED`. It lives in `AdminOrderService.ALLOWED_TRANSITIONS`, `apps/admin/src/constants/OrderStatus.jsx` and the web status maps (`STATUS_LABEL` in `pages/Orders`, the map in `pages/Tracking`).
- **`ErrorResponseDto.message`:** the web `ApiRequestError` and the admin notifications show it as-is.
- **Response shapes and `hy`/`am` language codes:** see *List responses* and *Translations*.

## Tests

On top of the setup described in *Tests* in `AGENTS.md`:

- Add one MockMvc test class per feature (`<Feature>ControllerTest`, following `ChefControllerTest`), with `jsonPath` assertions on the real response shape.
- Cover the happy path, validation (400 with `message`), not found (404), and for protected endpoints auth (401 without a token, 403 with the wrong role).
- When you add rows to `data.sql`, don't change existing rows other tests count on (for example, "2 active chefs").
- H2 isn't Postgres. Native SQL or Postgres-only functions can behave differently, so prefer JPQL or derived queries.
- Make tests independent of order and time. `FM-FLAKE-02/03/04` show what to avoid: shared mutable state, timing assumptions and ordering assumptions.

## Don't

- Don't touch the seeded-bug files (`OrderService`, `ChefService`, `OrderDto`, `CreateOrderDishDto`) or demo behaviour unless that's the task. See root `AGENTS.md`.
- Don't add eager startup work or in-memory caches that grow without bound. The free-tier limits are in root `AGENTS.md`.
- Don't add new secrets to `application.properties`. The JWT secret and internal API key there are demo values. New secrets come from environment variables with no default.
- Don't bind request bodies to entities in new endpoints. Existing admin `PUT`s do (`@RequestBody Chef`), which ties the API to the DB model and lets clients overwrite fields. Use a request DTO.
- Don't log request bodies or tokens yourself. `HttpLoggingFilter` already does it, with secrets redacted.

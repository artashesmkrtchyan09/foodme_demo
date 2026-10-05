# Backend: architecture and adding features

Applies to every change in `apps/backend`. Commands, the folder layout and the core conventions are in `apps/backend/AGENTS.md`. This rule explains how the parts fit together and what to check when adding a feature.

## Stack and dependencies

- Spring Boot 3.3 on Java 17, built with Gradle (`build.gradle`). Starters used: web, data-jpa, security, validation, actuator.
- Postgres with Flyway migrations. Tests use H2 in Postgres mode.
- `com.auth0:java-jwt` for tokens and BCrypt for passwords.
- springdoc-openapi for Swagger, Lombok for boilerplate.
- Micrometer Prometheus, logstash-logback JSON logs, a Loki appender, and Sentry (GlitchTip).
- Before adding a dependency, check that Spring Boot or an existing library doesn't already cover it. Every jar adds memory on Render's 512 MB instance. Let the Spring dependency-management plugin choose versions where it can. Add a one-line comment in `build.gradle` saying why the library is needed, as the observability libraries do.

## Request flow

```
HTTP → SimulatedLatencyConfig (200–1500 ms, not in tests)
     → HttpLoggingFilter (logs request/response, redacts secrets)
     → JwtAuthenticationFilter (Bearer token → ROLE_<role>)
     → SecurityConfig matchers
     → Controller (controller/api or controller/admin)
     → Service (business rules, @Transactional, throws NotFound/BadRequest)
     → Repository (Spring Data JPA; custom queries in *RepositoryImpl)
     → Entity (model/) → Postgres schema "foodme"
Response ← DTO.mapEntityToDto(...) ← ImageUrlResponseAdvice rewrites image URLs
Errors   ← GlobalExceptionHandler → ErrorResponseDto
```

There are two separate API surfaces. Pick the right one for every feature:

| | Public / customer API | Admin API |
|---|---|---|
| Package | `controller/api` | `controller/admin` |
| Prefix | `/api/**` | `/admin/**` |
| Auth | public, except `/api/customer/**` and `POST /api/order` (`ROLE_CUSTOMER`) | any valid JWT, except `/admin/auth/login` and `GET /admin/dish/**` |
| Used by | `apps/web` (`foodmeApi`) | `apps/admin` (`dataProvider`, `api/*-api.js`) |
| Services | `ChefService`, `DishService`, `OrderService`, … | `AdminChefService`, `AdminDishService`, `AdminOrderService` |

**`/admin/**` checks only that a token is present, not its role.** A customer JWT passes too. New admin endpoints that must be admin-only need an explicit role check, such as `.hasRole("ADMIN")` in `SecurityConfig`. Changing the existing matchers is a behaviour change, so do it in its own PR.

## Adding a feature: checklist

Work from the bottom up and keep each layer thin.

1. **Schema.**
   - Add `src/main/resources/db/migration/V<next>__<what>.sql`. Never edit a migration that has already shipped, because Flyway checksums would fail on deployed databases.
   - New tables go in schema `foodme`, with a sequence `foodme.<table>_id_seq`.
   - Follow the translation-column pattern for user-visible text: `name_en`, `name_am`, `name_ru`.
   - Seed or demo data inserted by migrations uses explicit IDs (see `V3__more_menu_items.sql`). Keep them clear of the IDs the sequences generate.
2. **Entity** (`model/`).
   - `@Entity @Table(name = "...", schema = "foodme") @Getter @Setter`.
   - Use a sequence ID with `allocationSize = 1`, and an explicit `@Column(name = "...")` for every field.
   - Statuses are plain `String`s with the allowed values in a comment (`/** ACTIVE | INACTIVE */`), not Java enums. Keep that unless you're changing it everywhere.
   - `ddl-auto=validate` fails startup on any mismatch between the entity and the migration.
3. **Repository** (`repository/`).
   - Use derived query methods first (`findByStatusOrderByPriorityIndexAscIdAsc`).
   - For dynamic search, use the `DishSearchRepository` / `DishSearchRepositoryImpl` pattern.
   - Paginate with `PageRequest.of(page, size)`.
4. **DTOs** (`dto/`).
   - Use a Lombok `@Getter @Setter @NoArgsConstructor @AllArgsConstructor` class.
   - Add a `static mapEntityToDto(Entity)` that returns `null` for a `null` input.
   - Never return entities from controllers. Entities have lazy collections and cycles, and `open-in-view` is off.
   - Translated fields: entity `...Am` maps to DTO `...Hy`. Expose them flat (`nameEn` / `nameHy` / `nameRu`, as the admin uses) or as `List<NameDtoTranslation>` with `lang` set to `en`, `hy` or `ru` (as the storefront uses, read by `translate()` in web).
   - Request DTOs get bean-validation annotations (`@NotBlank`, `@Size`, `@Email`, …), and the controller takes `@Valid @RequestBody`. The first field error becomes the 400 `message` shown to users, so make the messages readable.
5. **Service** (`service/`).
   - Use constructor injection with `private final` fields; that's the house style, no `@Autowired` on fields.
   - Put business rules here, not in controllers.
   - Use `@Transactional` on writes and `@Transactional(readOnly = true)` on reads that touch lazy relations.
   - Throw `NotFoundException("<Thing> " + id + " not found")` or `BadRequestException("<why>")`. Don't return `null` or build error responses yourself.
   - Use Java `record`s for internal multi-value results (`ChefService.ActiveChefsResult`).
6. **Controller.**
   - `@RestController @RequestMapping(ControllerUtil.<CONSTANT>)`. Add the constant to `utils/ControllerUtil` and never hard-code a prefix.
   - Paginated lists take `@RequestParam(defaultValue = "0") int page` and `size`. Admin lists return `AdminListResponseDto<T>` (`{ list, count }`), because the admin `dataProvider` depends on that shape.
   - Get the current customer from `Authentication authentication` → `authentication.getName()` (their email).
7. **Security.** Add or adjust matchers in `SecurityConfig` for any new path that isn't covered by the rules above. Matcher order matters, because the first match wins.
8. **New top-level prefix** (anything other than `/api`, `/admin`, `/actuator`, `/swagger-ui` or `/v3`): add it to the `startsWith(...)` exclusions in `SpaWebConfig`. Otherwise the SPA fallback serves `index.html` for it.
9. **Images:** store them through `ImageService` / `ImageController` (`/api/images/**`). `ImageUrlResponseAdvice` makes image paths absolute, but only for the DTO classes it lists with `instanceof`. Add a branch there for any new DTO that has an image field, or the frontends get a relative path.
10. **Config:** read new settings from `application.properties` as `${ENV_VAR:default}`, and add the variable to `render.yaml` if it must be set in production. Disable or neutralise background, latency or external behaviour in `application-test.properties`.
11. **Tests** (see below), then `./gradlew build`.
12. **Frontends:** update the web `foodmeApi` and `src/types`, or the admin `dataProvider` / `api/*-api.js`. Changing a response field name or shape breaks them silently, because nothing checks the contract at compile time.

## Rules shared with the frontends

These are duplicated across apps, so change them together:

- **Order status flow** `NEW → ACCEPTED | REJECTED`, then `ACCEPTED → DELIVERED | REJECTED`. It's defined in `AdminOrderService.ALLOWED_TRANSITIONS`, `apps/admin/src/constants/OrderStatus.jsx` (`OrderStatusTransitions`) and the web status maps (`STATUS_LABEL` in `pages/Orders`, the status map in `pages/Tracking`).
- **Error shape** `ErrorResponseDto.message`: the web `ApiRequestError` and react-admin notifications show it as-is.
- **List shapes:** admin uses `{ list, count }`. Storefront endpoints use named lists (`exploreChefResponseDtoList`, `dishDtoList`) plus `count`.
- **Language codes:** `hy` in DTOs and the frontends, `am` in DB columns.

## Tests

- Add a MockMvc test per endpoint in `src/test/java/am/foodme/backend/<Feature>ControllerTest.java`, following `ChefControllerTest`: `@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")`, with `jsonPath` assertions on the real response shape.
- Cover the happy path, validation errors (400 with `message`), not found (404), and auth (401 without a token, 403 with the wrong role) for protected endpoints.
- Test data lives in `src/test/resources/data.sql`, because the H2 schema is built from entities, not migrations. Add rows for new tables or columns there. Don't change existing rows other tests depend on (for example, counts like "2 active chefs").
- H2 isn't Postgres. Native SQL or Postgres-only functions may pass locally on Postgres and fail in tests, or the reverse. Prefer JPQL or derived queries.
- Make tests independent of order and time. `FM-FLAKE-02/03/04` in `OrderControllerTest` and `DishControllerTest` show what to avoid: shared mutable state, timing assumptions and ordering assumptions.

## Don't

- Don't touch `FM-BUG-NN` code (`OrderService`, `ChefService`, `OrderDto`, `CreateOrderDishDto`) unless the task is that bug.
- Don't remove or "optimise" `SimulatedLatencyConfig`, `FlakyHeartbeatJob` or `/api/debug/boom`. They're intentional.
- Don't lower the free-tier settings (`server.tomcat.threads.max`, JVM flags in the `Dockerfile`, Flyway retries), or add eager startup work or in-memory caches that grow without bound.
- Don't add new secrets to `application.properties`. The JWT secret and internal API key there are demo values. New secrets come from environment variables with no default.
- Don't bind request bodies directly to entities in new endpoints. Existing admin `PUT`s do (`@RequestBody Chef`), which ties the API to the DB model and lets clients overwrite fields. New endpoints use a request DTO.
- Don't log request bodies or tokens yourself. `HttpLoggingFilter` already logs them with secrets redacted.

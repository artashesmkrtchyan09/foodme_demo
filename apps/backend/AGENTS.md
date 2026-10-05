# AGENTS.md — backend

Spring Boot 3.3 / Java 17 / Gradle API for FoodMe. See the repo-root `AGENTS.md` for the overall architecture, the seeded `FM-BUG` / `FM-FLAKE` markers, and deployment.

**Adding a feature?** Follow `.agents/rules/backend-feature-development.md`. It covers the request flow, a step-by-step checklist and the contracts shared with the frontends, and builds on the conventions below without repeating them.

## Commands

Run from `apps/backend`:
```
./gradlew build                       # compile + tests (CI)
./gradlew test
./gradlew test --tests DishControllerTest
./gradlew test --tests 'OrderControllerTest.someMethod'
./gradlew bootRun                     # serves on :8081 (or $PORT); needs Postgres on localhost:5432, db/user/pass foodme
./gradlew bootJar -x test
```
Swagger UI is at `/swagger-ui.html` and the OpenAPI spec is at `/v3/api-docs`.

## Structure

- **Layering:** controller → service → repository under `am.foodme.backend`, with two controller groups:
  - `controller/api` is the public/customer API under `/api/**`. `/api/customer/**` and `POST /api/order` require `ROLE_CUSTOMER`.
  - `controller/admin` is the admin API under `/admin/**`. It is JWT-protected, except `/admin/auth/login` and `GET /admin/dish/**`.
- **Security:** stateless JWT (`security/JwtService`, `JwtAuthenticationFilter`, `SecurityConfig`). CORS defaults to `*`.
- **Database:** Postgres schema `foodme`, managed by Flyway migrations in `src/main/resources/db/migration`. `DatabaseUrlEnvironmentPostProcessor` (registered in `META-INF/spring.factories`) turns a `postgresql://…` `DATABASE_URL` into JDBC settings.
- **Observability:** Micrometer Prometheus metrics are at `/actuator/prometheus`. Logs are JSON via logback (`logback-spring.xml`) and are shipped to Loki only when `LOKI_PUSH_URL` is set. The Sentry SDK reports to GlitchTip via `SENTRY_DSN`. `HttpLoggingFilter` logs `/api/**` and `/admin/**` requests and responses with secrets redacted.
- **Free-tier limits:** the JVM flags in `Dockerfile`, `server.tomcat.threads.max=32` and the Flyway connect retries are there to fit Render's 512 MB / 0.1 CPU instance. Don't remove them casually.

## Conventions

- **Routes:** controllers build their paths from the constants in `utils/ControllerUtil` (`API_*_CONTROLLER`, `ADMIN_*_CONTROLLER`). Add a constant there rather than hard-coding a path. If you add a new top-level prefix, update the paths `SpaWebConfig` excludes and the matchers in `SecurityConfig`.
- **Errors:** throw `NotFoundException` or `BadRequestException` from services. `GlobalExceptionHandler` turns them into an `ErrorResponseDto` (`timestamp, status, error, message, path, trace`). Bean-validation failures return 400 with the first field error as the message. The frontends show `message` to the user.
- **Translations:** entities store translated text as separate columns (`nameEn` / `nameAm` / `nameRu`, also `portion*` and `description*`, mapped to `name_en`, `name_am`, …). DTOs either expose them flat or as `List<*DtoTranslation>` with `lang` set to `en`, `hy` or `ru`. Note that Armenian is `Am` in column names but `hy` in DTOs.
- **Entities:** Lombok `@Getter`/`@Setter`, explicit `@Table(schema = "foodme")`, and IDs from named sequences (`foodme.<table>_id_seq`, `allocationSize = 1`). Every schema change needs a new Flyway migration `V<n>__*.sql`, because `ddl-auto=validate` makes startup fail on any mismatch.
- **List responses:** paginated endpoints take `page` (0-based) and `size`, and return DTOs such as `{ dishDtoList, count }` or `{ list, count }` (`AdminListResponseDto`). The admin `dataProvider` depends on the `{ list, count }` shape.
- **Auth:** `JwtService` issues tokens with a `role` claim, and `JwtAuthenticationFilter` maps it to `ROLE_<role>`. Customers get `CUSTOMER`; admin accounts come from the `admin` table, where `V1__init.sql` seeds `admin` with role `ADMIN`.
- **Images:** chef and dish pictures live in Postgres and are served by `ImageController` at `/api/images/**`. `ImageUrlResponseAdvice` rewrites image URLs in responses. On first start, `ImageSeedRunner` loads the images in `resources/img-seed/`.

## Tests

How to write and structure tests (data isolation, auth helpers, assertions, seeded bugs) is in `.agents/rules/backend-tests.md`, which loads when a file in `src/test` is opened. This section covers only the test setup.

- Tests in `src/test/java/am/foodme/backend` are `@SpringBootTest` + `@AutoConfigureMockMvc` + `@ActiveProfiles("test")`.
- The `test` profile (`application-test.properties`) uses in-memory H2 in Postgres mode, disables Flyway, builds the schema with Hibernate `create-drop`, and loads data from `src/test/resources/data.sql`. Test assertions depend on that seed data. If you add a column, also update `data.sql` where tests need the values.
- The `test` profile also turns off simulated latency, the image seeder, HTTP logging, and `FlakyHeartbeatJob` (`@Profile("!test")`).
- Tests marked `FM-FLAKE-NN` in `OrderControllerTest` and `DishControllerTest` are flaky on purpose.

# ExpoJuy 2026 — Backend Agent Guide

Operating manual for AI agents working in this repository. Read this before
touching code. For recurring procedures see `.agents/skills/` (index at the
bottom of this file).

## Project Overview

REST API for the ExpoJuy 2026 platform. Today it is an **authentication and
user-management service only** — it exposes JWT login, account self-service and
admin user CRUD. There is **no ExpoJuy business domain in this repository yet**
(no exhibitors, stands, agenda, tickets or venue entities). All the fair's
content currently lives as static data in the frontend repo.

Consumed by `https://github.com/jlopezjuy/expojuy2026` (Astro frontend), which
calls exactly two endpoints: `POST /api/authenticate` and `GET /api/account`.

## Tech Stack

Verified against `.yo-rc.json`, `package.json` and `server/package.json`.

| Concern     | Actual technology                                               | Version                         |
| ----------- | --------------------------------------------------------------- | ------------------------------- |
| Generator   | JHipster + **`generator-jhipster-nodejs` blueprint**            | 9.2.0 / 4.0.0                   |
| Runtime     | Node.js                                                         | `>=24.18.0`                     |
| Framework   | NestJS (`@nestjs/core`, `platform-express`)                     | 11.1.28                         |
| ORM         | TypeORM                                                         | 0.3.20                          |
| Auth        | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `bcrypt`     | 11.0.2 / 11.0.5 / 4.0.1 / 6.0.0 |
| Validation  | `class-validator`, `class-transformer`                          | 0.15.1 / 0.5.1                  |
| API docs    | `@nestjs/swagger` + `swagger-ui-express`                        | 11.4.6 / 5.0.1                  |
| Databases   | `mysql2` (prod), `sqlite3` (test/default), mariadb driver (dev) | 3.23.1 / 6.0.1                  |
| Tests       | Jest + ts-jest + supertest                                      | 30.4.2 / 29.4.11 / 7.2.2        |
| Lint/format | ESLint 10 flat config + Prettier                                | 10.7.0 / 3.9.5                  |

> **This is NOT a Spring Boot / Java project.** There is no `pom.xml`, no
> `build.gradle`, no Liquibase, no MapStruct, no Spring Security. If you are
> looking for those, you are in the wrong mental model.

Not used despite being installed: Consul, Redis, Elasticsearch, Kafka,
RabbitMQ, GraphQL, WebSockets, OAuth2. Eureka and Spring Cloud Config clients
are present as dependencies but disabled (`eureka.client.enabled: false` in
`server/src/config/application.yml`).

## Architecture

npm workspace monorepo with a single workspace, `server`. Classic JHipster
layered architecture — **not** hexagonal, not Clean Architecture, no CQRS, no
DDD aggregates, no event bus.

```text
HTTP Request
   ↓
web/rest/*.controller.ts        guards, Swagger decorators, pagination headers
   ↓
service/*.service.ts            business rules, throws HttpException
   ↓
service/mapper/*.mapper.ts      Entity <-> DTO (hand-written, no MapStruct)
   ↓
TypeORM Repository              injected with @InjectRepository(Entity)
   ↓
Database                        MySQL / MariaDB / SQLite depending on BACKEND_ENV
```

Wiring is per-feature NestJS modules under `server/src/module/`, imported by
`server/src/app.module.ts`.

## Important Directories

All paths relative to repository root.

| Path                         | Responsibility                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `server/src/domain/`         | TypeORM entities. `user.entity.ts`, `authority.entity.ts`                              |
| `server/src/domain/base/`    | `BaseEntity` (audit columns), `PageRequest`/`Page`/`Sort` pagination types             |
| `server/src/service/`        | Business logic — `auth.service.ts`, `user.service.ts`                                  |
| `server/src/service/dto/`    | Request/response DTOs with `class-validator` + `@ApiProperty`                          |
| `server/src/service/mapper/` | Manual entity↔DTO mappers                                                              |
| `server/src/web/rest/`       | NestJS controllers (JHipster calls them "resources")                                   |
| `server/src/module/`         | NestJS modules wiring controllers + providers                                          |
| `server/src/security/`       | JWT strategy, `AuthGuard`, `RolesGuard`, `@Roles`, `@AuthUser`, bcrypt helpers         |
| `server/src/migrations/`     | TypeORM migration classes (registered by hand — see below)                             |
| `server/src/config/`         | `application.yml` + `application-{dev,test,prod}.yml`                                  |
| `server/src/client/`         | `HeaderUtil` (JHipster response headers), `LoggingInterceptor`                         |
| `server/src/orm.config.ts`   | Per-environment datasource + **entity and migration registries**                       |
| `server/test/`               | Jest unit specs (`*.spec.ts`)                                                          |
| `server/e2e/`                | Supertest integration specs (`*.e2e-spec.ts`) + its own Jest config                    |
| `server/scripts/`            | `copy-resources.ts` (copies YAML into `dist/`), `entrypoint.sh`                        |
| `docker/`                    | JHipster-generated compose files (`app.yml`, `mysql.yml`, `services.yml`, `sonar.yml`) |

The **production deployment stack is not in this repository** — it lives in the
sibling `../docker/` directory (`docker-compose.yml`, `backend/Dockerfile`,
`frontend/nginx.conf`), which is **not under version control**.

## Domain Model

Complete. There is nothing else.

```text
User (table: jhi_user)                    Authority (table: jhi_authority)
  id            PK, generated               name  PK, string
  login         unique
  email                                   RoleType enum (security/role-type.ts)
  password      bcrypt, @Exclude()          ROLE_USER
  firstName?    lastName?                   ROLE_ADMIN
  activated?    default false               ROLE_ANONYMOUS
  langKey?      default 'en'
  imageUrl?
  activationKey?  resetKey?  resetDate?
  authorities   ManyToMany -> Authority (@JoinTable)
  + BaseEntity: createdBy, createdDate, lastModifiedBy, lastModifiedDate
```

Seeded by `server/src/migrations/1570200490072-SeedUsersRoles.ts`: users
`system`, `anonymoususer`, `admin`, `user` — each with password equal to its
login. Development credentials only.

`UserService.flatAuthorities()` converts `authorities` from `Authority[]` to
`string[]` before mapping to DTO; `convertInAuthorities()` reverses it on save.
Keep that asymmetry in mind — a `UserDTO.authorities` is an array of strings.

## API Surface

| Method + path                                                         | Guard                                     | Controller                       |
| --------------------------------------------------------------------- | ----------------------------------------- | -------------------------------- |
| `POST /api/authenticate`                                              | public                                    | `user.jwt.controller.ts`         |
| `POST /api/register`                                                  | public                                    | `account.controller.ts`          |
| `GET /api/account`                                                    | `AuthGuard`                               | `account.controller.ts`          |
| `POST /api/account`                                                   | `AuthGuard`                               | `account.controller.ts`          |
| `POST /api/account/change-password`                                   | `AuthGuard`                               | `account.controller.ts`          |
| `GET /api/activate`                                                   | `AuthGuard` + `ROLE_ADMIN`                | **not implemented — throws 500** |
| `POST /api/account/reset-password/init`                               | `AuthGuard`                               | **not implemented — throws 500** |
| `POST /api/account/reset-password/finish`                             | `AuthGuard`                               | **not implemented — throws 500** |
| `GET /api/users`                                                      | **public**                                | `public.user.controller.ts`      |
| `GET /api/authorities`                                                | public (returns `[]` when anonymous)      | `public.user.controller.ts`      |
| `GET/POST/PUT /api/admin/users`, `GET/DELETE /api/admin/users/:login` | `AuthGuard` + `RolesGuard` + `ROLE_ADMIN` | `user.controller.ts`             |
| `GET /management/info`                                                | public                                    | `management.controller.ts`       |

Swagger UI is served at `/api/v2/api-docs` (`jhipster.swagger.path`).

Cross-cutting conventions:

- **Pagination** — read `req.query.page|size|sort` into a `PageRequest`, translate
  to `{ skip, take, order }`, then call `HeaderUtil.addPaginationHeaders`, which
  sets `X-Total-Count` and RFC5988 `Link`. See `user.controller.ts:44-50`.
- **Response headers** — creation/update/deletion set
  `X-expoJujuy-alert` / `X-expoJujuy-params` via `HeaderUtil`. The app name comes
  from `jhipster.clientApp.name`.
- **Errors** — `throw new HttpException(message, HttpStatus.X)` from services.
  Global `ValidationPipe` in `main.ts` collapses every validation failure into a
  generic `BadRequestException('Validation error')`.
- **CORS** — enabled globally and unrestricted (`{ cors: true }` in `main.ts:17`).
- **Serialization** — `ClassSerializerInterceptor` is what strips
  `@Exclude()`-marked fields such as `password`. A controller without it leaks
  password hashes.

## Development Commands

Run from the repository root unless noted.

```bash
npm install                      # installs root + server workspace
npm run start:server             # nodemon + ts-node, watches server/src
npm run build:app                # tsc -p tsconfig.build.json + copy YAML to dist
npm run docker:db:up             # MySQL via docker/mysql.yml
npm run docker:db:down
npm run prettier:format          # repo-wide formatting
```

Environment selection is driven by `BACKEND_ENV` (**not** `NODE_ENV`), read in
`server/.env` and `server/src/orm.config.ts`. Valid values: `dev`, `test`,
`prod`. Any other value falls through to a file-backed SQLite database and logs
an error about the missing `application-{env}.yml`.

Inside `server/`:

```bash
npm run lint                     # eslint .
npm run lint:fix
npm run start:dev                # tsc-watch, runs dist/main.js on success
npm run start:prod               # node dist/main.js
npm run typeorm:migration:run
```

## Testing Commands

Two separate Jest configurations. They do not overlap.

```bash
npm run test:server              # unit: server/test/**/*.spec.ts + any *.spec.ts under src/
                                 # NOTE: `pretest` runs eslint first — lint errors block tests
npm run test:server:e2e          # integration: server/e2e/*.e2e-spec.ts, with coverage
```

- Unit config: the `jest` block in `server/package.json`, `testRegex`
  `(/test/.*|\.(spec))\.(ts)$`.
- E2E config: `server/e2e/jest.e2e.config.json`, `testRegex`
  `(/e2e/.*|\.(e2e-spec))\.(ts)$`, `rootDir: ".."`, 10s timeout.
- Both load `server/e2e/setup.test.js`, which forces `BACKEND_ENV = 'test'` →
  **in-memory SQLite with `synchronize: true`**. Tests never touch MySQL.

Current baseline (verified): unit 4 passed / 2 suites, e2e 17 passed / 3 suites,
lint 0 errors + 4 warnings. Do not regress these.

## Database Changes

TypeORM here is **not** auto-discovering anything. Adding an entity or a
migration requires editing `server/src/orm.config.ts` by hand, at the JHipster
needle comments:

```text
// jhipster-needle-add-entity-to-ormconfig-imports
// jhipster-needle-add-entity-to-ormconfig-entities
// jhipster-needle-add-migration-to-ormconfig-migrations
```

Never delete a needle comment — it is a load-bearing marker.

Schema behaviour by environment:

| `BACKEND_ENV` | Driver  | Database                                               | `synchronize` |
| ------------- | ------- | ------------------------------------------------------ | ------------- |
| `prod`        | mysql2  | `DB_DATABASE` env, default `expoJujuy` on host `mysql` | `false`       |
| `dev`         | mariadb | `expoJujuy` @ `127.0.0.1`, **hardcoded credentials**   | `false`       |
| `test`        | sqlite3 | `:memory:`                                             | `true`        |
| unset/other   | sqlite3 | `target/db/sqlite-dev-db.sql`                          | `false`       |

`migrationsRun: true` always. `CreateTables1570200270081` is not a real DDL
migration — it calls `queryRunner.connection.synchronize()`, so on `dev`/`prod`
the schema is derived from the entity metadata on every boot.

Full procedure: `.agents/skills/expojuy-database-migration.md`.

## Adding a New Feature

The vertical slice this codebase actually uses, in order:

```text
domain/x.entity.ts                 @Entity('table_name'), extends BaseEntity
   ↓
service/dto/x.dto.ts               extends BaseDTO, @ApiProperty + class-validator
   ↓
service/mapper/x.mapper.ts         static fromDTOtoEntity / fromEntityToDTO
   ↓
service/x.service.ts               @InjectRepository(X), throws HttpException
   ↓
web/rest/x.controller.ts           @Controller('api/x'), guards, Swagger, HeaderUtil
   ↓
module/x.module.ts                 TypeOrmModule.forFeature([X]), exports service
   ↓
orm.config.ts                      register entity at the two needles
app.module.ts                      register module at the needle
   ↓
e2e/x.e2e-spec.ts                  supertest against the module, guards mocked
```

Detailed walkthrough with real file references:
`.agents/skills/expojuy-backend-feature.md`.

## Security

- **Login** — `AuthService.login()` looks the user up by `login`, compares with
  `bcrypt.compareSync`, rejects non-activated accounts, then signs a `Payload`
  (`{ id, username, authorities }`). Token is returned as `id_token` and echoed
  in the `Authorization` response header.
- **Verification** — `JwtStrategy` extracts a Bearer token and re-loads the user
  from the database on every request via `AuthService.validateUser`.
- **Authorization** — `@UseGuards(AuthGuard, RolesGuard)` + `@Roles(RoleType.ADMIN)`.
  `RolesGuard` returns `true` when a handler declares no `@Roles` — so
  `RolesGuard` alone protects nothing. Both guards are needed.
- **Passwords** — `bcrypt` with `hash-salt-or-rounds: 10`. `transformPassword()`
  is applied in `UserService.save()` only when `updatePassword === true`.

Known defects — **do not replicate these patterns, and do not "fix" them
silently as a side effect of unrelated work**:

1. `server/src/security/passport.jwt.strategy.ts:15` sets
   `ignoreExpiration: true`. Expired tokens are accepted.
2. Two conflicting token lifetimes: `auth.module.ts` signs with
   `expiresIn: '300s'`, `application.yml` declares
   `token-validity-in-seconds: 86400`.
3. The JWT secret is committed in `server/src/config/application.yml` and
   duplicated in `../docker/.env`. The `JWT_SECRET` variable that
   `../docker/docker-compose.yml` passes to the container **is never read** —
   `config.ts` has no `${JWT_SECRET}` placeholder for it.
4. `server/src/orm.config.ts:45` contains a plaintext database password.
5. `GET /api/users` is unauthenticated and pages the full user table.

See `.agents/skills/expojuy-security-change.md` before changing anything here.

## Coding Conventions

Observed in the existing code; match it rather than importing your own style.

- **Formatting** — Prettier: `printWidth: 140`, `singleQuote: true`,
  `tabWidth: 2`, `arrowParens: avoid`. Enforced on commit by husky + lint-staged.
- **Explicit return types on every method**, including `: any` where the shape is
  loose. This is a deliberate house style, not an oversight.
- **Naming** — files kebab/dot-cased by role: `user.service.ts`,
  `user.dto.ts`, `user.mapper.ts`, `public.user.controller.ts`. Classes
  PascalCase with the role suffix (`UserService`, `UserDTO`, `UserMapper`).
  DTO classes end in `DTO`, uppercase.
- **Imports** — Node builtins, then external packages, then local, separated by
  blank lines. Deep relative paths (`../../service/dto/user.dto`) — there is no
  path alias in use despite `tsconfig-paths` being installed.
- **Logging** — `logger = new Logger('ClassName')` as a class field.
- **Swagger** — every endpoint carries `@ApiOperation` + `@ApiResponse`;
  authenticated ones also carry `@ApiBearerAuth()`. Controllers carry `@ApiTags`.
- **Interceptors** — every controller uses `@UseInterceptors(LoggingInterceptor)`;
  any controller returning entities/DTOs also uses `ClassSerializerInterceptor`.
- Language: identifiers, comments and Swagger descriptions are **English**.

## Cross-Repository Contract

The Astro frontend (`../frontend`) consumes this API. A backend change is not
finished until you have checked the frontend side.

- Base URL is the frontend's `PUBLIC_API_BASE_URL`. In Docker it is empty, so the
  browser hits the same origin and Nginx proxies `/api/` and `/management/` to
  this service (`../docker/frontend/nginx.conf`).
- The frontend's mirror of `UserDTO` lives in `frontend/src/lib/api/auth.ts`. It
  declares `firstName`, `lastName`, `activated`, `langKey` and `authorities` as
  **required**, while this repo declares them optional. Changing optionality or
  field names here breaks that type silently at runtime.
- Only two endpoints are consumed today: `POST /api/authenticate` and
  `GET /api/account`. Anything else you add has no consumer until the frontend
  is changed too.
- If you rename, remove, or change the shape of a consumed field, say so
  explicitly in your final report and point at the frontend files that need
  updating.

## Do Not

- **Do not assume Spring Boot / Java.** Nothing in this repo is JVM-based.
- **Do not remove or move a `jhipster-needle-*` comment.** Adding an entity or
  module means inserting _at_ the needle, leaving it in place.
- **Do not add an entity without registering it** in both needles of
  `orm.config.ts` — TypeORM will not find it and startup will fail obscurely.
- **Do not edit `server/src/migrations/1570200270081-CreateTables.ts` or
  `1570200490072-SeedUsersRoles.ts`.** They have already run against existing
  databases. Add a new migration instead.
- **Do not return an entity from a controller.** Map to a DTO; entities carry the
  bcrypt hash and only `@Exclude()` + `ClassSerializerInterceptor` hides it.
- **Do not weaken a guard** or remove `@Roles` to make something work in
  development. Mock the guard in the test instead (see
  `server/e2e/user.e2e-spec.ts:16-17, 38-41`).
- **Do not change the JWT secret, token lifetime, or guard composition** as a
  side effect of unrelated work.
- **Do not add a dependency** before checking `server/package.json` — several
  installed packages (`eureka-js-client`, `cloud-config-client`,
  `typeorm-encrypted`, `browser-sync-client`) are already unused; do not add to
  the pile.
- **Do not invent ExpoJuy domain entities** and describe them as existing. As of
  this writing the domain is `User` + `Authority`, full stop.
- **Do not use `npm test` at the repo root** — it is a stub that prints
  `INFO: no client test found` and exits 0. Use `npm run test:server`.
- **Do not trust `backend/Dockerfile`** (repo root). It runs
  `npm run --workspace client build` and there is no `client` workspace, so it
  cannot build. The working image definition is `../docker/backend/Dockerfile`.

## Definition of Done

A backend task is finished only when all of the following have actually been run
and reported with their real output:

1. `npm run build:app` — compiles clean.
2. `npm run lint -w server` — **0 errors** (4 pre-existing warnings are the
   accepted baseline).
3. `npm run test:server` — all unit specs pass.
4. `npm run test:server:e2e` — all e2e specs pass.
5. New or changed behaviour is covered by a spec in `server/test/` or
   `server/e2e/`.
6. If an entity, DTO or endpoint changed: the cross-repository impact on
   `../frontend/src/lib/api/` has been checked and reported.
7. Swagger decorators reflect the real request/response shape.

Reporting "it compiles" is not done. If a step fails, say which one and paste the
failure.

## Skills Index

| Skill                                          | Use it when                                              |
| ---------------------------------------------- | -------------------------------------------------------- |
| `.agents/skills/expojuy-backend-feature.md`    | Adding a whole new domain entity end to end              |
| `.agents/skills/expojuy-api-endpoint.md`       | Adding or changing an endpoint on an existing controller |
| `.agents/skills/expojuy-database-migration.md` | Any schema or seed-data change                           |
| `.agents/skills/expojuy-backend-testing.md`    | Writing or fixing unit / e2e specs                       |
| `.agents/skills/expojuy-security-change.md`    | Touching auth, guards, roles or JWT config               |

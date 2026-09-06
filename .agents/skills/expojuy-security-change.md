# expojuy-security-change

## Purpose

Change anything in the ExpoJuy authentication or authorization layer without
silently widening access, breaking the frontend session, or replicating the
defects already present in this code.

## When to Use

- Adding, removing or changing a guard, role or `@Roles` declaration.
- Touching JWT signing, verification, secret or lifetime.
- Changing password hashing, login, registration or account endpoints.
- Making an endpoint public, or making a public endpoint protected.

## Preconditions

Read the whole security layer first. It is nine small files:

```bash
fd . server/src/security --type f
```

- `role-type.ts` — the only three roles: `ROLE_USER`, `ROLE_ADMIN`,
  `ROLE_ANONYMOUS`.
- `guards/auth.guard.ts` — thin wrapper over `@nestjs/passport`'s `AuthGuard('jwt')`.
- `guards/roles.guard.ts` — reads `@Roles` metadata; **returns `true` when the
  handler declares none**.
- `decorators/roles.decorator.ts`, `decorators/auth-user.decorator.ts`.
- `passport.jwt.strategy.ts` — Bearer extraction and per-request user reload.
- `password-util.ts` — bcrypt `encodePassword` / `comparePassword` /
  `transformPassword`.
- `payload.interface.ts` — `{ id, username, authorities? }`.

Then read `server/src/service/auth.service.ts` and
`server/src/module/auth.module.ts`.

## Repository Context

How a request is authorized today:

```text
Authorization: Bearer <jwt>
   ↓
AuthGuard('jwt')  →  JwtStrategy.validate(payload)
   ↓                     ↓
   ↓                 AuthService.validateUser  →  UserService.findByFields({ id })
   ↓                     ↓
   ↓                 request.user = UserDTO (authorities flattened to string[])
   ↓
RolesGuard  →  reflector.get('roles', handler)  →  user.authorities ∩ roles ≠ ∅
   ↓
handler
```

Configuration sources — there are **three**, and they disagree:

| Value | Where | Effective |
| --- | --- | --- |
| JWT secret | `server/src/config/application.yml` → `jhipster.security.authentication.jwt.base64-secret` | **yes** — used by both `auth.module.ts` and `passport.jwt.strategy.ts` |
| `JWT_SECRET` env var | `../docker/docker-compose.yml`, `../docker/.env` | **no** — `config.ts` has no `${JWT_SECRET}` placeholder, so nothing reads it |
| Token lifetime | `auth.module.ts` → `signOptions: { expiresIn: '300s' }` | signing: 5 minutes |
| Token lifetime | `application.yml` → `token-validity-in-seconds: 86400` | declared but unused |

### Known defects — read before you touch anything

These exist today. Do **not** replicate them in new code, and do **not** fix them
as an unannounced side effect of an unrelated task. If a task requires fixing
one, say so explicitly and treat it as its own change.

1. **`passport.jwt.strategy.ts:15` — `ignoreExpiration: true`.** Expired tokens
   are accepted. The 300s `expiresIn` therefore has no enforcement.
2. **Two token lifetimes** (300s vs 86400s), from two config sources.
3. **Secret committed to the repository** and duplicated in `../docker/.env` and
   `../docker/.env.example`.
4. **`JWT_SECRET` env var is dead config** — deploying with a new secret changes
   nothing.
5. **`GET /api/users` is unauthenticated** (`public.user.controller.ts`) and
   pages the full user table. Password hashes are stripped only because
   `ClassSerializerInterceptor` honours `@Exclude()` on `UserDTO.password`.
6. **`UserController.createUser` sets `userDTO.password = userDTO.login`** —
   every admin-created account starts with its username as its password.
7. **Seed accounts** `system`, `admin`, `user`, `anonymoususer` all have their
   login as their password (`1570200490072-SeedUsersRoles.ts`).
8. **CORS is fully open** — `main.ts:17`, `{ cors: true }`, no origin allowlist.
9. `/api/activate` and `/account/reset-password/*` are advertised in Swagger but
   throw `InternalServerErrorException`.

## Workflow

### Changing who can call an endpoint

1. Determine the target access level and apply the full decorator set:

   | Access | Decorators |
   | --- | --- |
   | Public | none |
   | Authenticated | `@UseGuards(AuthGuard)` + `@ApiBearerAuth()` |
   | Role-gated | `@UseGuards(AuthGuard, RolesGuard)` + `@Roles(RoleType.ADMIN)` + `@ApiBearerAuth()` |

2. Verify the controller does not already declare guards at class level — mixing
   class-level and handler-level guards in one controller is not a pattern used
   here.

3. Add an e2e spec that proves the restriction, not just the happy path.

### Adding a role

`RoleType` (`security/role-type.ts`) is a closed enum backed by rows in
`jhi_authority`. A new role needs:

1. A new member in `RoleType`.
2. A seed migration inserting the `Authority` row — see
   `expojuy-database-migration.md`.
3. The enum list in `UserDTO.authorities`'s `@ApiProperty` updated
   (`user.dto.ts:33-39`).

### Touching JWT configuration

The secret is read at **module construction time** in two places:

- `auth.module.ts` → `JwtModule.register({ secret: config[...] })` (signing)
- `passport.jwt.strategy.ts` → `secretOrKey: config[...]` (verification)

Both must resolve to the same value or every token fails verification. If you
make the secret environment-driven, add the `${JWT_SECRET}` placeholder to
`application.yml` — `Config.postProcess()` substitutes `${NAME}` from
`process.env` (`config.ts:67-84`). Changing only `docker-compose.yml` does
nothing.

### Password handling

Always go through `server/src/security/password-util.ts`. `transformPassword`
mutates the object in place and is only invoked from `UserService.save()` when
`updatePassword === true` — a save without that flag stores whatever string is in
`password`, unhashed.

### Frontend session impact

`../frontend/src/lib/auth/session.ts` stores `{ token, user, remember }` under
the `expojuy_auth` key in `localStorage` (remember me) or `sessionStorage`. A 401
on any authenticated request triggers `clearSession()` and a redirect to
`/login` (`client.ts:61-65`). So:

- Shortening the token lifetime, or fixing `ignoreExpiration`, will start logging
  users out. That is correct behaviour, but it is a **visible** change — report it.
- Renaming `id_token` in the login response breaks
  `../frontend/src/components/islands/LoginForm.tsx:63`.
- Changing the `authorities` shape from `string[]` breaks
  `../frontend/src/lib/api/auth.ts`.

## Validation

```bash
npm run build:app
npm run lint -w server
npm run test:server
npm run test:server:e2e
```

Prove the restriction manually:

```bash
BACKEND_ENV=test npm run start:server

# no token -> 401
curl -si localhost:8080/api/admin/users | head -1

# admin token -> 200
TOKEN=$(curl -s -X POST localhost:8080/api/authenticate \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}' | sed 's/.*"id_token":"\([^"]*\)".*/\1/')
curl -si localhost:8080/api/admin/users -H "Authorization: Bearer $TOKEN" | head -1
```

Also confirm no response body contains a `password` field.

## Common Mistakes

- Adding `@Roles` without adding `RolesGuard` — the metadata is ignored.
- Adding `RolesGuard` without `AuthGuard` — `request.user` is undefined.
- Assuming a route on `public.user.controller.ts` is protected. It has no guards.
- Removing `ClassSerializerInterceptor` from a controller — password hashes ship
  to the client.
- Changing the secret in `docker-compose.yml` and believing it took effect.
- Saving a user without `updatePassword: true` and storing a plaintext password.
- Fixing `ignoreExpiration` quietly inside an unrelated task and logging every
  user out with no warning in the report.
- Loosening CORS "temporarily" — it is already fully open; do not make it a
  documented feature.

## Completion Criteria

- All four validation commands pass.
- The new restriction is covered by an e2e spec asserting the **denied** case,
  not only the allowed one.
- No response payload exposes `password`, `activationKey` or `resetKey`.
- Any change in token lifetime, secret handling or session behaviour is called
  out explicitly, with its effect on logged-in frontend users.
- If the change touched one of the known defects above, the report says which and
  confirms it was intentional.

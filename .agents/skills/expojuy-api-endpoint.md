# expojuy-api-endpoint

## Purpose

Add, change or remove a REST endpoint on an existing ExpoJuy controller while
keeping the guard composition, Swagger contract, pagination headers and frontend
consumers correct.

## When to Use

- Adding a route to a controller that already exists in `server/src/web/rest/`.
- Changing a request or response shape of an existing endpoint.
- Changing who is allowed to call an endpoint.

For a brand-new entity and its whole controller, use
`expojuy-backend-feature.md`.

## Preconditions

1. **Check the endpoint does not already exist.** The full surface is small —
   read it:
   ```bash
   rg -n "@(Get|Post|Put|Delete|Patch)\(" server/src/web/rest
   rg -n "@Controller\(" server/src/web/rest
   ```
2. **Check whether the frontend already calls something equivalent.**
   ```bash
   rg -n "apiRequest|/api/" ../frontend/src/lib ../frontend/src/components/islands
   ```
   Today the frontend calls only `POST /api/authenticate` and `GET /api/account`
   (`../frontend/src/lib/api/auth.ts`).
3. **Know which guard combination the controller already declares** — some are
   class-level (`user.controller.ts:25-26`), some per-handler
   (`account.controller.ts:47-48`). Do not mix models within one controller.

## Repository Context

| Controller | Route prefix | Guards | Notes |
| --- | --- | --- | --- |
| `user.jwt.controller.ts` | `api` | none | login only |
| `account.controller.ts` | `api` | per-handler `AuthGuard` | 3 handlers throw 500 (unimplemented) |
| `public.user.controller.ts` | `api` | **none** | `/users` and `/authorities` are public |
| `user.controller.ts` | `api/admin/users` | class-level `AuthGuard` + `RolesGuard` | every handler `@Roles(RoleType.ADMIN)` |
| `management.controller.ts` | `management` | none | `/info`, used by the Docker healthcheck |

Supporting files: `server/src/client/header-util.ts`,
`server/src/domain/base/pagination.entity.ts`, `server/src/security/index.ts`.

## Workflow

### 1. Decide the guard composition

| Intended access | Decorators |
| --- | --- |
| Public | none |
| Any authenticated user | `@UseGuards(AuthGuard)` |
| Specific role | `@UseGuards(AuthGuard, RolesGuard)` + `@Roles(RoleType.ADMIN)` |

`RolesGuard` returns `true` for any handler without `@Roles`
(`roles.guard.ts:13-15`), so it is never a protection on its own. `AuthGuard`
without `RolesGuard` authenticates but does not authorize.

### 2. Write the handler

```ts
@Get('/:id')
@Roles(RoleType.ADMIN)
@ApiOperation({ summary: 'Get one <thing>' })
@ApiResponse({ status: 200, description: 'The found record', type: <Name>DTO })
async getOne(@Param('id') id: string): Promise<<Name>DTO> {
  return await this.<name>Service.find({ where: { id: Number(id) } });
}
```

Required decorators, matching every existing handler:

- `@ApiOperation({ summary })` — one line, English.
- `@ApiResponse({ status, description, type })`.
- `@ApiBearerAuth()` on the class or the handler when authentication is required.
- `@Roles(...)` when the route is role-gated.

### 3. Paginated list endpoints

Copy `user.controller.ts:44-50` verbatim in shape:

```ts
const pageRequest: PageRequest = new PageRequest(req.query.page, req.query.size, req.query.sort ?? 'id,ASC');
const [results, count] = await this.<name>Service.findAndCount({
  skip: +pageRequest.page * pageRequest.size,
  take: +pageRequest.size,
  order: pageRequest.sort.asOrder(),
});
HeaderUtil.addPaginationHeaders(req.res, new Page(results, count, pageRequest));
return results;
```

The client reads `X-Total-Count` and the RFC5988 `Link` header. Returning a
wrapped `{ content, total }` object instead would break that convention.

### 4. Mutating endpoints

Set the JHipster alert headers so clients get consistent feedback:

```ts
HeaderUtil.addEntityCreatedHeaders(req.res, '<Name>', created.id);   // sets 201
HeaderUtil.addEntityUpdatedHeaders(req.res, '<Name>', updated.id);   // sets 200
HeaderUtil.addEntityDeletedHeaders(req.res, '<Name>', id);           // sets 204
```

These also set the HTTP status — do not add a conflicting `@HttpCode`.

### 5. Errors

Throw from the service, not the controller:

```ts
throw new HttpException('Invalid login name!', HttpStatus.BAD_REQUEST);
```

Never return an error object with a 200 status.

### 6. Frontend impact

If the endpoint is one the site will call, the frontend side is a separate,
required change:

- Typed wrapper in `../frontend/src/lib/api/` (see `auth.ts` for the shape).
- All requests go through `apiRequest()` in
  `../frontend/src/lib/api/client.ts` — it handles the base URL, the
  `Authorization` header, JSON encoding, 204 bodies and the global 401 → logout.

Do not have the frontend call `fetch` directly.

## Validation

```bash
npm run build:app
npm run lint -w server
npm run test:server:e2e
```

Then verify the live contract:

```bash
BACKEND_ENV=test npm run start:server
# in another shell
curl -s localhost:8080/management/info
curl -s -X POST localhost:8080/api/authenticate \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}'
```

Confirm the endpoint appears in Swagger at
`http://localhost:8080/api/v2/api-docs` with the right shape and lock icon.

## Common Mistakes

- Adding `@Roles` without `RolesGuard` in the guard list — the decorator is
  metadata only and is ignored without the guard.
- Adding `RolesGuard` without `AuthGuard` — `request.user` is undefined, so
  `RolesGuard` returns falsy and everything 403s, or the route is effectively
  open when no `@Roles` is set.
- Adding an endpoint to `public.user.controller.ts` and assuming it is protected.
  That controller has **no guards at all**.
- Forgetting `ClassSerializerInterceptor`, leaking `password` hashes in the
  response.
- Setting both `HeaderUtil.addEntityCreatedHeaders` (which sets 201) and
  `@HttpCode(200)`.
- Changing a response field name without updating
  `../frontend/src/lib/api/auth.ts`.
- Returning a paginated payload as a wrapper object instead of a bare array plus
  headers.

## Completion Criteria

- Build, lint and e2e suites pass.
- The endpoint has an e2e spec covering at least the happy path and, for
  role-gated routes, the guard behaviour.
- Swagger shows the endpoint with correct auth marking and payload types.
- Any frontend consumer change is either made or explicitly reported as
  outstanding, naming the files.

# expojuy-backend-testing

## Purpose

Write and run backend tests correctly in a repository that has **two separate
Jest configurations**, forces an in-memory SQLite database through a setup file,
and needs NestJS guards overridden to test protected routes.

## When to Use

- Adding coverage for a new service, controller or endpoint.
- A test fails and you need to know which suite and config it belongs to.
- Before declaring any backend task done — running both suites is part of the
  Definition of Done in `AGENTS.md`.

## Preconditions

Read the two configurations. They do not overlap and they are easy to confuse:

| | Unit | E2E |
| --- | --- | --- |
| Config | `jest` block in `server/package.json` | `server/e2e/jest.e2e.config.json` |
| Command | `npm run test:server` (root) | `npm run test:server:e2e` (root) |
| `testRegex` | `(/test/.*\|\.(spec))\.(ts)$` | `(/e2e/.*\|\.(e2e-spec))\.(ts)$` |
| Location | `server/test/**`, plus any `*.spec.ts` under `server/src/` | `server/e2e/*.e2e-spec.ts` |
| Coverage | opt-in (`test:cov`) | always on |
| Timeout | Jest default | 10000 ms |

Both load `server/e2e/setup.test.js`, whose entire content is:

```js
process.env.BACKEND_ENV = 'test';
```

That single line is what makes every test run against **in-memory SQLite with
`synchronize: true`** (`server/src/orm.config.ts`). Tests never touch MySQL and
never persist between runs.

Existing examples to copy:

- `server/test/admin/management.controller.spec.ts` — minimal unit spec.
- `server/src/domain/base/pagination.entity.spec.ts` — a `*.spec.ts` living
  under `src/`, picked up by the unit config.
- `server/e2e/app.e2e-spec.ts` — full `AppModule`, no guard mocking.
- `server/e2e/user.e2e-spec.ts` — guard mocking, `canActivate: () => true`.
- `server/e2e/account.e2e-spec.ts` — guard mocking that also injects
  `request.user`.

## Repository Context

`pretest` on the `server` workspace runs `eslint .` before Jest. **A lint error
blocks the unit suite from running at all.** Current accepted baseline: 0 errors,
4 warnings.

Baseline to preserve: unit 4 passed / 2 suites, e2e 17 passed / 3 suites.

## Workflow

### Unit spec

```ts
import { beforeEach, describe, expect, it } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';

import { ManagementController } from '../../src/web/rest/management.controller';

describe('Management Controller', () => {
  let controller: ManagementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManagementController],
    }).compile();

    controller = module.get<ManagementController>(ManagementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
```

Note the explicit `@jest/globals` imports — this repo does not rely on Jest
globals being ambient. Match that.

### E2E spec — unprotected route

```ts
import request = require('supertest');

const moduleFixture: TestingModule = await Test.createTestingModule({
  imports: [AppModule],
}).compile();

app = moduleFixture.createNestApplication();
await app.init();

it('/GET public users OK', () => request(app.getHttpServer()).get('/api/users').expect(200));
```

`import request = require('supertest')` is the form used throughout — TypeScript
import-equals, not a default import.

### E2E spec — protected route

Override the guards instead of weakening them in production code:

```ts
const authGuardMock = { canActivate: (): any => true };
const rolesGuardMock = { canActivate: (): any => true };

const moduleFixture: TestingModule = await Test.createTestingModule({
  imports: [AppModule],
})
  .overrideGuard(AuthGuard)
  .useValue(authGuardMock)
  .overrideGuard(RolesGuard)
  .useValue(rolesGuardMock)
  .compile();
```

When the handler reads `req.user`, inject it from the mock — this is the pattern
in `account.e2e-spec.ts:40-46`:

```ts
const authGuardMock = {
  canActivate: (context: ExecutionContext): any => {
    const req = context.switchToHttp().getRequest();
    req.user = testUserAuthenticated;
    return true;
  },
};
```

### Cleanup

Every e2e suite ends with:

```ts
afterEach(async () => {
  await app?.close();
});
```

Records created in a test are deleted through the service in the same test (see
`user.e2e-spec.ts:53`). The in-memory database is fresh per process, not per
test, so leaked rows can affect later assertions in the same file.

`test:e2e` runs with `--force-exit` because handles stay open after the suite.
That is expected; do not treat the Jest warning about it as a failure.

## Validation

```bash
npm run lint -w server        # must be 0 errors, or the unit suite will not run
npm run test:server
npm run test:server:e2e
```

For a single file:

```bash
cd server && npx jest test/admin/management.controller.spec.ts
cd server && npx jest --config ./e2e/jest.e2e.config.json e2e/user.e2e-spec.ts
```

## Common Mistakes

- Putting an e2e spec in `server/test/` (or naming it `*.spec.ts`) — the unit
  config will pick it up and run it without the e2e timeout, and the e2e config
  will not see it.
- Running `npm test` at the repository root. It is a stub that prints
  `INFO: no client test found` and exits 0. It proves nothing.
- Weakening a guard, removing `@Roles`, or making an endpoint public so a test
  passes. Override the guard in the test instead.
- Expecting data to survive between test files — each Jest worker gets its own
  in-memory database.
- Testing schema or constraint behaviour under SQLite and assuming it holds on
  MySQL.
- Ignoring the `pretest` lint gate and wondering why the unit suite "hangs" at a
  lint error.
- Adding an `eslint-disable` directive that turns out to be unnecessary — the
  config reports unused directives as warnings and there are already 4.

## Completion Criteria

- Both suites run and pass, with real output pasted in the report.
- New behaviour has a spec that fails when the behaviour is reverted.
- Protected routes are tested with guards mocked, not with guards removed.
- Lint is still at 0 errors.
- The baseline counts did not shrink (unit ≥ 4, e2e ≥ 17) unless a test was
  intentionally removed and the report says why.

# expojuy-backend-feature

## Purpose

Add a complete new domain entity to the ExpoJuy backend — entity, DTO, mapper,
service, controller, module, ORM registration and tests — following the exact
layered slice this codebase already uses, without breaking JHipster's needle
system or the frontend contract.

## When to Use

- A task asks for a new business concept the API must persist and expose
  (exhibitor, stand, agenda session, ticket order, venue zone…).
- You are about to create a file under `server/src/domain/`.

Do **not** use this for adding an endpoint to an existing controller — use
`expojuy-api-endpoint.md` instead.

## Preconditions

Before writing any file:

1. **Confirm the concept does not already exist.** The domain today is only
   `User` and `Authority`, but check anyway — a previous session may have added
   something:
   ```bash
   fd . server/src/domain --type f
   rg -n "@Entity\(" server/src
   ```
2. **Confirm it belongs in the backend at all.** Much of the ExpoJuy content
   (exhibitors, agenda, FAQ, venue map) currently lives as static TypeScript in
   `../frontend/src/data/`. If the task is "show X on the site", the answer may
   be a frontend data change, not a new table. Check first:
   ```bash
   rg -n "export const|export interface" ../frontend/src/data/*.ts | head -40
   ```
   If the concept already exists there, say so and ask whether the backend
   should become its source of truth before building a table for it.
3. **Read the reference slice end to end.** `User` is the only worked example in
   the repo and every convention below is taken from it:
   - `server/src/domain/user.entity.ts`
   - `server/src/service/dto/user.dto.ts`
   - `server/src/service/mapper/user.mapper.ts`
   - `server/src/service/user.service.ts`
   - `server/src/web/rest/user.controller.ts`
   - `server/src/module/user.module.ts`

## Repository Context

| File | What you will do to it |
| --- | --- |
| `server/src/domain/<name>.entity.ts` | create |
| `server/src/service/dto/<name>.dto.ts` | create |
| `server/src/service/mapper/<name>.mapper.ts` | create |
| `server/src/service/<name>.service.ts` | create |
| `server/src/web/rest/<name>.controller.ts` | create |
| `server/src/module/<name>.module.ts` | create |
| `server/src/orm.config.ts` | **edit at two needles** |
| `server/src/app.module.ts` | **edit at two needles** |
| `server/e2e/<name>.e2e-spec.ts` | create |

## Workflow

### 1. Entity — `server/src/domain/<name>.entity.ts`

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { BaseEntity } from './base/base.entity';

@Entity('expojuy_<table>')
export class <Name> extends BaseEntity {
  @PrimaryGeneratedColumn()
  id?: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;
}
```

Rules taken from `user.entity.ts`:

- Extend `BaseEntity` — it supplies `createdBy`, `createdDate`, `lastModifiedBy`,
  `lastModifiedDate`.
- `id?: number` with `@PrimaryGeneratedColumn()`.
- Explicit table name in `@Entity('...')`. Existing tables use the `jhi_` prefix
  because JHipster generated them; new ExpoJuy tables should use a consistent
  prefix of their own — pick one and stay with it.
- Optional columns get both `@Column({ nullable: true })` and a `?` on the
  property.
- Relations use TypeORM decorators with an arrow factory:
  `@ManyToMany(() => Authority)` + `@JoinTable()` (see `user.entity.ts:25-26`).
- Secrets or hashes get `@Exclude()` from `class-transformer`.

MySQL runs with `--lower_case_table_names=1` (`../docker/docker-compose.yml`),
so table names are case-insensitive in production. Do not rely on casing to
distinguish two tables.

### 2. DTO — `server/src/service/dto/<name>.dto.ts`

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

import { BaseDTO } from './base.dto';

export class <Name>DTO extends BaseDTO {
  id?: number;

  @ApiProperty({ example: 'Stand M-01', description: '<Name> display name' })
  @IsString()
  name: string;
}
```

- Class name ends in `DTO`, uppercase.
- Extend `BaseDTO` so audit fields travel with the payload.
- Every user-facing field carries `@ApiProperty` — the Swagger document at
  `/api/v2/api-docs` is generated from these.
- Validation via `class-validator`. Remember `main.ts` collapses every failure
  into a generic `BadRequestException('Validation error')`, so validation is
  binary: it passes or the client gets no detail.

### 3. Mapper — `server/src/service/mapper/<name>.mapper.ts`

Copy the shape of `user.mapper.ts` — a class with two static methods,
`fromDTOtoEntity` and `fromEntityToDTO`, each returning early on a falsy input.
There is no MapStruct and no automatic mapping library. If the entity needs a
shape transformation on the way out (like `UserService.flatAuthorities()`), put
it in the service, not the mapper — that is where the existing code puts it.

### 4. Service — `server/src/service/<name>.service.ts`

```ts
@Injectable()
export class <Name>Service {
  constructor(@InjectRepository(<Name>) private <name>Repository: Repository<<Name>>) {}

  async findAndCount(options: FindManyOptions<<Name>DTO>): Promise<[<Name>DTO[], number]> { ... }
}
```

- `@InjectRepository(Entity)` in the constructor.
- Public methods return DTOs, never entities.
- Business errors: `throw new HttpException('message', HttpStatus.BAD_REQUEST)`
  (see `auth.service.ts:27`). Do not invent a custom exception hierarchy.
- Explicit return type on every method.

### 5. Controller — `server/src/web/rest/<name>.controller.ts`

```ts
@Controller('api/<plural-name>')
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(LoggingInterceptor, ClassSerializerInterceptor)
@ApiBearerAuth()
@ApiTags('<name>-resource')
export class <Name>Controller {
  logger = new Logger('<Name>Controller');

  constructor(private readonly <name>Service: <Name>Service) {}
}
```

- Route prefix `api/...` — the Swagger include pattern is `/api/.*`.
- **Both** `AuthGuard` and `RolesGuard` when the resource is protected;
  `RolesGuard` alone permits everything on handlers without `@Roles`.
- `ClassSerializerInterceptor` is mandatory if any DTO uses `@Exclude()`.
- Paginated list endpoints follow `user.controller.ts:44-50` exactly: build a
  `PageRequest` from `req.query`, pass `{ skip, take, order }`, then
  `HeaderUtil.addPaginationHeaders(req.res, new Page(results, count, pageRequest))`.
- Create/update/delete call the matching `HeaderUtil.addEntity*Headers`.

### 6. Module — `server/src/module/<name>.module.ts`

```ts
@Module({
  imports: [TypeOrmModule.forFeature([<Name>])],
  controllers: [<Name>Controller],
  providers: [<Name>Service],
  exports: [<Name>Service],
})
export class <Name>Module {}
```

### 7. Register at the needles — this is the step that gets forgotten

`server/src/orm.config.ts` — two edits:

```ts
import { <Name> } from './domain/<name>.entity';
// jhipster-needle-add-entity-to-ormconfig-imports - JHipster will add code here, do not remove
...
    entities: [
      User,
      Authority,
      <Name>,
      // jhipster-needle-add-entity-to-ormconfig-entities - JHipster will add code here, do not remove
    ],
```

`server/src/app.module.ts` — two edits:

```ts
import { <Name>Module } from './module/<name>.module';
// jhipster-needle-add-entity-module-to-main-import - JHipster will import entity modules here, do not remove
...
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: ormConfig }),
    AuthModule,
    <Name>Module,
    // jhipster-needle-add-entity-module-to-main - JHipster will add entity modules here, do not remove
  ],
```

Insert **above** the needle comment. Never delete it.

### 8. Tests — `server/e2e/<name>.e2e-spec.ts`

Follow `server/e2e/user.e2e-spec.ts`. See `expojuy-backend-testing.md` for the
guard-mocking pattern.

### 9. Schema

`BACKEND_ENV=test` uses `synchronize: true`, so e2e tests get the table for free.
For `dev`/`prod`, read `expojuy-database-migration.md` before assuming the table
will appear.

## Validation

```bash
npm run build:app
npm run lint -w server
npm run test:server
npm run test:server:e2e
```

Then start the app and confirm the entity actually loads:

```bash
BACKEND_ENV=test npm run start:server
```

A missing needle registration typically shows up as
`EntityMetadataNotFoundError: No metadata for "<Name>" was found` — that is the
symptom of skipping step 7.

## Common Mistakes

- Registering the module in `app.module.ts` but forgetting the entity in
  `orm.config.ts` (or vice versa). Both are required.
- Deleting a needle comment while inserting next to it.
- Returning the entity from the controller instead of the DTO.
- Applying `RolesGuard` without `AuthGuard`, which authorizes anonymous requests.
- Omitting `ClassSerializerInterceptor` on a controller whose DTO has
  `@Exclude()` fields.
- Adding a mapping library because the manual mapper feels verbose. The manual
  mapper is the convention here.
- Building a table for content that already lives in
  `../frontend/src/data/*.ts` without flagging the duplication.

## Completion Criteria

- All four validation commands pass with real output.
- The entity is registered at both `orm.config.ts` needles and the module at both
  `app.module.ts` needles, with every needle comment intact.
- At least one e2e spec exercises the new controller.
- Swagger at `/api/v2/api-docs` shows the new tag and the real payload shape.
- The report states explicitly whether the frontend needs a corresponding change
  and, if so, which files under `../frontend/src/lib/api/`.

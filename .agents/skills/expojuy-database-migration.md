# expojuy-database-migration

## Purpose

Change the ExpoJuy database schema or seed data safely, given that this project
uses hand-registered TypeORM migrations plus `connection.synchronize()`, and
behaves differently in each of its four environments.

## When to Use

- Adding, removing or altering a column on an existing entity.
- Adding a new table (as part of `expojuy-backend-feature.md`).
- Adding or changing seed/reference data.
- Diagnosing "the column exists in the entity but not in the database".

## Preconditions

Read these two files before anything else — the migration system here is not
conventional:

- `server/src/orm.config.ts` — datasource per environment **and** the manual
  entity/migration registries.
- `server/src/migrations/1570200270081-CreateTables.ts` — note it does not
  contain DDL; it calls `queryRunner.connection.synchronize()`.

Then check what already exists:

```bash
fd . server/src/migrations --type f
rg -n "@Column|@Entity|@PrimaryGeneratedColumn" server/src/domain
```

## Repository Context

Environment behaviour, from `orm.config.ts`:

| `BACKEND_ENV` | Driver | Database | `synchronize` | `migrationsRun` |
| --- | --- | --- | --- | --- |
| `prod` | `mysql2` | `DB_DATABASE` (default `expoJujuy`) on `DB_HOST` (default `mysql`) | `false` | `true` |
| `dev` | mariadb | `expoJujuy` @ `127.0.0.1`, credentials hardcoded at `orm.config.ts:45` | `false` | `true` |
| `test` | `sqlite3` | `:memory:` | **`true`** | `true` |
| unset / other | `sqlite3` | file under `target/db/` | `false` | `true` |

Consequences you must internalise:

- **In `test`, the schema is generated from entity metadata.** e2e specs never
  need a migration to see a new column.
- **In `dev` and `prod`, `CreateTables1570200270081` runs `synchronize()` on
  every boot** (it commits the open transaction first for those two
  environments). So the schema also tracks the entities there — but only for the
  entities registered in `orm.config.ts`, and `synchronize` will happily drop a
  column you removed from an entity.
- `migrationsRun: true` in all environments. Migrations run in the order of the
  `migrations` array, and TypeORM records them, so each runs once per database.

Production credentials come from env vars consumed in `orm.config.ts`:
`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`. They are supplied
by `../docker/docker-compose.yml` from `../docker/.env`.

## Workflow

### Changing a column on an existing entity

1. Edit the `@Column` in `server/src/domain/<name>.entity.ts`.
2. Update the matching DTO field in `server/src/service/dto/<name>.dto.ts` —
   including `@ApiProperty` and validators.
3. Check the mapper. `UserMapper` copies by `Object.getOwnPropertyNames`, so it
   picks up new fields automatically, but a renamed field silently drops.
4. Update or add an e2e spec asserting the new shape.
5. For a **destructive** change (dropping or renaming a column that holds data in
   `dev`/`prod`), write a migration rather than relying on `synchronize()`:
   `synchronize` will drop the old column and its data without warning.

### Adding a new migration

1. Create `server/src/migrations/<epoch-ms>-<Description>.ts`. The timestamp
   prefix orders execution; use the real current epoch in milliseconds.

   ```ts
   import { MigrationInterface, QueryRunner } from 'typeorm';

   export class SeedVenueZones1790000000000 implements MigrationInterface {
     public async up(queryRunner: QueryRunner): Promise<any> {
       const repository = queryRunner.connection.getRepository('expojuy_zone');
       await repository.save([{ name: 'Pabellón Central' }]);
     }

     public async down(queryRunner: QueryRunner): Promise<any> {
       await queryRunner.query(`DELETE FROM expojuy_zone WHERE name = 'Pabellón Central'`);
     }
   }
   ```

2. **Register it** in `server/src/orm.config.ts`, at the two places:

   ```ts
   import { SeedVenueZones1790000000000 } from './migrations/1790000000000-SeedVenueZones';
   // jhipster-needle-add-entity-to-ormconfig-imports - JHipster will add code here, do not remove
   ...
       migrations: [
         CreateTables1570200270081,
         SeedUsersRoles1570200490072,
         SeedVenueZones1790000000000,
         // jhipster-needle-add-migration-to-ormconfig-migrations - JHipster will add code here, do not remove
       ],
   ```

   An unregistered migration file is dead code — nothing scans the directory.

3. Migrations run **after** `CreateTables` has synchronized the schema, so tables
   defined by registered entities already exist when a seed migration runs.

4. Both `up` and `down` must exist. Existing migrations have empty `down`
   methods; new ones should implement a real reversal where it is possible.

### Password handling in seeds

If a seed inserts users, hash with `transformPassword` from
`server/src/security` — see `1570200490072-SeedUsersRoles.ts:77`. Never insert a
plaintext password.

## Validation

```bash
npm run build:app
npm run test:server:e2e     # in-memory SQLite, synchronize:true — proves the entity metadata is valid
```

Then exercise the real driver path:

```bash
npm run docker:db:up                       # MySQL from docker/mysql.yml
BACKEND_ENV=prod DB_HOST=127.0.0.1 npm run start:server
```

Watch the boot log for TypeORM errors. `EntityMetadataNotFoundError` means the
entity is not registered in `orm.config.ts`.

## Common Mistakes

- **Editing `1570200270081-CreateTables.ts` or `1570200490072-SeedUsersRoles.ts`.**
  They have already run against existing databases; TypeORM will not re-run them,
  so the edit does nothing except desynchronize environments. Add a new
  migration.
- Writing a migration file and never adding it to the `migrations` array.
- Assuming `npm run typeorm:migration:generate` works out of the box. The script
  exists in `server/package.json` but points at
  `../node_modules/.bin/typeorm` with `-n schema`, a TypeORM 0.2-era flag. Verify
  before relying on it; hand-written migrations are the pattern in this repo.
- Testing only under `BACKEND_ENV=test`. SQLite in-memory with `synchronize:true`
  hides constraint, type and index problems that MySQL will surface.
- Relying on `synchronize()` for a destructive change in `dev`/`prod` — it drops
  columns and their data silently.
- Deleting a needle comment while inserting a registration.

## Completion Criteria

- Build passes and both test suites pass.
- Any new migration is registered in `orm.config.ts` with its import, and every
  needle comment is intact.
- The change was booted at least once against MySQL, not only SQLite, when it
  touches column types, constraints or indexes.
- Entity, DTO, mapper behaviour and Swagger schema all agree.
- If the change is destructive, the report says so explicitly and states what
  happens to existing `dev`/`prod` data.

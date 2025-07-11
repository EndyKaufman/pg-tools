import { PG_FLYWAY_DEFAULT_MIGRATE_CONFIG, MgrationFileMetadata, MigrateService, Migration } from 'pg-flyway';
import { BASIC_CALLBACKS } from './basic-callbacks';
import { BASIC_MIGRATIONS } from './basic-migrations';
import { getPostgres, Pg } from './utils/get-postgres';

describe('Basic migrate with pglite and callback', () => {
  const BASIC_MIGRATIONS_WITH_CALLBACKS = {
    ...BASIC_CALLBACKS,
    ...BASIC_MIGRATIONS,
  };

  let migrateService: MigrateService;
  let pg: Pg;

  class CustomMigrateService extends MigrateService {
    override async getFiles(): Promise<MgrationFileMetadata[]> {
      return Object.keys(BASIC_MIGRATIONS_WITH_CALLBACKS).map((filepath) => ({
        filepath,
        location: 'libs/core/auth/src/migrations',
        sqlMigrationSuffix: '.sql',
      }));
    }

    override async loadMigrationFile(filepath: string): Promise<string> {
      return BASIC_MIGRATIONS_WITH_CALLBACKS[filepath];
    }
  }

  beforeAll(async () => {
    // process.env['DEBUG'] = '*';

    pg = await getPostgres();
    migrateService = new CustomMigrateService({
      databaseUrl: pg.connectionString,
      locations: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.locations.split(','),
      historyTable: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.historyTable,
      sqlMigrationSuffixes: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationSuffixes.split(','),
      sqlMigrationSeparator: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationSeparator,
      sqlMigrationStatementSeparator: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationStatementSeparator,
    });
  });

  afterAll(async () => {
    migrateService.destroy();
    await pg.teardown();
  });

  it('Apply migrations', async () => {
    await migrateService.migrate();
  });

  it('Check data from seed migration in database', async () => {
    const appUserCategories = (
      await migrateService.execSqlForStatements({
        migration: Migration.fromStatements({
          statements: ['select * from "AppUserCategory"'],
        }),
        placeholders: {},
      })
    ).flat();
    expect(appUserCategories).toMatchObject([
      {
        name: 'VIP',
        description: 'Users with VIP status',
      },
    ]);
  });

  it('Check comment on table from versioned migration in database', async () => {
    const comment = (
      await migrateService.execSqlForStatements({
        migration: Migration.fromStatements({
          statements: [
            `SELECT t.table_name, pg_catalog.obj_description(pgc.oid, 'pg_class')
  FROM information_schema.tables t
           INNER JOIN pg_catalog.pg_class pgc
                      ON t.table_name = pgc.relname
  WHERE t.table_name = 'AppUser';`,
          ],
        }),
        placeholders: {},
      })
    ).flat();
    expect(comment).toMatchObject([
      {
        table_name: 'AppUser',
        obj_description: 'Application users',
      },
    ]);
  });

  it('Check migration history table', async () => {
    const migrations = (
      await migrateService.execSqlForStatements({
        migration: Migration.fromStatements({
          statements: [migrateService.getHistoryTableService().getMigrationsHistorySql()],
        }),
        placeholders: {},
      })
    ).flat();

    expect(migrations).toMatchObject([
      {
        installed_rank: 1,
        version: '202401010900',
        description: 'CreateUserTable',
        type: 'SQL',
        script: 'apps/server/src/migrations/V202401010900__CreateUserTable.sql',
        checksum: -720020984,
        installed_by: 'postgres',
        // installed_on: '2025-01-12T13:14:48.106Z',
        // execution_time: 14,
        success: true,
      },
      {
        installed_rank: 2,
        version: null,
        description: 'SetAllComments',
        type: 'SQL',
        script: 'apps/server/src/migrations/objects/R__SetAllComments.sql',
        checksum: -900617502,
        installed_by: 'postgres',
        // installed_on: '2025-01-12T13:14:48.126Z',
        // execution_time: 3,
        success: true,
      },
      {
        installed_rank: 3,
        version: null,
        description: 'DefaultCategories',
        type: 'SQL',
        script: 'libs/server/src/migrations/seeds/R__DefaultCategories.sql',
        checksum: -1292430807,
        installed_by: 'postgres',
        // installed_on: '2025-01-12T13:14:48.119Z',
        // execution_time: 6,
        success: true,
      },
    ]);
  });

  it('Update repeatable migration, run migrate and check migration history table, last migration is duplicate executed of R__DefaultCategories', async () => {
    BASIC_MIGRATIONS_WITH_CALLBACKS[
      'libs/server/src/migrations/seeds/R__DefaultCategories.sql'
    ] = `INSERT INTO "AppUserCategory" (name, description) VALUES ('VIP', 'Users with VIP status') ON CONFLICT (name) DO NOTHING;
--
INSERT INTO "AppUserCategory" (name, description) VALUES ('Beginner', 'Beginner users') ON CONFLICT (name) DO NOTHING;`;

    await migrateService.migrate();

    const migrations = (
      await migrateService.execSqlForStatements({
        migration: Migration.fromStatements({
          statements: [migrateService.getHistoryTableService().getMigrationsHistorySql()],
        }),
        placeholders: {},
      })
    ).flat();

    expect(migrations).toMatchObject([
      {
        installed_rank: 1,
        version: '202401010900',
        description: 'CreateUserTable',
        type: 'SQL',
        script: 'apps/server/src/migrations/V202401010900__CreateUserTable.sql',
        checksum: -720020984,
        installed_by: 'postgres',
        // installed_on: '2025-01-12T13:14:48.106Z',
        // execution_time: 14,
        success: true,
      },
      {
        installed_rank: 2,
        version: null,
        description: 'SetAllComments',
        type: 'SQL',
        script: 'apps/server/src/migrations/objects/R__SetAllComments.sql',
        checksum: -900617502,
        installed_by: 'postgres',
        // installed_on: '2025-01-12T13:14:48.126Z',
        // execution_time: 3,
        success: true,
      },
      {
        installed_rank: 3,
        version: null,
        description: 'DefaultCategories',
        type: 'SQL',
        script: 'libs/server/src/migrations/seeds/R__DefaultCategories.sql',
        checksum: -1292430807,
        installed_by: 'postgres',
        // installed_on: '2025-01-12T13:14:48.119Z',
        // execution_time: 6,
        success: true,
      },
      {
        installed_rank: 4,
        version: null,
        description: 'DefaultCategories',
        type: 'SQL',
        script: 'libs/server/src/migrations/seeds/R__DefaultCategories.sql',
        checksum: 1778283446,
        installed_by: 'postgres',
        // installed_on: '2025-01-12T13:14:48.119Z',
        // execution_time: 6,
        success: true,
      },
    ]);
  });

  it('Update versioned migration, run migrate and catch error', async () => {
    BASIC_MIGRATIONS_WITH_CALLBACKS[
      'apps/server/src/migrations/V202401010900__CreateUserTable.sql'
    ] = `${BASIC_MIGRATIONS_WITH_CALLBACKS['apps/server/src/migrations/V202401010900__CreateUserTable.sql']};
--
CREATE INDEX "IDX_APP_USER__CATEGORY_ID" ON "AppUser"("categoryId");`;

    try {
      await migrateService.migrate();
    } catch (err) {
      expect(err.message).toEqual(
        'Checksum for migration "apps/server/src/migrations/V202401010900__CreateUserTable.sql" are different, in the history table: -720020984, in the file system: 1100360151'
      );
    }

    const migrations = (
      await migrateService.execSqlForStatements({
        migration: Migration.fromStatements({
          statements: [migrateService.getHistoryTableService().getMigrationsHistorySql()],
        }),
        placeholders: {},
      })
    ).flat();

    expect(migrations).toMatchObject([
      {
        installed_rank: 1,
        version: '202401010900',
        description: 'CreateUserTable',
        type: 'SQL',
        script: 'apps/server/src/migrations/V202401010900__CreateUserTable.sql',
        checksum: -720020984,
        installed_by: 'postgres',
        // installed_on: '2025-01-12T13:14:48.106Z',
        // execution_time: 14,
        success: true,
      },
      {
        installed_rank: 2,
        version: null,
        description: 'SetAllComments',
        type: 'SQL',
        script: 'apps/server/src/migrations/objects/R__SetAllComments.sql',
        checksum: -900617502,
        installed_by: 'postgres',
        // installed_on: '2025-01-12T13:14:48.126Z',
        // execution_time: 3,
        success: true,
      },
      {
        installed_rank: 3,
        version: null,
        description: 'DefaultCategories',
        type: 'SQL',
        script: 'libs/server/src/migrations/seeds/R__DefaultCategories.sql',
        checksum: -1292430807,
        installed_by: 'postgres',
        // installed_on: '2025-01-12T13:14:48.119Z',
        // execution_time: 6,
        success: true,
      },
      {
        installed_rank: 4,
        version: null,
        description: 'DefaultCategories',
        type: 'SQL',
        script: 'libs/server/src/migrations/seeds/R__DefaultCategories.sql',
        checksum: 1778283446,
        installed_by: 'postgres',
        // installed_on: '2025-01-12T13:14:48.119Z',
        // execution_time: 6,
        success: true,
      },
    ]);
  });

  it('Check callback actions table', async () => {
    const callbackActions = (
      await migrateService.execSqlForStatements({
        migration: Migration.fromStatements({
          statements: [`select * from "CallbackTable" order by "createdAt"`],
        }),
        placeholders: {},
      })
    ).flat();

    expect(callbackActions).toMatchObject([
      { name: 'beforeEachMigrate - V202401010900__CreateUserTable.sql' },
      {
        name: 'beforeEachMigrateStatement - V202401010900__CreateUserTable.sql',
      },
      {
        name: 'afterEachMigrateStatement - V202401010900__CreateUserTable.sql',
      },
      {
        name: 'afterEachMigrateStatementError - V202401010900__CreateUserTable.sql',
      },
      { name: 'afterEachMigrate - V202401010900__CreateUserTable.sql' },
      { name: 'afterEachMigrateError - V202401010900__CreateUserTable.sql' },
      { name: 'afterEachMigrate - %filename%' },
      { name: 'afterMigrateApplied - %filename%' },
      { name: 'afterMigrateError - %filename%' },
      { name: 'afterVersioned - %filename%' },
      { name: 'beforeEachMigrate - R__SetAllComments.sql' },
      { name: 'beforeEachMigrateStatement - R__SetAllComments.sql' },
      { name: 'afterEachMigrateStatement - R__SetAllComments.sql' },
      { name: 'afterEachMigrateStatementError - R__SetAllComments.sql' },
      { name: 'afterEachMigrate - R__SetAllComments.sql' },
      { name: 'afterEachMigrateError - R__SetAllComments.sql' },
      { name: 'beforeEachMigrate - R__DefaultCategories.sql' },
      { name: 'beforeEachMigrateStatement - R__DefaultCategories.sql' },
      { name: 'afterEachMigrateStatement - R__DefaultCategories.sql' },
      { name: 'afterEachMigrateStatementError - R__DefaultCategories.sql' },
      { name: 'afterEachMigrate - R__DefaultCategories.sql' },
      { name: 'afterEachMigrateError - R__DefaultCategories.sql' },
      { name: 'afterEachMigrate - %filename%' },
      { name: 'afterMigrateApplied - %filename%' },
      { name: 'afterMigrateError - %filename%' },
      { name: 'beforeEachMigrate - R__DefaultCategories.sql' },
      { name: 'beforeEachMigrateStatement - R__DefaultCategories.sql' },
      { name: 'afterEachMigrateStatement - R__DefaultCategories.sql' },
      { name: 'afterEachMigrateStatementError - R__DefaultCategories.sql' },
      { name: 'afterEachMigrateStatement - R__DefaultCategories.sql' },
      { name: 'afterEachMigrateStatementError - R__DefaultCategories.sql' },
      { name: 'afterEachMigrate - R__DefaultCategories.sql' },
      { name: 'afterEachMigrateError - R__DefaultCategories.sql' },
      { name: 'afterEachMigrate - %filename%' },
      { name: 'afterMigrateApplied - %filename%' },
      { name: 'afterMigrateError - %filename%' },
    ]);
  });
});

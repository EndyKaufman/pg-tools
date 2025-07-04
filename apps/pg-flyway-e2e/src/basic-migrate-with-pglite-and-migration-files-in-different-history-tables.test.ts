import { join } from 'node:path';
import { PG_FLYWAY_DEFAULT_MIGRATE_CONFIG, MigrateService, Migration } from 'pg-flyway';
import { BASIC_MIGRATIONS, saveBasicMigrationsToFileSystem } from './basic-migrations';
import { getPostgres, Pg } from './utils/get-postgres';

const __migrations_server_app = '__migrations_server_app';
const __migrations_server_lib = '__migrations_server_lib';

describe('Basic migrate with pglite and migration files in different history table', () => {
  let appMigrateService: MigrateService;
  let libMigrateService: MigrateService;
  let pg: Pg;

  beforeAll(async () => {
    // process.env['DEBUG'] = '*';

    await saveBasicMigrationsToFileSystem(
      join(__dirname, 'basic-migrate-with-pglite-and-migration-files-in-different-history-tables')
    );

    pg = await getPostgres();

    appMigrateService = new MigrateService({
      databaseUrl: pg.connectionString,
      historyTable: __migrations_server_app,
      locations: [
        join(
          __dirname,
          'basic-migrate-with-pglite-and-migration-files-in-different-history-tables/apps/server/src/migrations'
        ),
      ],
      sqlMigrationSuffixes: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationSuffixes.split(','),
      sqlMigrationSeparator: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationSeparator,
      sqlMigrationStatementSeparator: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationStatementSeparator,
    });

    libMigrateService = new MigrateService({
      databaseUrl: pg.connectionString,
      historyTable: __migrations_server_lib,
      locations: [
        join(
          __dirname,
          'basic-migrate-with-pglite-and-migration-files-in-different-history-tables/libs/server/src/migrations'
        ),
      ],
      sqlMigrationSuffixes: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationSuffixes.split(','),
      sqlMigrationSeparator: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationSeparator,
      sqlMigrationStatementSeparator: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationStatementSeparator,
    });
  });

  afterAll(async () => {
    appMigrateService.destroy();
    libMigrateService.destroy();
    await pg.teardown();
  });

  it('Apply migrations', async () => {
    await appMigrateService.migrate();

    await libMigrateService.migrate();
  });

  it('Check data from seed migration in database', async () => {
    const appUserCategories = (
      await appMigrateService.execSqlForStatements({
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
      await appMigrateService.execSqlForStatements({
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

  it('Check migration history table for application', async () => {
    const migrations = (
      await appMigrateService.execSqlForStatements({
        migration: Migration.fromStatements({
          statements: [appMigrateService.getHistoryTableService().getMigrationsHistorySql()],
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
        script: 'V202401010900__CreateUserTable.sql',
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
        script: 'objects/R__SetAllComments.sql',
        checksum: -900617502,
        installed_by: 'postgres',
        // installed_on: '2025-01-12T13:14:48.126Z',
        // execution_time: 3,
        success: true,
      },
    ]);
  });

  it('Check migration history table for library', async () => {
    const migrations = (
      await libMigrateService.execSqlForStatements({
        migration: Migration.fromStatements({
          statements: [libMigrateService.getHistoryTableService().getMigrationsHistorySql()],
        }),
        placeholders: {},
      })
    ).flat();

    expect(migrations).toMatchObject([
      {
        installed_rank: 1,
        version: null,
        description: 'DefaultCategories',
        type: 'SQL',
        script: 'seeds/R__DefaultCategories.sql',
        checksum: -1292430807,
        installed_by: 'postgres',
        // installed_on: '2025-01-12T13:14:48.119Z',
        // execution_time: 6,
        success: true,
      },
    ]);
  });

  it('Update repeatable migration, run migrate and check migration history table, last migration is duplicate executed of R__DefaultCategories', async () => {
    BASIC_MIGRATIONS[
      'libs/server/src/migrations/seeds/R__DefaultCategories.sql'
    ] = `INSERT INTO "AppUserCategory" (name, description) VALUES ('VIP', 'Users with VIP status') ON CONFLICT (name) DO NOTHING;
--
INSERT INTO "AppUserCategory" (name, description) VALUES ('Beginner', 'Beginner users') ON CONFLICT (name) DO NOTHING;`;

    await saveBasicMigrationsToFileSystem(
      join(__dirname, 'basic-migrate-with-pglite-and-migration-files-in-different-history-tables')
    );

    await appMigrateService.migrate();

    await libMigrateService.migrate();

    const migrations = (
      await libMigrateService.execSqlForStatements({
        migration: Migration.fromStatements({
          statements: [libMigrateService.getHistoryTableService().getMigrationsHistorySql()],
        }),
        placeholders: {},
      })
    ).flat();

    expect(migrations).toMatchObject([
      {
        installed_rank: 1,
        version: null,
        description: 'DefaultCategories',
        type: 'SQL',
        script: 'seeds/R__DefaultCategories.sql',
        checksum: -1292430807,
        installed_by: 'postgres',
        // installed_on: '2025-01-12T13:14:48.119Z',
        // execution_time: 6,
        success: true,
      },
      {
        installed_rank: 2,
        version: null,
        description: 'DefaultCategories',
        type: 'SQL',
        script: 'seeds/R__DefaultCategories.sql',
        checksum: 1778283446,
        installed_by: 'postgres',
        // installed_on: '2025-01-12T13:14:48.119Z',
        // execution_time: 6,
        success: true,
      },
    ]);
  });

  it('Update versioned migration, run migrate and catch error', async () => {
    BASIC_MIGRATIONS[
      'apps/server/src/migrations/V202401010900__CreateUserTable.sql'
    ] = `${BASIC_MIGRATIONS['apps/server/src/migrations/V202401010900__CreateUserTable.sql']};
--
CREATE INDEX "IDX_APP_USER__CATEGORY_ID" ON "AppUser"("categoryId");`;

    await saveBasicMigrationsToFileSystem(
      join(__dirname, 'basic-migrate-with-pglite-and-migration-files-in-different-history-tables')
    );

    try {
      await appMigrateService.migrate();

      await libMigrateService.migrate();
    } catch (err) {
      expect(err.message).toEqual(
        'Checksum for migration "V202401010900__CreateUserTable.sql" are different, in the history table: -720020984, in the file system: 1100360151'
      );
    }

    const migrations = (
      await appMigrateService.execSqlForStatements({
        migration: Migration.fromStatements({
          statements: [appMigrateService.getHistoryTableService().getMigrationsHistorySql()],
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
        script: 'V202401010900__CreateUserTable.sql',
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
        script: 'objects/R__SetAllComments.sql',
        checksum: -900617502,
        installed_by: 'postgres',
        // installed_on: '2025-01-12T13:14:48.126Z',
        // execution_time: 3,
        success: true,
      },
    ]);
  });
});

import { PG_FLYWAY_DEFAULT_MIGRATE_CONFIG, MgrationFileMetadata, MigrateService, Migration, PoolClient } from 'pg-flyway';
import { BASIC_MIGRATIONS } from './basic-migrations';

describe('Basic migrate with dryRun', () => {
  const executedSqlQueries: string[] = [];

  let migrateService: MigrateService;

  class CustomMigrateService extends MigrateService {
    override async getFiles(): Promise<MgrationFileMetadata[]> {
      return Object.keys(BASIC_MIGRATIONS).map((filepath) => ({
        filepath,
        location: 'libs/core/auth/src',
        sqlMigrationSuffix: '.sql',
      }));
    }

    override async loadMigrationFile(filepath: string): Promise<string> {
      return BASIC_MIGRATIONS[filepath];
    }

    override async execSql({
      query,
      migration,
    }: {
      client?: PoolClient;
      query: string;
      dryRun?: boolean;
      migration?: Migration;
      databaseUrl: string;
      placeholders: Record<string, string>;
    }): Promise<void> {
      if (migration?.filepath) {
        executedSqlQueries.push(query);
      }
    }
  }

  beforeAll(async () => {
    // process.env['DEBUG'] = '*';
    migrateService = new CustomMigrateService({
      dryRun: true,
      databaseUrl: '',
      locations: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.locations,
      historyTable: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.historyTable,
      sqlMigrationSuffixes: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationSuffixes,
      sqlMigrationSeparator: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationSeparator,
      sqlMigrationStatementSeparator: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationStatementSeparator,
    });
  });

  afterAll(async () => {
    migrateService.destroy();
  });

  it('Apply migrations and check executed sql scripts', async () => {
    await migrateService.migrate();

    expect(executedSqlQueries).toMatchObject(
      [
        BASIC_MIGRATIONS['apps/server/src/migrations/V202401010900__CreateUserTable.sql'],
        BASIC_MIGRATIONS['apps/server/src/migrations/objects/R__SetAllComments.sql'],
        BASIC_MIGRATIONS['libs/server/src/migrations/seeds/R__DefaultCategories.sql'],
      ].reduce((all: string[], cur: string) => [...all, 'BEGIN', cur, 'COMMIT'], [])
    );
  });
});

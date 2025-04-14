import { PG_FLYWAY_DEFAULT_MIGRATE_CONFIG, MgrationFileMetadata, MigrateService } from 'pg-flyway';

describe('Ensure test order', () => {
  let migrateService: MigrateService;

  class CustomMigrateService extends MigrateService {
    override async loadMigrationFile(filepath: string): Promise<string> {
      return '';
    }

    override async getFiles(): Promise<MgrationFileMetadata[]> {
      return [
        {
          filepath: 'V2.sql',
          location: './migrations',
          sqlMigrationSuffix: '.sql',
        },
        {
          filepath: 'V3.sql',
          location: './migrations',
          sqlMigrationSuffix: '.sql',
        },
        { filepath: 'V1.sql', location: './migrations', sqlMigrationSuffix: '.sql' },
        {
          filepath: 'V4.sql',
          location: './migrations',
          sqlMigrationSuffix: '.sql',
        },
        {
          filepath: 'V5.sql',
          location: './migrations',
          sqlMigrationSuffix: '.sql',
        },
        {
          filepath: 'V6.sql',
          location: './migrations',
          sqlMigrationSuffix: '.sql',
        },
      ];
    }
  }

  beforeAll(async () => {
    // process.env['DEBUG'] = '*';
    migrateService = new CustomMigrateService({
      dryRun: true,
      databaseUrl: '',
      locations: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.locations.split(','),
      historyTable: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.historyTable,
      sqlMigrationSuffixes: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationSuffixes.split(','),
      sqlMigrationSeparator: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationSeparator,
      sqlMigrationStatementSeparator: PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationStatementSeparator,
    });
  });

  afterAll(async () => {
    migrateService.destroy();
  });

  it('Apply migrations and check executed sql scripts', async () => {
    const migrations = await migrateService['getMigrations']();

    for (let i = 0; i < migrations.length; i++) {
      expect(migrations[i].filepath).toBe(`V${i + 1}.sql`);
    }
  });
});

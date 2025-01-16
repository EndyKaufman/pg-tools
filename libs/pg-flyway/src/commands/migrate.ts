import { Command, Option } from 'commander';
import { DEFAULT_MIGRATE_CONFIG } from '../constants/default';
import {
  PG_FLYWAY_DATABASE_URL,
  PG_FLYWAY_DRY_RUN,
  PG_FLYWAY_HISTORY_SCHEMA,
  PG_FLYWAY_HISTORY_TABLE,
  PG_FLYWAY_LOCATIONS,
  PG_FLYWAY_SQL_MIGRATION_SEPARATOR,
  PG_FLYWAY_SQL_MIGRATION_STATEMENT_SEPARATOR,
  PG_FLYWAY_SQL_MIGRATION_SUFFIXES,
} from '../constants/env-keys';
import { MigrateService } from '../services/migrate.service';

export function migrate(program: Command) {
  program
    .command('migrate')
    .description('Migrates the schema to the latest version.')
    .addOption(
      new Option('-d,--dry-run <boolean>', 'Show content of migrations without apply them in database.')
        .default('false')
        .env(PG_FLYWAY_DRY_RUN)
    )
    .addOption(
      new Option(
        '-u,--database-url <string>',
        'Database url for connect (example: postgres://POSTGRES_USER:POSTGRES_PASSWORD@localhost:POSTGRES_PORT/POSTGRES_DATABASE?schema=public).'
      ).env(PG_FLYWAY_DATABASE_URL)
    )
    .addOption(
      new Option('-l,--locations <strings>', 'Locations with migration files.')
        .default(DEFAULT_MIGRATE_CONFIG.locations?.join(','))
        .env(PG_FLYWAY_LOCATIONS)
    )
    .addOption(
      new Option('-h,--history-table <string>', 'History table with states of migration.')
        .default(DEFAULT_MIGRATE_CONFIG.historyTable)
        .env(PG_FLYWAY_HISTORY_TABLE)
    )
    .addOption(
      new Option('--history-schema <string>', 'History table schema with states of migration.')
        .default(DEFAULT_MIGRATE_CONFIG.historySchema)
        .env(PG_FLYWAY_HISTORY_SCHEMA)
    )
    .addOption(
      new Option('-s,--sql-migration-suffixes <strings>', 'Extension of migration files.')
        .default(DEFAULT_MIGRATE_CONFIG.sqlMigrationSuffixes?.join(','))
        .env(PG_FLYWAY_SQL_MIGRATION_SUFFIXES)
    )
    .addOption(
      new Option(
        '--sql-migration-separator <strings>',
        'Version separator (example: V1__Name.sql, sqlMigrationSeparator= "__").'
      )
        .default(DEFAULT_MIGRATE_CONFIG.sqlMigrationSeparator)
        .env(PG_FLYWAY_SQL_MIGRATION_SEPARATOR)
    )
    .addOption(
      new Option('--sql-migration-statement-separator <strings>', 'Separator of nested queries within a sql query.')
        .default(DEFAULT_MIGRATE_CONFIG.sqlMigrationStatementSeparator)
        .env(PG_FLYWAY_SQL_MIGRATION_STATEMENT_SEPARATOR)
    )
    .action(
      async (options: {
        dryRun: string;
        databaseUrl?: string;
        locations: string;
        historyTable: string;
        historySchema: string;
        sqlMigrationSuffixes: string;
        sqlMigrationSeparator: string;
        sqlMigrationStatementSeparator: string;
      }) => {
        const migrateService = new MigrateService();
        const dryRun = options.dryRun === 'true';
        if (!dryRun && !options.databaseUrl) {
          throw Error('databaseUrl not set');
        }
        await migrateService.migrate({
          dryRun,
          databaseUrl: options.databaseUrl || '',
          locations: options.locations.split(',').map((s) => s.trim()),
          historyTable: options.historyTable,
          historySchema: options.historySchema,
          sqlMigrationSuffixes: options.sqlMigrationSuffixes.split(',').map((s) => s.trim()),
          sqlMigrationSeparator: options.sqlMigrationSeparator,
          sqlMigrationStatementSeparator: options.sqlMigrationStatementSeparator,
        });
        migrateService.destroy();
      }
    );
}

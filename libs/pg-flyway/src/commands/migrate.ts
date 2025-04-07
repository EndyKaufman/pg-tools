import { Command, Option } from 'commander';
import { cosmiconfig, defaultLoaders } from 'cosmiconfig';
import { basename, dirname, join, sep } from 'path';
import { PG_FLYWAY_DEFAULT_MIGRATE_CONFIG } from '../constants/default';
import {
  PG_FLYWAY_CONFIG,
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
import { MigrateHandlerOptions } from '../types/migrate-handler-options';
import { replaceEnv } from '../utils/replace-env';

export async function migrateHandler(options: MigrateHandlerOptions) {
  let configObjects: {
    dryRun: string;
    databaseUrl?: string;
    locations: string;
    historyTable: string;
    historySchema: string;
    sqlMigrationSuffixes: string;
    sqlMigrationSeparator: string;
    sqlMigrationStatementSeparator: string;
  }[] = [];

  try {
    const dir = dirname(options.config);
    const searchFrom = dir[0] === '.' ? join(process.cwd(), dir) : dir[0] === sep ? dir : process.cwd();
    const moduleName = basename(options.config);
    const config = await cosmiconfig(moduleName, {
      loaders: defaultLoaders,
    }).search(searchFrom);

    if (config && !config?.isEmpty) {
      configObjects = Array.isArray(config.config) ? config.config : [config.config];
    }
  } catch (err) {
    console.error(err);
  }

  if (configObjects.length === 0) {
    const migrateService = new MigrateService({
      dryRun: replaceEnv(options.dryRun) === 'true',
      historyTable: replaceEnv(options.historyTable),
      historySchema: replaceEnv(options.historySchema),
      databaseUrl: replaceEnv(options.databaseUrl || ''),
      locations: replaceEnv(options.locations)
        .split(',')
        .map((s) => s.trim()),
      sqlMigrationSuffixes: replaceEnv(options.sqlMigrationSuffixes)
        .split(',')
        .map((s) => s.trim()),
      sqlMigrationSeparator: replaceEnv(options.sqlMigrationSeparator),
      sqlMigrationStatementSeparator: replaceEnv(options.sqlMigrationStatementSeparator),
    });
    await migrateService.migrate();
    migrateService.destroy();
  } else {
    for (let index = 0; index < configObjects.length; index++) {
      const configObject = configObjects[index];
      const migrateService = new MigrateService({
        dryRun: replaceEnv(configObject.dryRun || options.dryRun) === 'true',
        historyTable: replaceEnv(configObject.historyTable || options.historyTable),
        historySchema: replaceEnv(configObject.historySchema || options.historySchema),
        databaseUrl: replaceEnv(configObject.databaseUrl || options.databaseUrl || ''),
        locations: replaceEnv(configObject.locations || options.locations)
          .split(',')
          .map((s) => s.trim()),
        sqlMigrationSuffixes: replaceEnv(configObject.sqlMigrationSuffixes || options.sqlMigrationSuffixes)
          .split(',')
          .map((s) => s.trim()),
        sqlMigrationSeparator: replaceEnv(configObject.sqlMigrationSeparator || options.sqlMigrationSeparator),
        sqlMigrationStatementSeparator: replaceEnv(
          configObject.sqlMigrationStatementSeparator || options.sqlMigrationStatementSeparator
        ),
      });
      await migrateService.migrate();
      migrateService.destroy();
    }
  }
}
export function migrate(program: Command) {
  program
    .command('migrate')
    .description('Migrates the schema to the latest version')
    .addOption(
      new Option('-d,--dry-run <boolean>', 'Show content of migrations without apply them in database')
        .default(PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.dryRun)
        .env(PG_FLYWAY_DRY_RUN)
    )
    .addOption(
      new Option(
        '-c,--config <string>',
        'Configuration file for bulk migrations (example content: [{"databaseUrl":"postgres://${POSTGRES_USER}:POSTGRES_PASSWORD@localhost:POSTGRES_PORT/POSTGRES_DATABASE?schema=public"}], rules: https://github.com/cosmiconfig/cosmiconfig)'
      )
        .default(PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.config)
        .env(PG_FLYWAY_CONFIG)
    )
    .addOption(
      new Option(
        '-u,--database-url <string>',
        'Database url for connect (example: postgres://POSTGRES_USER:POSTGRES_PASSWORD@localhost:POSTGRES_PORT/POSTGRES_DATABASE?schema=public)'
      )
        .default(PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.databaseUrl)
        .env(PG_FLYWAY_DATABASE_URL)
    )
    .addOption(
      new Option('-l,--locations <strings>', 'Locations with migration files')
        .default(PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.locations)
        .env(PG_FLYWAY_LOCATIONS)
    )
    .addOption(
      new Option('-h,--history-table <string>', 'History table with states of migration')
        .default(PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.historyTable)
        .env(PG_FLYWAY_HISTORY_TABLE)
    )
    .addOption(
      new Option('--history-schema <string>', 'History table schema with states of migration')
        .default(PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.historySchema)
        .env(PG_FLYWAY_HISTORY_SCHEMA)
    )
    .addOption(
      new Option('-s,--sql-migration-suffixes <strings>', 'Extension of migration files')
        .default(PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationSuffixes)
        .env(PG_FLYWAY_SQL_MIGRATION_SUFFIXES)
    )
    .addOption(
      new Option(
        '--sql-migration-separator <strings>',
        'Version separator (example: V1__Name.sql, sqlMigrationSeparator= "__")'
      )
        .default(PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationSeparator)
        .env(PG_FLYWAY_SQL_MIGRATION_SEPARATOR)
    )
    .addOption(
      new Option('--sql-migration-statement-separator <strings>', 'Separator of nested queries within a sql query')
        .default(PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationStatementSeparator)
        .env(PG_FLYWAY_SQL_MIGRATION_STATEMENT_SEPARATOR)
    )
    .action((options: MigrateHandlerOptions) => migrateHandler(options));
}

import { CreateEmptyMigrationHandlerOptions } from '../types/create-empty-migration-handler-options';
import { InfoHandlerOptions } from '../types/info-handler-options';
import { MigrateHandlerOptions } from '../types/migrate-handler-options';

export const PG_FLYWAY_DEFAULT_HISTORY_TABLE = '__migrations';
export const PG_FLYWAY_DEFAULT_HISTORY_SCHEMA = 'public';
export const PG_FLYWAY_CONFIG_NAME = 'pgFlyway';

export const PG_FLYWAY_DEFAULT_MIGRATE_CONFIG: MigrateHandlerOptions = {
  dryRun: 'false',
  config: PG_FLYWAY_CONFIG_NAME,
  databaseUrl: '',
  locations: 'migrations',
  historyTable: PG_FLYWAY_DEFAULT_HISTORY_TABLE,
  historySchema: PG_FLYWAY_DEFAULT_HISTORY_SCHEMA,
  sqlMigrationSuffixes: '.sql',
  sqlMigrationSeparator: '__',
  sqlMigrationStatementSeparator: '--',
};

export const PG_FLYWAY_DEFAULT_INFO_CONFIG: InfoHandlerOptions = {
  databaseUrl: '',
  historyTable: PG_FLYWAY_DEFAULT_HISTORY_TABLE,
  historySchema: PG_FLYWAY_DEFAULT_HISTORY_SCHEMA,
};

export const PG_FLYWAY_DEFAULT_CREATE_EMPTY_MIGRATION_CONFIG: Omit<
  CreateEmptyMigrationHandlerOptions,
  'name' | 'version'
> = {
  locations: 'migrations',
  sqlMigrationSuffixes: '.sql',
  sqlMigrationSeparator: '__',
};

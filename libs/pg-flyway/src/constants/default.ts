export const PG_FLYWAY_DEFAULT_HISTORY_TABLE = '__migrations';
export const PG_FLYWAY_DEFAULT_HISTORY_SCHEMA = 'public';
export const PG_FLYWAY_CONFIG_NAME = 'pgFlyway';

export const PG_FLYWAY_DEFAULT_MIGRATE_CONFIG = {
  locations: 'migrations',
  historyTable: PG_FLYWAY_DEFAULT_HISTORY_TABLE,
  historySchema: PG_FLYWAY_DEFAULT_HISTORY_SCHEMA,
  sqlMigrationSuffixes: '.sql',
  sqlMigrationSeparator: '__',
  sqlMigrationStatementSeparator: '--',
};

export const PG_FLYWAY_DEFAULT_HISTORY_TABLE = '__migrations';
export const PG_FLYWAY_DEFAULT_HISTORY_SCHEMA = 'public';
export const PG_FLYWAY_CONFIG_NAME = 'pgFlyway';

export interface MigrateConfig {
  locations?: string[];
  historyTable?: string;
  historySchema?: string;
  sqlMigrationSuffixes?: string[];
  sqlMigrationSeparator?: string;
  sqlMigrationStatementSeparator?: string;
}

export const PG_FLYWAY_DEFAULT_MIGRATE_CONFIG: Required<MigrateConfig> = {
  locations: ['migrations'],
  historyTable: PG_FLYWAY_DEFAULT_HISTORY_TABLE,
  historySchema: PG_FLYWAY_DEFAULT_HISTORY_SCHEMA,
  sqlMigrationSuffixes: ['.sql'],
  sqlMigrationSeparator: '__',
  sqlMigrationStatementSeparator: '--',
};

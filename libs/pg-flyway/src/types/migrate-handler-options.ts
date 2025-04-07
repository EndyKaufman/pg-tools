export type MigrateHandlerOptions = {
  dryRun: string;
  config: string;
  databaseUrl?: string;
  locations: string;
  historyTable: string;
  historySchema: string;
  sqlMigrationSuffixes: string;
  sqlMigrationSeparator: string;
  sqlMigrationStatementSeparator: string;
};

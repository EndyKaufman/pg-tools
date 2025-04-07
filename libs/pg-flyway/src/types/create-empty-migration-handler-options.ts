export type CreateEmptyMigrationHandlerOptions = {
  name: string;
  version?: string;
  locations: string;
  sqlMigrationSuffixes: string;
  sqlMigrationSeparator: string;
};

export type CreateDatabaseHandlerOptions = {
  dryRun: string;
  config: string;
  rootDatabaseUrl: string;
  appDatabaseUrl: string;
  forceChangeUsername: string;
  forceChangePassword: string;
  dropAppDatabase: string;
  extensions: string;
};

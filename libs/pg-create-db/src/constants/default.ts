import { CreateDatabaseHandlerOptions } from '../types/create-database-handler-options';

export const PG_CREATE_DB_CONFIG_NAME = 'pgCreateDb';
export const PG_CREATE_DB_DEFAULT_CONFIG: CreateDatabaseHandlerOptions = {
  dryRun: 'false',
  config: PG_CREATE_DB_CONFIG_NAME,
  rootDatabaseUrl: '',
  appDatabaseUrl: '',
  forceChangeUsername: 'false',
  forceChangePassword: 'false',
  dropAppDatabase: 'false',
  extensions: 'uuid-ossp,pg_trgm',
};

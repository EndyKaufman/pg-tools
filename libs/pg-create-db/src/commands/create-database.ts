import { Command, Option } from 'commander';
import {
  PG_CREATE_DB_APP_DATABASE_URL,
  PG_CREATE_DB_DROP_APP_DATABASE,
  PG_CREATE_DB_DRY_RUN,
  PG_CREATE_DB_EXTENSIONS,
  PG_CREATE_DB_FORCE_CHANGE_PASSWORD,
  PG_CREATE_DB_FORCE_CHANGE_USERNAME,
  PG_CREATE_DB_ROOT_DATABASE_URL,
} from '../constants/env-keys';
import { CreateDatabaseService } from '../services/create-database.service';

export function createDatabase(program: Command) {
  program
    .addOption(
      new Option('-d,--dry-run <boolean>', 'Show queries to execute without apply them in database.')
        .default('false')
        .env(PG_CREATE_DB_DRY_RUN)
    )
    .addOption(
      new Option(
        '-r,--root-database-url <string>',
        'Database url for connect as root user (example: postgres://postgres:ROOT_POSTGRES_PASSWORD@localhost:POSTGRES_PORT/postgres?schema=public).'
      ).env(PG_CREATE_DB_ROOT_DATABASE_URL)
    )
    .addOption(
      new Option(
        '-a,--app-database-url <string>',
        'Application database url used for create new database (example: postgres://POSTGRES_USER:POSTGRES_PASSWORD@localhost:POSTGRES_PORT/POSTGRES_DATABASE?schema=public).'
      ).env(PG_CREATE_DB_APP_DATABASE_URL)
    )
    .addOption(
      new Option(
        '-n,--force-change-username <boolean>',
        'Force rename username if one exists in database for app-database-url excluding root (default: false).'
      )
        .default('false')
        .env(PG_CREATE_DB_FORCE_CHANGE_USERNAME)
    )
    .addOption(
      new Option(
        '-p,--force-change-password <boolean>',
        'Force change password of specified app-database-url (default: false).'
      )
        .default('false')
        .env(PG_CREATE_DB_FORCE_CHANGE_PASSWORD)
    )
    .addOption(
      new Option('-c,--drop-app-database <boolean>', 'Drop application database before try create it (default: false).')
        .default('false')
        .env(PG_CREATE_DB_DROP_APP_DATABASE)
    )
    .addOption(
      new Option('-e,--extensions <boolean>', 'Default extensions (default: uuid-ossp,pg_trgm).')
        .default('uuid-ossp,pg_trgm')
        .env(PG_CREATE_DB_EXTENSIONS)
    );
}

export function checkToRunCreateDatabaseHandler(options: {
  dryRun: string;
  rootDatabaseUrl: string;
  appDatabaseUrl: string;
}) {
  return Object.keys(options).filter(Boolean).length > 0;
}

export async function createDatabaseHandler(options: {
  dryRun: string;
  rootDatabaseUrl: string;
  appDatabaseUrl: string;
  forceChangeUsername: string;
  forceChangePassword: string;
  dropAppDatabase: string;
  extensions: string;
}) {
  const createDatabaseService = new CreateDatabaseService(Boolean(options.dryRun?.toLowerCase() === 'true'));
  await createDatabaseService.createDatabase({
    ...options,
    extensions: options.extensions.split(','),
    forceChangePassword: Boolean(options.forceChangePassword?.toLowerCase() === 'true'),
    forceChangeUsername: Boolean(options.forceChangeUsername?.toLowerCase() === 'true'),
    dropAppDatabase: Boolean(options.dropAppDatabase?.toLowerCase() === 'true'),
  });
}

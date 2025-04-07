import { Command, Option } from 'commander';
import { cosmiconfig, defaultLoaders } from 'cosmiconfig';
import { basename, dirname, join, sep } from 'path';
import { PG_CREATE_DB_DEFAULT_CONFIG } from '../constants/default';
import {
  PG_CREATE_DB_APP_DATABASE_URL,
  PG_CREATE_DB_CONFIG,
  PG_CREATE_DB_DROP_APP_DATABASE,
  PG_CREATE_DB_DRY_RUN,
  PG_CREATE_DB_EXTENSIONS,
  PG_CREATE_DB_FORCE_CHANGE_PASSWORD,
  PG_CREATE_DB_FORCE_CHANGE_USERNAME,
  PG_CREATE_DB_ROOT_DATABASE_URL,
} from '../constants/env-keys';
import { CreateDatabaseService } from '../services/create-database.service';
import { CreateDatabaseHandlerOptions } from '../types/create-database-handler-options';
import { replaceEnv } from '../utils/replace-env';

export function createDatabase(program: Command) {
  program
    .addOption(
      new Option('-d,--dry-run <boolean>', 'Show queries to execute without apply them in database')
        .default(PG_CREATE_DB_DEFAULT_CONFIG.dryRun)
        .env(PG_CREATE_DB_DRY_RUN)
    )
    .addOption(
      new Option(
        '-c,--config <string>',
        'Configuration file for bulk migrations (example content: [{"databaseUrl":"postgres://${POSTGRES_USER}:POSTGRES_PASSWORD@localhost:POSTGRES_PORT/POSTGRES_DATABASE?schema=public"}], rules: https://github.com/cosmiconfig/cosmiconfig)'
      )
        .default(PG_CREATE_DB_DEFAULT_CONFIG.config)
        .env(PG_CREATE_DB_CONFIG)
    )
    .addOption(
      new Option(
        '-r,--root-database-url <string>',
        'Database url for connect as root user (example: postgres://postgres:ROOT_POSTGRES_PASSWORD@localhost:POSTGRES_PORT/postgres?schema=public)'
      )
        .default(PG_CREATE_DB_DEFAULT_CONFIG.rootDatabaseUrl)
        .env(PG_CREATE_DB_ROOT_DATABASE_URL)
    )
    .addOption(
      new Option(
        '-a,--app-database-url <string>',
        'Application database url used for create new database (example: postgres://POSTGRES_USER:POSTGRES_PASSWORD@localhost:POSTGRES_PORT/POSTGRES_DATABASE?schema=public)'
      )
        .default(PG_CREATE_DB_DEFAULT_CONFIG.appDatabaseUrl)
        .env(PG_CREATE_DB_APP_DATABASE_URL)
    )
    .addOption(
      new Option(
        '-n,--force-change-username <boolean>',
        'Force rename username if one exists in database for app-database-url excluding root'
      )
        .default(PG_CREATE_DB_DEFAULT_CONFIG.forceChangeUsername)
        .env(PG_CREATE_DB_FORCE_CHANGE_USERNAME)
    )
    .addOption(
      new Option('-p,--force-change-password <boolean>', 'Force change password of specified app-database-url')
        .default(PG_CREATE_DB_DEFAULT_CONFIG.forceChangePassword)
        .env(PG_CREATE_DB_FORCE_CHANGE_PASSWORD)
    )
    .addOption(
      new Option('--drop-app-database <boolean>', 'Drop application database before try create it')
        .default(PG_CREATE_DB_DEFAULT_CONFIG.dropAppDatabase)
        .env(PG_CREATE_DB_DROP_APP_DATABASE)
    )
    .addOption(
      new Option('-e,--extensions <boolean>', 'Default extensions')
        .default(PG_CREATE_DB_DEFAULT_CONFIG.extensions)
        .env(PG_CREATE_DB_EXTENSIONS)
    );
}

export function checkToRunCreateDatabaseHandler(options: CreateDatabaseHandlerOptions) {
  return Object.keys(options).filter(Boolean).length > 0;
}

export async function createDatabaseHandler(options: CreateDatabaseHandlerOptions) {
  let configObjects: {
    dryRun: string;
    rootDatabaseUrl: string;
    appDatabaseUrl: string;
    forceChangeUsername: string;
    forceChangePassword: string;
    dropAppDatabase: string;
    extensions: string;
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
    const createDatabaseService = new CreateDatabaseService(
      Boolean(replaceEnv(options.dryRun)?.toLowerCase() === 'true')
    );
    await createDatabaseService.createDatabase({
      appDatabaseUrl: replaceEnv(options.appDatabaseUrl),
      rootDatabaseUrl: replaceEnv(options.rootDatabaseUrl),
      extensions: replaceEnv(options.extensions).split(','),
      forceChangePassword: Boolean(replaceEnv(options.forceChangePassword)?.toLowerCase() === 'true'),
      forceChangeUsername: Boolean(replaceEnv(options.forceChangeUsername)?.toLowerCase() === 'true'),
      dropAppDatabase: Boolean(replaceEnv(options.dropAppDatabase)?.toLowerCase() === 'true'),
    });
  } else {
    for (let index = 0; index < configObjects.length; index++) {
      const configObject = configObjects[index];
      const createDatabaseService = new CreateDatabaseService(
        Boolean(replaceEnv(configObject.dryRun || options.dryRun)?.toLowerCase() === 'true')
      );
      await createDatabaseService.createDatabase({
        appDatabaseUrl: replaceEnv(configObject.appDatabaseUrl),
        rootDatabaseUrl: replaceEnv(configObject.rootDatabaseUrl || options.rootDatabaseUrl),
        extensions: replaceEnv(configObject.extensions || options.extensions).split(','),
        forceChangePassword: Boolean(
          replaceEnv(configObject.forceChangePassword || options.forceChangePassword)?.toLowerCase() === 'true'
        ),
        forceChangeUsername: Boolean(
          replaceEnv(configObject.forceChangeUsername || options.forceChangeUsername)?.toLowerCase() === 'true'
        ),
        dropAppDatabase: Boolean(
          replaceEnv(configObject.dropAppDatabase || options.dropAppDatabase)?.toLowerCase() === 'true'
        ),
      });
    }
  }
}

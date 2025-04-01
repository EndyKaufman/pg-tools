import { ConnectionString } from 'connection-string';
import { getLogger, Logger } from 'log4js';
import { getLogLevel } from '../utils/get-log-level';
import { replaceEnv } from '../utils/replace-env';

export class CreateDatabaseService {
  protected logger: Logger;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rootDatabaseConnection: any; // pgp.IDatabase<any, pg.IClient>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private Client: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pgp: any;

  constructor(private readonly dryRun: boolean) {
    this.logger = getLogger('create-database');
    this.logger.level = getLogLevel();
    this.logger.info(`dryRun: ${dryRun}`);
  }

  loadPackages() {
    if (!this.Client) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.Client = require('pg').Client;
    }
    if (!this.pgp) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.pgp = require('pg-promise');
    }
  }

  async createDatabase({
    rootDatabaseUrl,
    appDatabaseUrl,
    forceChangeUsername,
    forceChangePassword,
    dropAppDatabase,
    extensions,
  }: {
    rootDatabaseUrl: string;
    appDatabaseUrl: string;
    forceChangeUsername?: boolean;
    forceChangePassword?: boolean;
    dropAppDatabase?: boolean;
    extensions: string[];
  }) {
    rootDatabaseUrl = replaceEnv(rootDatabaseUrl);
    appDatabaseUrl = replaceEnv(appDatabaseUrl);

    this.loadPackages();

    await this.checkSuperuserName(rootDatabaseUrl);

    if (dropAppDatabase) {
      await this.dropAppDatabaseHandler(rootDatabaseUrl, appDatabaseUrl);
    }

    if (forceChangeUsername) {
      await this.forceChangeUsername(rootDatabaseUrl, appDatabaseUrl);
    }

    await this.createAppDatabaseHandler(rootDatabaseUrl, appDatabaseUrl, extensions, forceChangePassword);

    await this.closeRootDbConnection();
  }

  async dropAppDatabaseHandler(rootDatabaseUrl: string, appDatabaseUrl: string): Promise<void> {
    this.logger.info('Start drop database...');
    const rootDatabase = this.parseDatabaseUrl(rootDatabaseUrl);
    const appDatabase = this.parseDatabaseUrl(appDatabaseUrl);
    this.logger.debug('Root database:', rootDatabase.DATABASE);
    this.logger.debug('App database:', appDatabase.DATABASE);
    const db = this.getRootDbConnection({
      username: rootDatabase.USERNAME,
      password: rootDatabase.PASSWORD,
      port: rootDatabase.PORT,
      host: (rootDatabase.HOST || '').split(':')[0],
      database: rootDatabase.DATABASE,
    });
    if (appDatabase.USERNAME !== rootDatabase.USERNAME) {
      try {
        if (this.dryRun) {
          this.logger.info(`DROP DATABASE "${appDatabase.DATABASE}"`);
        } else {
          this.logger.debug(`DROP DATABASE "${appDatabase.DATABASE}"`);
          await db.none(`DROP DATABASE "${appDatabase.DATABASE}"`, []);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (!String(err).includes('already exists')) {
          this.logger.error(err, err.stack);
          throw err;
        }
      }
    } else {
      this.logger.error(`Application database user and root database user must be different`);
    }
    this.logger.info('End of drop database...');
  }

  async createAppDatabaseHandler(
    rootDatabaseUrl: string,
    appDatabaseUrl: string,
    extensions: string[],
    forceChangePassword?: boolean
  ): Promise<void> {
    this.logger.info('Start create database...');
    const rootDatabase = this.parseDatabaseUrl(rootDatabaseUrl);
    const appDatabase = this.parseDatabaseUrl(appDatabaseUrl);
    this.logger.debug('Root database:', rootDatabase.DATABASE);
    this.logger.debug('App database:', appDatabase.DATABASE);
    const db = this.getRootDbConnection({
      username: rootDatabase.USERNAME,
      password: rootDatabase.PASSWORD,
      port: rootDatabase.PORT,
      host: (rootDatabase.HOST || '').split(':')[0],
      database: rootDatabase.DATABASE,
    });
    try {
      if (appDatabase.USERNAME !== rootDatabase.USERNAME) {
        try {
          if (this.dryRun) {
            this.logger.info(`CREATE DATABASE ${appDatabase.DATABASE}`);
          } else {
            this.logger.debug(`CREATE DATABASE ${appDatabase.DATABASE}`);
            await db.none('CREATE DATABASE $1:name', [appDatabase.DATABASE]);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          if (!String(err).includes('already exists')) {
            this.logger.error(err, err.stack);
            throw err;
          } else {
            if (forceChangePassword) {
              await this.forceChangePassword(rootDatabaseUrl, appDatabaseUrl);
            }
          }
        }

        await this.applyPermissionsHandler(rootDatabaseUrl, appDatabaseUrl);

        const updateDatabaseQuery = extensions
          .map((extension) => `CREATE EXTENSION IF NOT EXISTS "${extension}"`)
          .filter(Boolean)
          .map(
            (sql) =>
              `${sql};` ||
              `DO $$ BEGIN
    ${sql};
    EXCEPTION
    WHEN others THEN null;
    END $$;`
          );
        const pgAppConfig = {
          user: appDatabase.USERNAME,
          host: (rootDatabase.HOST || '').split(':')[0],
          password: appDatabase.PASSWORD,
          port: rootDatabase.PORT,
          database: appDatabase.DATABASE,
          idleTimeoutMillis: 30000,
        };
        const appClient = new this.Client(pgAppConfig);
        await appClient.connect();
        for (const query of updateDatabaseQuery) {
          try {
            if (this.dryRun) {
              this.logger.info(query);
            } else {
              this.logger.debug(query);
              await appClient.query(query);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (err: any) {
            if (!String(err).includes('already exists')) {
              this.logger.debug(query);
              this.logger.error(err, err.stack);
              throw err;
            }
          }
        }
        await appClient.end();
      } else {
        this.logger.error(`Application database user and root database user must be different`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (!String(err).includes('already exists')) {
        this.logger.error(err, err.stack);
        throw err;
      }
    }
    this.logger.info('End of create database...');
  }

  async forceChangePassword(rootDatabaseUrl: string, appDatabaseUrl: string) {
    const rootDatabase = this.parseDatabaseUrl(rootDatabaseUrl);
    const appDatabase = this.parseDatabaseUrl(appDatabaseUrl);
    const db = this.getRootDbConnection({
      username: rootDatabase.USERNAME,
      password: rootDatabase.PASSWORD,
      port: rootDatabase.PORT,
      host: (rootDatabase.HOST || '').split(':')[0],
      database: rootDatabase.DATABASE,
    });

    this.logger.debug(`ALTERING PASSWORD OF ${appDatabase.USERNAME} to '${appDatabase.PASSWORD}'`);
    await db.none(`ALTER USER $1:name WITH PASSWORD '${appDatabase.PASSWORD}'`, [appDatabase.USERNAME]);
  }

  async checkSuperuserName(rootDatabaseUrl: string) {
    const rootDatabase = this.parseDatabaseUrl(rootDatabaseUrl);
    if (rootDatabase.USERNAME !== 'postgres') {
      throw Error(
        `The username for the root database must always be "postgres", otherwise the user will not receive "super" rights, current username "${rootDatabase.USERNAME}"`
      );
    }
  }

  async forceChangeUsername(rootDatabaseUrl: string, appDatabaseUrl: string) {
    const rootDatabase = this.parseDatabaseUrl(rootDatabaseUrl);
    const appDatabase = this.parseDatabaseUrl(appDatabaseUrl);

    this.logger.info('Start updating username...');

    const db = this.getRootDbConnection({
      username: rootDatabase.USERNAME,
      password: rootDatabase.PASSWORD,
      port: rootDatabase.PORT,
      host: (rootDatabase.HOST || '').split(':')[0],
      database: rootDatabase.DATABASE,
    });

    try {
      // Get a list of users
      const users: { datname: string; allowed_users: string }[] = await db.any(`
      select d.datname, (select string_agg(u.usename, ',' order by u.usename) 
      from pg_user u where has_database_privilege(u.usename, d.datname, 'CREATE')) 
      as allowed_users from pg_database d order by d.datname`);
      const curDb = users.find(({ datname }) => datname === appDatabase.DATABASE);

      if (!curDb) {
        throw new Error(`"${appDatabase.DATABASE}" does not exist! force change username was not applied`);
      }

      const nonRootUsers = curDb.allowed_users.split(',').filter((user) => user !== rootDatabase.USERNAME);

      // Verify that there is only one non-root user
      if (nonRootUsers.length === 1) {
        if (nonRootUsers[0] === appDatabase.USERNAME) {
          return;
        }

        if (this.dryRun) {
          this.logger.info(`ALTER USER '${nonRootUsers[0]}':name RENAME TO '${appDatabase.USERNAME}':name`);
          this.logger.info(`ALTER USER '${appDatabase.USERNAME}':name WITH PASSWORD '${appDatabase.PASSWORD}'`);
        } else {
          await db.none(`ALTER USER $1:name RENAME TO $2:name`, [nonRootUsers[0], appDatabase.USERNAME]);
          await db.none(`ALTER USER $1:name WITH PASSWORD '${appDatabase.PASSWORD}'`, [appDatabase.USERNAME]);
          this.logger.info('Username have been updated...');
        }
      } else {
        this.logger.error('There are multiple non-root users in the database: ', nonRootUsers);
        throw new Error('Cannot update credentials: multiple non-root users exist');
      }
    } catch (error) {
      if (!String(error).includes('does not exist')) {
        throw error;
      }
    }
  }

  getRootDbConnection(rootDatabase: {
    username?: string;
    password?: string;
    host?: string;
    database?: string;
    port?: number;
  }) {
    if (!this.rootDatabaseConnection) {
      this.rootDatabaseConnection = this.pgp({})({
        user: rootDatabase.username,
        password: rootDatabase.password,
        port: rootDatabase.port,
        host: (rootDatabase.host || '').split(':')[0],
        database: rootDatabase.database,
      });
    }
    return this.rootDatabaseConnection;
  }

  async closeRootDbConnection() {
    await this.rootDatabaseConnection.$pool.end();
    this.rootDatabaseConnection = null;
  }

  async applyPermissionsHandler(rootDatabaseUrl: string, appDatabaseUrl: string): Promise<void> {
    this.logger.info('Start apply permissions...');
    this.logger.debug('Root database url:', rootDatabaseUrl);
    this.logger.debug('App database url:', appDatabaseUrl);
    const rootDatabase = this.parseDatabaseUrl(rootDatabaseUrl);
    const appDatabase = this.parseDatabaseUrl(appDatabaseUrl);

    const createDatabaseQuery = [
      appDatabase.USERNAME !== rootDatabase.USERNAME &&
        `CREATE USER "${appDatabase.USERNAME}" WITH PASSWORD '${appDatabase.PASSWORD}'`,
      appDatabase.USERNAME !== rootDatabase.USERNAME &&
        `grant connect on database "${appDatabase.DATABASE}" to "${appDatabase.USERNAME}"`,
      appDatabase.USERNAME !== rootDatabase.USERNAME && `grant all on schema public to "${appDatabase.USERNAME}"`,
      appDatabase.USERNAME !== rootDatabase.USERNAME &&
        `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${appDatabase.USERNAME}"`,
      `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${appDatabase.USERNAME}"`,
      `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${appDatabase.USERNAME}"`,
      `GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO "${appDatabase.USERNAME}"`,

      `GRANT delete, insert, references, select, trigger, truncate, update ON ALL TABLES IN SCHEMA public TO "${appDatabase.USERNAME}"`,
      `GRANT select, update, usage ON ALL SEQUENCES IN SCHEMA public TO "${appDatabase.USERNAME}"`,
      `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO "${appDatabase.USERNAME}"`,

      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${appDatabase.USERNAME}"`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${appDatabase.USERNAME}"`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO "${appDatabase.USERNAME}"`,

      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT delete, insert, references, select, trigger, truncate, update ON TABLES TO "${appDatabase.USERNAME}"`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT select, update, usage ON SEQUENCES TO "${appDatabase.USERNAME}"`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO "${appDatabase.USERNAME}"`,

      `GRANT ALL PRIVILEGES ON DATABASE "${appDatabase.DATABASE}" TO "${appDatabase.USERNAME}"`,
      appDatabase.USERNAME !== rootDatabase.USERNAME &&
        `GRANT ALL PRIVILEGES ON DATABASE "${appDatabase.DATABASE}" TO ${rootDatabase.USERNAME}`,
      appDatabase.USERNAME !== rootDatabase.USERNAME &&
        `ALTER USER "${appDatabase.USERNAME}" WITH LOGIN CREATEROLE NOCREATEDB NOSUPERUSER INHERIT`,
      appDatabase.USERNAME !== rootDatabase.USERNAME &&
        `DO $$ BEGIN
DECLARE
    t record;
BEGIN
    FOR t IN
        (select 'GRANT ALL ON TABLE ' || schemaname || '."' || tablename || '" to "${appDatabase.USERNAME}"' query
            from pg_tables
            where schemaname in ('public')
            order by schemaname, tablename)
        LOOP
            EXECUTE format('%s', t.query);
        END LOOP;
END;
END $$`,
    ]
      .filter(Boolean)
      .map(
        (sql) => `${sql};` /* ||
                `DO $$ BEGIN
${sql};
EXCEPTION
WHEN others THEN null;
END $$;`*/
      );
    const pgConfig = {
      user: rootDatabase.USERNAME,
      host: (rootDatabase.HOST || '').split(':')[0],
      password: rootDatabase.PASSWORD,
      port: rootDatabase.PORT,
      database: appDatabase.DATABASE,
      idleTimeoutMillis: 30000,
    };
    const client = new this.Client(pgConfig);
    await client.connect();
    for (const query of createDatabaseQuery) {
      try {
        if (this.dryRun) {
          this.logger.info(query);
        } else {
          this.logger.debug(query);
          await client.query(query);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (!String(err).includes('already exists')) {
          this.logger.debug(query);
          this.logger.error(err, err.stack);
          throw err;
        }
      }
    }
    await client.end();

    this.logger.info('End of apply permissions...');
  }

  parseDatabaseUrl(databaseUrl: string): {
    USERNAME?: string;
    PASSWORD?: string;
    HOST?: string;
    DATABASE?: string;
    SCHEMA: string;
    SCHEMAS: string;
    PORT?: number;
  } {
    try {
      const cs = new ConnectionString(databaseUrl);
      const USERNAME = cs.user;
      const PASSWORD = cs.password;
      const PORT = cs.port;
      const HOST = cs.hosts && cs.hosts[0].toString();
      const DATABASE = cs.path && cs.path[0];
      const SCHEMA = cs.params && cs.params['schema'];
      const SCHEMAS = cs.params && cs.params['schemas'];
      return { USERNAME, PASSWORD, HOST, DATABASE, SCHEMA, SCHEMAS, PORT };
    } catch (err) {
      this.logger.debug({ databaseUrl });
      throw err;
    }
  }
}

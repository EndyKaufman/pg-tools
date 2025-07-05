import { ConnectionString } from 'connection-string';
import { getLogger, Logger } from 'log4js';
import { orderBy } from 'natural-orderby';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import recursive from 'recursive-readdir';
import { PostgresError } from '../constants/postgres-error';
import { Collection } from '../types/collection';
import { CALLBACK_KEYS, MgrationFileMetadata, Migration } from '../types/migration';
import { PoolClient } from '../types/pool-client';
import { getLogLevel } from '../utils/get-log-level';
import { History, HistoryTableService } from './history-table.service';

export class MigrateService {
  protected logger: Logger;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected Pool: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected client: any;

  protected historyTableService: HistoryTableService;

  constructor(
    private readonly options: {
      dryRun?: boolean;
      historyTable?: string;
      historySchema?: string;
      databaseUrl: string;
      locations: string[];
      sqlMigrationSuffixes: string[];
      sqlMigrationSeparator: string;
      sqlMigrationStatementSeparator: string;
    },
  ) {
    this.logger = getLogger('migrate');
    this.logger.level = getLogLevel();

    if (!options.dryRun && !options.databaseUrl) {
      throw Error('databaseUrl not set');
    }
    this.historyTableService = new HistoryTableService(options.historyTable, options.historySchema);
  }

  getHistoryTableService() {
    return this.historyTableService;
  }

  destroy() {
    if (this.client) {
      this.client.release(true);
      this.client = null;
    }
  }

  async getClient() {
    if (!this.options.dryRun && !this.client) {
      if (!this.Pool) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        this.Pool = require('pg').Pool;
      }

      const pool = new this.Pool({ connectionString: this.options.databaseUrl });
      this.client = await pool.connect();
    }
    return this.client;
  }

  async migrate() {
    if (this.options.dryRun) {
      this.logger.info(`Dry run: true`);
    }
    this.logger.info(`Locations: ${this.options.locations.join(',')}`);
    this.logger.info(`HistoryTable: ${this.options.historyTable}`);
    const password = new ConnectionString(this.options.databaseUrl).password;
    if (password) {
      this.logger.info(`DatabaseUrl: ${this.options.databaseUrl.split(password).join('********')}`);
    }

    const migrations: Migration[] = await this.getMigrations();
    this.logger.info(`Migrations: ${migrations.filter((m) => m.versioned || m.repeatable || m.undo).length}`);

    await this.getClient();

    await this.execSqlForStatements({
      migration: Migration.fromStatements({
        statements: [this.historyTableService.getCreateHistoryTableSql()],
      }),
      placeholders: {},
    });

    const histories = (
      await this.execSqlForStatements<History>({
        migration: Migration.fromStatements({
          statements: [this.historyTableService.getMigrationsHistorySql()],
        }),
        placeholders: {},
      })
    ).flat();

    let collection: Collection = {
      filedir: '',
      callback: {},
    };

    collection = await this.loopForVersionedMigrations({
      migrations,
      histories,
      collection,
    });

    await this.loopForRepeatableMigrations({
      migrations,
      histories,
      collection,
    });
  }

  private async getMigrations() {
    const files: MgrationFileMetadata[] = orderBy(await this.getFiles(), 'filepath');

    const migrations: Migration[] = [];
    for (const file of files) {
      migrations.push(
        await new Migration(
          file.filepath,
          this.options.sqlMigrationSeparator,
          this.options.sqlMigrationStatementSeparator,
          file.sqlMigrationSuffix,
          file.location,
        ).fill(await this.loadMigrationFile(file.filepath)),
      );
    }
    return migrations;
  }

  private async loopForRepeatableMigrations({
    migrations,
    histories,
    collection,
  }: {
    migrations: Migration[];
    histories: History[];
    collection: Collection;
  }) {
    try {
      for (const migration of migrations.filter(
        (m) => m.repeatable && !histories.find((h) => h && h.script === m.script && h.checksum === m.filechecksum),
      )) {
        if (migration.filedir !== collection.filedir) {
          collection = {
            filedir: migration.filedir,
            callback: {},
          };
          for (const key of CALLBACK_KEYS) {
            collection.callback[key] = [];
          }
          for (const key of CALLBACK_KEYS) {
            collection.callback[key] = migrations.filter(
              (
                m, //m.filedir === migration.filedir &&
              ) => m.callback?.[key],
            );
          }
        }
        // beforeMigrate
        for (const beforeMigrate of collection.callback.beforeMigrate || []) {
          if (migration.filename) {
            await this.execSqlForStatements({
              migration: beforeMigrate,
              placeholders: migration,
            });
          }
        }
        // beforeEachMigrate
        for (const beforeEachMigrate of collection.callback.beforeEachMigrate || []) {
          if (migration.filename) {
            await this.execSqlForStatements({
              migration: beforeEachMigrate,
              placeholders: migration,
            });
          }
        }
        try {
          // APPLY MIGRATION
          await this.execSqlForStatements({
            placeholders: {},
            migration: migration,
            beforeEachStatement: async () => {
              // beforeEachMigrateStatement
              for (const beforeEachMigrateStatement of collection.callback.beforeEachMigrateStatement || []) {
                if (migration.filename) {
                  await this.execSqlForStatements({
                    migration: beforeEachMigrateStatement,
                    placeholders: migration,
                  });
                }
              }
            },
            afterEachStatement: async () => {
              // afterEachMigrateStatement
              for (const afterEachMigrateStatement of collection.callback.afterEachMigrateStatement || []) {
                if (migration.filename) {
                  await this.execSqlForStatements({
                    migration: afterEachMigrateStatement,
                    placeholders: migration,
                  });
                }
              }
            },
            errorEachStatement: async () => {
              // afterEachMigrateStatementError
              for (const afterEachMigrateStatementError of collection.callback.afterEachMigrateStatementError || []) {
                if (migration.filename) {
                  await this.execSqlForStatements({
                    migration: afterEachMigrateStatementError,
                    placeholders: migration,
                  });
                }
              }
            },
          });
          // afterEachMigrate
          for (const afterEachMigrate of collection.callback.afterEachMigrate || []) {
            if (migration.filename) {
              await this.execSqlForStatements({
                migration: afterEachMigrate,
                placeholders: migration,
              });
            }
          }
        } catch (afterEachMigrateError) {
          const error = Object.entries(PostgresError).find(([, code]) =>
            JSON.stringify(afterEachMigrateError).includes(`"${code}"`),
          );
          if (error) {
            this.logger.debug('afterEachMigrateError#code: ', error?.[1]);
            this.logger.debug('afterEachMigrateError#constant: ', error?.[0].toLowerCase());
          }
          this.logger.debug('afterEachMigrateError#error: ', afterEachMigrateError);
          this.logger.debug('afterEachMigrateError#migration: ', migration);
          // afterEachMigrateError
          for (const afterEachMigrateError of collection.callback.afterEachMigrateError || []) {
            if (migration.filename) {
              await this.execSqlForStatements({
                migration: afterEachMigrateError,
                placeholders: migration,
              });
            }
          }
          throw afterEachMigrateError;
        }
      }
      // afterMigrate
      for (const afterMigrate of collection.callback.afterMigrate || []) {
        await this.execSqlForStatements({
          migration: afterMigrate,
          placeholders: {},
        });
      }
      // afterMigrateApplied
      for (const afterMigrateApplied of collection.callback.afterMigrateApplied || []) {
        await this.execSqlForStatements({
          migration: afterMigrateApplied,
          placeholders: {},
        });
      }
    } catch (afterMigrateError) {
      this.logger.debug('afterMigrateError#error: ', afterMigrateError);
      // afterVersioned
      for (const afterMigrateError of collection.callback.afterMigrateError || []) {
        await this.execSqlForStatements({
          migration: afterMigrateError,
          placeholders: {},
        });
      }
      throw afterMigrateError;
    }
    return collection;
  }

  private async loopForVersionedMigrations({
    migrations,
    histories,
    collection,
  }: {
    migrations: Migration[];
    histories: History[];
    collection: Collection;
  }) {
    try {
      for (const migration of migrations.filter(
        (m) =>
          m.versioned &&
          !histories.find((h) => h && h.script === m.script && h.checksum === m.filechecksum && h.success),
      )) {
        const history = histories.find((h) => h && h.script === migration.script && h.success);
        if (history && history.checksum !== migration.filechecksum) {
          throw new Error(
            `Checksum for migration "${history.script}" are different, in the history table: ${history.checksum}, in the file system: ${migration.filechecksum}`,
          );
        }
        if (migration.filedir !== collection.filedir) {
          collection = {
            filedir: migration.filedir,
            callback: {},
          };
          for (const key of CALLBACK_KEYS) {
            collection.callback[key] = [];
          }
          for (const key of CALLBACK_KEYS) {
            collection.callback[key] = migrations.filter(
              (
                m, // m.filedir === migration.filedir &&
              ) => m.callback?.[key],
            );
          }
        }
        // beforeMigrate
        for (const beforeMigrate of collection.callback.beforeMigrate || []) {
          if (migration.filename) {
            await this.execSqlForStatements({
              migration: beforeMigrate,
              placeholders: migration,
            });
          }
        }
        // beforeEachMigrate
        for (const beforeEachMigrate of collection.callback.beforeEachMigrate || []) {
          if (migration.filename) {
            await this.execSqlForStatements({
              migration: beforeEachMigrate,
              placeholders: migration,
            });
          }
        }
        try {
          // APPLY MIGRATION
          await this.execSqlForStatements({
            placeholders: {},
            migration: migration,
            beforeEachStatement: async () => {
              // beforeEachMigrateStatement
              for (const beforeEachMigrateStatement of collection.callback.beforeEachMigrateStatement || []) {
                if (migration.filename) {
                  await this.execSqlForStatements({
                    migration: beforeEachMigrateStatement,
                    placeholders: migration,
                  });
                }
              }
            },
            afterEachStatement: async () => {
              // afterEachMigrateStatement
              for (const afterEachMigrateStatement of collection.callback.afterEachMigrateStatement || []) {
                if (migration.filename) {
                  await this.execSqlForStatements({
                    migration: afterEachMigrateStatement,
                    placeholders: migration,
                  });
                }
              }
            },
            errorEachStatement: async () => {
              // afterEachMigrateStatementError
              for (const afterEachMigrateStatementError of collection.callback.afterEachMigrateStatementError || []) {
                if (migration.filename) {
                  await this.execSqlForStatements({
                    migration: afterEachMigrateStatementError,
                    placeholders: migration,
                  });
                }
              }
            },
          });
          // afterEachMigrate
          for (const afterEachMigrate of collection.callback.afterEachMigrate || []) {
            if (migration.filename) {
              await this.execSqlForStatements({
                migration: afterEachMigrate,
                placeholders: migration,
              });
            }
          }
        } catch (afterEachMigrateError) {
          const error = Object.entries(PostgresError).find(([, code]) =>
            JSON.stringify(afterEachMigrateError).includes(`"${code}"`),
          );
          if (error) {
            this.logger.debug('afterEachMigrateError#code: ', error?.[1]);
            this.logger.debug('afterEachMigrateError#constant: ', error?.[0].toLowerCase());
          }
          this.logger.debug('afterEachMigrateError#error: ', afterEachMigrateError);
          this.logger.debug('afterEachMigrateError#migration: ', migration);
          // afterEachMigrateError
          for (const afterEachMigrateError of collection.callback.afterEachMigrateError || []) {
            if (migration.filename) {
              await this.execSqlForStatements({
                migration: afterEachMigrateError,
                placeholders: migration,
              });
            }
          }
          throw afterEachMigrateError;
        }
      }
      // afterMigrate
      for (const afterMigrate of collection.callback.afterMigrate || []) {
        await this.execSqlForStatements({
          migration: afterMigrate,
          placeholders: {},
        });
      }
      // afterMigrateApplied
      for (const afterMigrateApplied of collection.callback.afterMigrateApplied || []) {
        await this.execSqlForStatements({
          migration: afterMigrateApplied,
          placeholders: {},
        });
      }
      // afterVersioned
      for (const afterVersioned of collection.callback.afterVersioned || []) {
        await this.execSqlForStatements({
          migration: afterVersioned,
          placeholders: {},
        });
      }
    } catch (afterMigrateError) {
      this.logger.debug('afterMigrateError#error: ', afterMigrateError);
      // afterVersioned
      for (const afterMigrateError of collection.callback.afterMigrateError || []) {
        await this.execSqlForStatements({
          migration: afterMigrateError,
          placeholders: {},
        });
      }
      throw afterMigrateError;
    }
    return collection;
  }

  async loadMigrationFile(filepath: string): Promise<string> {
    return (await readFile(filepath)).toString();
  }

  async execSql({
    client,
    query,
    placeholders,
  }: {
    client?: PoolClient;
    query: string;
    migration?: Migration;
    placeholders: Record<string, string>;
  }) {
    let newQuery = query;

    for (const [key, value] of Object.entries(placeholders)) {
      newQuery = newQuery.replace(new RegExp(`%${key}%`, 'g'), value);
    }
    if (this.options.dryRun || !client) {
      this.logger.info('execSql (dryRun):', newQuery);
    } else {
      const result = await client.query(newQuery);
      return result.rows;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async execSqlForStatements<T = any>({
    migration,
    beforeEachStatement,
    afterEachStatement,
    errorEachStatement,
    placeholders,
  }: {
    migration: Migration;
    beforeEachStatement?: (client: PoolClient) => Promise<void>;
    afterEachStatement?: (client: PoolClient) => Promise<void>;
    errorEachStatement?: (client: PoolClient) => Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    placeholders: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): Promise<T[]> {
    const client = await this.getClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = [];

    let nextInstalledRank = 0;
    const startExecutionTime = new Date();
    if (migration.filepath && Object.keys(migration.callback || {}).length === 0) {
      const result = (
        await this.execSqlForStatements({
          migration: Migration.fromStatements({
            statements: [this.historyTableService.getNextInstalledRankSql()],
          }),
          placeholders: migration,
        })
      ).flat();
      nextInstalledRank = result[0]?.installed_rank || 1;
    }
    try {
      if (migration.filepath && Object.keys(migration.callback || {}).length === 0) {
        await this.execSqlForStatements({
          migration: Migration.fromStatements({
            statements: [
              this.historyTableService.getBeforeRunMigrationSql({
                migration,
                installed_rank: nextInstalledRank,
              }),
            ],
          }),
          placeholders: migration,
        });
      }
      await this.execSql({
        migration,
        query: 'BEGIN',
        client,
        placeholders,
      });
      for (let index = 0; index < migration.statements.length; index++) {
        const query = migration.statements[index];
        const line = (migration.statementLines[index - 1] || 0) + 1;
        if (beforeEachStatement && client) {
          await beforeEachStatement(client);
        }
        try {
          result.push(
            await this.execSql({
              migration,
              client,
              query,
              placeholders,
            }),
          );
          if (afterEachStatement && client) {
            await afterEachStatement(client);
          }
        } catch (errorEachStatementError) {
          const error = Object.entries(PostgresError).find(([, code]) =>
            JSON.stringify(errorEachStatementError).includes(`"${code}"`),
          );
          if (error) {
            this.logger.error('errorEachStatement#code: ', error?.[1]);
            this.logger.error('errorEachStatement#constant: ', error?.[0].toLowerCase());
          }
          if (migration.filepath) {
            this.logger.error('errorEachStatement#file: ', `${migration.filepath}:${line}:1`);
          }
          this.logger.error('errorEachStatement#error: ', errorEachStatementError);
          this.logger.error('errorEachStatement#query: ', query);

          if (errorEachStatement && client) {
            await errorEachStatement(client);
          }
          throw errorEachStatementError;
        }
      }
      await this.execSql({
        migration,
        query: 'COMMIT',
        client,
        placeholders,
      });
      if (migration.filepath && Object.keys(migration.callback || {}).length === 0) {
        await this.execSqlForStatements({
          migration: Migration.fromStatements({
            statements: [
              this.historyTableService.getAfterRunMigrationSql({
                installed_rank: nextInstalledRank,
                execution_time: +new Date() - +startExecutionTime,
                success: true,
              }),
            ],
          }),
          placeholders: migration,
        });
      }
    } catch (err) {
      if (!this.options.dryRun) {
        await this.execSql({
          migration,
          query: 'ROLLBACK',
          client,
          placeholders,
        });
      }
      if (migration.filepath && Object.keys(migration.callback || {}).length === 0) {
        await this.execSqlForStatements({
          migration: Migration.fromStatements({
            statements: [
              this.historyTableService.getAfterRunMigrationSql({
                installed_rank: nextInstalledRank,
                execution_time: +new Date() - +startExecutionTime,
                success: false,
              }),
            ],
          }),
          placeholders: migration,
        });
      }
      throw err;
    }
    return result;
  }

  async getFiles(): Promise<MgrationFileMetadata[]> {
    let files: MgrationFileMetadata[] = [];
    for (const location of this.options.locations) {
      for (const sqlMigrationSuffix of this.options.sqlMigrationSuffixes) {
        files = !existsSync(location)
          ? files
          : [
              ...files,
              ...(await recursive(location, [`!*${sqlMigrationSuffix}`])).map((filepath) => ({
                filepath,
                location,
                sqlMigrationSuffix,
              })),
            ];
      }
    }
    return files;
  }
}

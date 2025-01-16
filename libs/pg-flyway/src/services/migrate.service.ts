import { getLogger, Logger } from 'log4js';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import recursive from 'recursive-readdir';
import { Collection } from '../types/collection';
import { CALLBACK_KEYS, MgrationFileMetadata, Migration } from '../types/migration';
import { PoolClient } from '../types/pool-client';
import { getLogLevel } from '../utils/get-log-level';
import { History, HistoryTableService } from './history-table.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sort } = require('cross-path-sort');

export class MigrateService {
  protected logger: Logger;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected Pool: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected client: any;

  protected historyTableService: HistoryTableService;

  constructor() {
    this.logger = getLogger('migrate');
    this.logger.level = getLogLevel();

    this.historyTableService = new HistoryTableService();
  }

  destroy() {
    if (this.client) {
      this.client.release(true);
      this.client = null;
    }
  }

  async getClient({ databaseUrl, dryRun }: { databaseUrl?: string; dryRun?: boolean }) {
    if (!dryRun && !this.client) {
      if (!this.Pool) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        this.Pool = require('pg').Pool;
      }

      const pool = new this.Pool({ connectionString: databaseUrl });
      this.client = await pool.connect();
    }
    return this.client;
  }

  async migrate({
    dryRun,
    databaseUrl,
    locations,
    historyTable,
    historySchema,
    sqlMigrationSuffixes,
    sqlMigrationSeparator,
    sqlMigrationStatementSeparator,
  }: {
    dryRun?: boolean;
    databaseUrl: string;
    locations: string[];
    historyTable: string;
    historySchema?: string;
    sqlMigrationSuffixes: string[];
    sqlMigrationSeparator: string;
    sqlMigrationStatementSeparator: string;
  }) {
    if (dryRun) {
      this.logger.info(`Dry run: true`);
    }
    this.logger.info(`Locations: ${locations.join(',')}`);
    this.logger.info(`HistoryTable: ${historyTable}`);
    this.logger.info(`DatabaseUrl: ${databaseUrl}`);

    const migrations: Migration[] = await this.getMigrations({
      dryRun,
      locations,
      sqlMigrationSuffixes,
      sqlMigrationSeparator,
      sqlMigrationStatementSeparator,
    });
    this.logger.info(`Migrations: ${migrations.filter((m) => m.versioned || m.repeatable || m.undo).length}`);

    await this.getClient({ databaseUrl, dryRun });

    await this.execSqlForStatments({
      migration: Migration.fromStatements({
        statements: [
          this.historyTableService.getCreateHistoryTableSql({
            historyTable,
            schema: historySchema,
          }),
        ],
      }),
      databaseUrl,
      dryRun,
      historyTable,
      historySchema,
      placeholders: {},
    });

    const histories = (
      await this.execSqlForStatments<History>({
        migration: Migration.fromStatements({
          statements: [
            this.historyTableService.getMigrationsHistorySql({
              historyTable,
              schema: historySchema,
            }),
          ],
        }),
        databaseUrl,
        dryRun,
        historyTable,
        historySchema,
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
      databaseUrl,
      dryRun,
      historyTable,
      historySchema,
    });

    await this.loopForRepeatableMigrations({
      migrations,
      histories,
      collection,
      databaseUrl,
      dryRun,
      historyTable,
      historySchema,
    });
  }

  private async getMigrations({
    dryRun,
    locations,
    sqlMigrationSuffixes,
    sqlMigrationSeparator,
    sqlMigrationStatementSeparator,
  }: {
    dryRun?: boolean;
    locations: string[];
    sqlMigrationSuffixes: string[];
    sqlMigrationSeparator: string;
    sqlMigrationStatementSeparator: string;
  }) {
    const files: MgrationFileMetadata[] = sort(await this.getFiles({ dryRun, locations, sqlMigrationSuffixes }), {
      deepFirst: true,
      segmentCompareFn: (a: Migration, b: Migration) =>
        !a.filedir || !b.filedir ? 0 : a.filedir.localeCompare(b.filedir),
    });

    const migrations: Migration[] = [];
    for (const file of files) {
      migrations.push(
        await new Migration(
          file.filepath,
          sqlMigrationSeparator,
          sqlMigrationStatementSeparator,
          file.sqlMigrationSuffix,
          file.location
        ).fill(await this.loadMigrationFile(file.filepath))
      );
    }
    return migrations;
  }

  private async loopForRepeatableMigrations({
    migrations,
    histories,
    collection,
    databaseUrl,
    dryRun,
    historyTable,
    historySchema,
  }: {
    migrations: Migration[];
    histories: History[];
    collection: Collection;
    databaseUrl: string;
    dryRun?: boolean;
    historyTable: string;
    historySchema?: string;
  }) {
    try {
      for (const migration of migrations.filter(
        (m) => m.repeatable && !histories.find((h) => h && h.script === m.script && h.checksum === m.filechecksum)
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
                m //m.filedir === migration.filedir &&
              ) => m.callback?.[key]
            );
          }
        }
        // beforeMigrate
        for (const beforeMigrate of collection.callback.beforeMigrate || []) {
          if (migration.filename) {
            await this.execSqlForStatments({
              migration: beforeMigrate,
              databaseUrl,
              dryRun,
              historyTable,
              historySchema,
              placeholders: migration,
            });
          }
        }
        // beforeEachMigrate
        for (const beforeEachMigrate of collection.callback.beforeEachMigrate || []) {
          if (migration.filename) {
            await this.execSqlForStatments({
              migration: beforeEachMigrate,
              databaseUrl,
              dryRun,
              historyTable,
              historySchema,
              placeholders: migration,
            });
          }
        }
        try {
          // APPLY MIGRATION
          await this.execSqlForStatments({
            placeholders: {},
            migration: migration,
            databaseUrl,
            dryRun,
            historyTable,
            historySchema,
            beforeEachStatment: async (client) => {
              // beforeEachMigrateStatement
              for (const beforeEachMigrateStatement of collection.callback.beforeEachMigrateStatement || []) {
                if (migration.filename) {
                  await this.execSqlForStatments({
                    migration: beforeEachMigrateStatement,
                    databaseUrl,
                    client,
                    dryRun,
                    historyTable,
                    historySchema,
                    placeholders: migration,
                  });
                }
              }
            },
            afterEachStatment: async (client) => {
              // afterEachMigrateStatement
              for (const afterEachMigrateStatement of collection.callback.afterEachMigrateStatement || []) {
                if (migration.filename) {
                  await this.execSqlForStatments({
                    migration: afterEachMigrateStatement,
                    databaseUrl,
                    client,
                    dryRun,
                    historyTable,
                    historySchema,
                    placeholders: migration,
                  });
                }
              }
            },
            errorEachStatment: async (client) => {
              // afterEachMigrateStatementError
              for (const afterEachMigrateStatementError of collection.callback.afterEachMigrateStatementError || []) {
                if (migration.filename) {
                  await this.execSqlForStatments({
                    migration: afterEachMigrateStatementError,
                    databaseUrl,
                    client,
                    dryRun,
                    historyTable,
                    historySchema,
                    placeholders: migration,
                  });
                }
              }
            },
          });
        } catch (afterEachMigrateError) {
          this.logger.error('afterEachMigrateError#error: ', afterEachMigrateError);
          this.logger.info('afterEachMigrateError#migration: ', migration);
          // afterEachMigrateError
          for (const afterEachMigrateError of collection.callback.afterEachMigrateError || []) {
            if (migration.filename) {
              await this.execSqlForStatments({
                migration: afterEachMigrateError,
                databaseUrl,
                dryRun,
                historyTable,
                historySchema,
                placeholders: migration,
              });
            }
          }
          throw afterEachMigrateError;
        } finally {
          // afterEachMigrate
          for (const afterEachMigrate of collection.callback.afterEachMigrate || []) {
            if (migration.filename) {
              await this.execSqlForStatments({
                migration: afterEachMigrate,
                databaseUrl,
                dryRun,
                historyTable,
                historySchema,
                placeholders: migration,
              });
            }
          }
        }
      }
    } catch (afterMigrateError) {
      this.logger.error('afterMigrateError#error: ', afterMigrateError);
      // afterVersioned
      for (const afterMigrateError of collection.callback.afterMigrateError || []) {
        await this.execSqlForStatments({
          migration: afterMigrateError,
          databaseUrl,
          dryRun,
          historyTable,
          historySchema,
          placeholders: {},
        });
      }
      throw afterMigrateError;
    } finally {
      // afterMigrate
      for (const afterMigrate of collection.callback.afterMigrate || []) {
        await this.execSqlForStatments({
          migration: afterMigrate,
          databaseUrl,
          dryRun,
          historyTable,
          historySchema,
          placeholders: {},
        });
      }
      // afterMigrateApplied
      for (const afterMigrateApplied of collection.callback.afterMigrateApplied || []) {
        await this.execSqlForStatments({
          migration: afterMigrateApplied,
          databaseUrl,
          dryRun,
          historyTable,
          historySchema,
          placeholders: {},
        });
      }
    }
    return collection;
  }

  private async loopForVersionedMigrations({
    migrations,
    histories,
    collection,
    databaseUrl,
    dryRun,
    historyTable,
    historySchema,
  }: {
    migrations: Migration[];
    histories: History[];
    collection: Collection;
    databaseUrl: string;
    dryRun?: boolean;
    historyTable: string;
    historySchema?: string;
  }) {
    try {
      for (const migration of migrations.filter(
        (m) =>
          m.versioned &&
          !histories.find((h) => h && h.script === m.script && h.checksum === m.filechecksum && h.success)
      )) {
        const history = histories.find((h) => h && h.script === migration.script && h.success);
        if (history && history.checksum !== migration.filechecksum) {
          throw new Error(
            `Checksum for migration "${history.script}" are different, in the history table: ${history.checksum}, in the file system: ${migration.filechecksum}`
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
                m // m.filedir === migration.filedir &&
              ) => m.callback?.[key]
            );
          }
        }
        // beforeMigrate
        for (const beforeMigrate of collection.callback.beforeMigrate || []) {
          if (migration.filename) {
            await this.execSqlForStatments({
              migration: beforeMigrate,
              databaseUrl,
              dryRun,
              historyTable,
              historySchema,
              placeholders: migration,
            });
          }
        }
        // beforeEachMigrate
        for (const beforeEachMigrate of collection.callback.beforeEachMigrate || []) {
          if (migration.filename) {
            await this.execSqlForStatments({
              migration: beforeEachMigrate,
              databaseUrl,
              dryRun,
              historyTable,
              historySchema,
              placeholders: migration,
            });
          }
        }
        try {
          // APPLY MIGRATION
          await this.execSqlForStatments({
            placeholders: {},
            migration: migration,
            databaseUrl,
            dryRun,
            historyTable,
            historySchema,
            beforeEachStatment: async (client) => {
              // beforeEachMigrateStatement
              for (const beforeEachMigrateStatement of collection.callback.beforeEachMigrateStatement || []) {
                if (migration.filename) {
                  await this.execSqlForStatments({
                    migration: beforeEachMigrateStatement,
                    databaseUrl,
                    client,
                    dryRun,
                    historyTable,
                    historySchema,
                    placeholders: migration,
                  });
                }
              }
            },
            afterEachStatment: async (client) => {
              // afterEachMigrateStatement
              for (const afterEachMigrateStatement of collection.callback.afterEachMigrateStatement || []) {
                if (migration.filename) {
                  await this.execSqlForStatments({
                    migration: afterEachMigrateStatement,
                    databaseUrl,
                    client,
                    dryRun,
                    historyTable,
                    historySchema,
                    placeholders: migration,
                  });
                }
              }
            },
            errorEachStatment: async (client) => {
              // afterEachMigrateStatementError
              for (const afterEachMigrateStatementError of collection.callback.afterEachMigrateStatementError || []) {
                if (migration.filename) {
                  await this.execSqlForStatments({
                    migration: afterEachMigrateStatementError,
                    databaseUrl,
                    client,
                    dryRun,
                    historyTable,
                    historySchema,
                    placeholders: migration,
                  });
                }
              }
            },
          });
        } catch (afterEachMigrateError) {
          this.logger.error('afterEachMigrateError#error: ', afterEachMigrateError);
          this.logger.info('afterEachMigrateError#migration: ', migration);
          // afterEachMigrateError
          for (const afterEachMigrateError of collection.callback.afterEachMigrateError || []) {
            if (migration.filename) {
              await this.execSqlForStatments({
                migration: afterEachMigrateError,
                databaseUrl,
                dryRun,
                historyTable,
                historySchema,
                placeholders: migration,
              });
            }
          }
          throw afterEachMigrateError;
        } finally {
          // afterEachMigrate
          for (const afterEachMigrate of collection.callback.afterEachMigrate || []) {
            if (migration.filename) {
              await this.execSqlForStatments({
                migration: afterEachMigrate,
                databaseUrl,
                dryRun,
                historyTable,
                historySchema,
                placeholders: migration,
              });
            }
          }
        }
      }
      // afterMigrate
      for (const afterMigrate of collection.callback.afterMigrate || []) {
        await this.execSqlForStatments({
          migration: afterMigrate,
          databaseUrl,
          dryRun,
          historyTable,
          historySchema,
          placeholders: {},
        });
      }
    } catch (afterMigrateError) {
      this.logger.error('afterMigrateError#error: ', afterMigrateError);
      // afterVersioned
      for (const afterMigrateError of collection.callback.afterMigrateError || []) {
        await this.execSqlForStatments({
          migration: afterMigrateError,
          databaseUrl,
          dryRun,
          historyTable,
          historySchema,
          placeholders: {},
        });
      }
      throw afterMigrateError;
    } finally {
      // afterMigrateApplied
      for (const afterMigrateApplied of collection.callback.afterMigrateApplied || []) {
        await this.execSqlForStatments({
          migration: afterMigrateApplied,
          databaseUrl,
          dryRun,
          historyTable,
          historySchema,
          placeholders: {},
        });
      }
      // afterVersioned
      for (const afterVersioned of collection.callback.afterVersioned || []) {
        await this.execSqlForStatments({
          migration: afterVersioned,
          databaseUrl,
          dryRun,
          historyTable,
          historySchema,
          placeholders: {},
        });
      }
    }
    return collection;
  }

  async loadMigrationFile(filepath: string): Promise<string> {
    return (await readFile(filepath)).toString();
  }

  async execSql({
    client,
    query,
    dryRun,
    placeholders,
  }: {
    client?: PoolClient;
    query: string;
    dryRun?: boolean;
    migration?: Migration;
    databaseUrl: string;
    placeholders: Record<string, string>;
  }) {
    let newQuery = query;

    for (const [key, value] of Object.entries(placeholders)) {
      newQuery = newQuery.replace(new RegExp(`%${key}%`, 'g'), value);
    }
    if (dryRun || !client) {
      this.logger.info('execSql (dryRun):', newQuery);
    } else {
      const result = await client.query(newQuery);
      return result.rows;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async execSqlForStatments<T = any>({
    migration,
    databaseUrl,
    beforeEachStatment,
    afterEachStatment,
    errorEachStatment,
    client,
    dryRun,
    historyTable,
    historySchema,
    placeholders,
  }: {
    migration: Migration;
    databaseUrl: string;
    beforeEachStatment?: (client: PoolClient) => Promise<void>;
    afterEachStatment?: (client: PoolClient) => Promise<void>;
    errorEachStatment?: (client: PoolClient) => Promise<void>;
    client?: PoolClient;
    dryRun?: boolean;
    historyTable?: string;
    historySchema?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    placeholders: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }): Promise<T[]> {
    client = await this.getClient({ databaseUrl, dryRun });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = [];

    let nextInstalledRank = 0;
    const startExecutionTime = new Date();
    if (migration.filepath && Object.keys(migration.callback || {}).length === 0) {
      const result = (
        await this.execSqlForStatments({
          migration: Migration.fromStatements({
            statements: [
              this.historyTableService.getNextInstalledRankSql({
                migration,
                historyTable,
                schema: historySchema,
              }),
            ],
          }),
          databaseUrl,
          dryRun,
          historyTable,
          historySchema,
          client,
          placeholders: migration,
        })
      ).flat();
      nextInstalledRank = result[0]?.installed_rank || 1;
    }
    try {
      if (migration.filepath && Object.keys(migration.callback || {}).length === 0) {
        await this.execSqlForStatments({
          migration: Migration.fromStatements({
            statements: [
              this.historyTableService.getBeforeRunMigrationSql({
                migration,
                historyTable,
                schema: historySchema,
                installed_rank: nextInstalledRank,
              }),
            ],
          }),
          databaseUrl,
          dryRun,
          historyTable,
          historySchema,
          client,
          placeholders: migration,
        });
      }
      await this.execSql({
        databaseUrl,
        migration,
        query: 'BEGIN',
        dryRun,
        client,
        placeholders,
      });
      for (const query of migration.statements) {
        if (beforeEachStatment && client) {
          await beforeEachStatment(client);
        }
        try {
          result.push(
            await this.execSql({
              databaseUrl,
              migration,
              client,
              query,
              dryRun,
              placeholders,
            })
          );
        } catch (errorEachStatmentError) {
          this.logger.error('errorEachStatment#error: ', errorEachStatmentError);
          this.logger.info('errorEachStatment#query: ', query);
          this.logger.info('errorEachStatment#file: ', migration.filepath);
          if (migration.filepath) {
            this.logger.info('filepath: ', migration.filepath);
          }
          if (errorEachStatment && client) {
            await errorEachStatment(client);
          }
          throw errorEachStatmentError;
        } finally {
          if (afterEachStatment && client) {
            await afterEachStatment(client);
          }
        }
      }
      await this.execSql({
        databaseUrl,
        migration,
        query: 'COMMIT',
        dryRun,
        client,
        placeholders,
      });
    } catch (err) {
      if (!dryRun) {
        await this.execSql({
          databaseUrl,
          migration,
          query: 'ROLLBACK',
          dryRun,
          client,
          placeholders,
        });
      }
      if (migration.filepath && Object.keys(migration.callback || {}).length === 0) {
        await this.execSqlForStatments({
          migration: Migration.fromStatements({
            statements: [
              this.historyTableService.getAfterRunMigrationSql({
                historyTable,
                schema: historySchema,
                installed_rank: nextInstalledRank,
                execution_time: +new Date() - +startExecutionTime,
                success: false,
              }),
            ],
          }),
          databaseUrl,
          dryRun,
          historyTable,
          historySchema,
          client,
          placeholders: migration,
        });
      }
      throw err;
    } finally {
      if (migration.filepath && Object.keys(migration.callback || {}).length === 0) {
        await this.execSqlForStatments({
          migration: Migration.fromStatements({
            statements: [
              this.historyTableService.getAfterRunMigrationSql({
                historyTable,
                schema: historySchema,
                installed_rank: nextInstalledRank,
                execution_time: +new Date() - +startExecutionTime,
                success: true,
              }),
            ],
          }),
          databaseUrl,
          dryRun,
          historyTable,
          historySchema,
          client,
          placeholders: migration,
        });
      }
    }
    return result;
  }

  async getFiles({
    locations,
    sqlMigrationSuffixes,
  }: {
    dryRun?: boolean;
    locations: string[];
    sqlMigrationSuffixes: string[];
  }): Promise<MgrationFileMetadata[]> {
    let files: MgrationFileMetadata[] = [];
    for (const location of locations) {
      for (const sqlMigrationSuffix of sqlMigrationSuffixes) {
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

import { getLogger, Logger } from 'log4js';
import { getLogLevel } from '../utils/get-log-level';
import { History, HistoryTableService } from './history-table.service';
import { ConnectionString } from 'connection-string';

import { Table } from 'console-table-printer';
import { format } from 'date-fns';

export class InfoService {
  protected logger: Logger;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected Pool: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected client: any;

  protected historyTableService: HistoryTableService;

  constructor(
    private readonly options: {
      historyTable: string;
      historySchema: string;
      databaseUrl: string;
    },
  ) {
    this.logger = getLogger('info');
    this.logger.level = getLogLevel();

    this.historyTableService = new HistoryTableService(options.historyTable, options.historySchema);
  }

  destroy() {
    if (this.client) {
      this.client.release(true);
      this.client = null;
    }
  }

  async getClient() {
    if (!this.client) {
      if (!this.Pool) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        this.Pool = require('pg').Pool;
      }

      const pool = new this.Pool({ connectionString: this.options.databaseUrl });
      this.client = await pool.connect();
    }
    return this.client;
  }

  async info() {
    this.logger.info(`HistoryTable: ${this.options.historyTable}`);
    this.logger.info(
      `DatabaseUrl: ${this.options.databaseUrl.replace(
        new RegExp(new ConnectionString(this.options.databaseUrl).password || '', 'g'),
        '********',
      )}`,
    );

    await this.getClient();

    const histories: History[] = (
      await this.client.query(this.historyTableService.getMigrationsHistorySql())
    ).rows.flat();

    this.logger.info(`Migrations: ${histories.length}`);

    const p = new Table();

    for (const history of histories) {
      let category = 'Versioned';
      let undoable = 'No';
      let color = 'green';
      let state = 'Success';
      if (!history.success) {
        color = 'red';
        state = 'Failed';
      } else {
        if (!history.version) {
          color = 'blue';
          category = 'Repeatable';
        }
      }
      if (history.type === 'UNDO_SQL') {
        undoable = 'Yes';
      }
      p.addRow(
        {
          Category: category,
          Version: history.version,
          Description: history.description,
          Type: history.type,
          'Installed On': format(history.installed_on, 'yyyy-MM-dd kk:mm:ss'),
          State: state,
          Undoable: undoable,
        },
        { color },
      );
    }
    p.printTable();
  }
}

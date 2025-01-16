import { getLogger, Logger } from 'log4js';
import { getLogLevel } from '../utils/get-log-level';
import { History, HistoryTableService } from './history-table.service';

import { Table } from 'console-table-printer';
import { format } from 'date-fns';

export class InfoService {
  protected logger: Logger;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected Pool: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected client: any;

  protected historyTableService: HistoryTableService;

  constructor() {
    this.logger = getLogger('info');
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

  async info({
    databaseUrl,
    historyTable,
    historySchema,
  }: {
    databaseUrl: string;
    historyTable: string;
    historySchema: string;
  }) {
    this.logger.info(`HistoryTable: ${historyTable}`);
    this.logger.info(`DatabaseUrl: ${databaseUrl}`);

    await this.getClient({ databaseUrl });

    const histories: History[] = (
      await this.client.query(
        this.historyTableService.getMigrationsHistorySql({
          historyTable,
          schema: historySchema,
        })
      )
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
        { color }
      );
    }
    p.printTable();
  }
}

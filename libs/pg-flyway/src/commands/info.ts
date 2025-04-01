import { Command, Option } from 'commander';
import { PG_FLYWAY_DEFAULT_MIGRATE_CONFIG } from '../constants/default';
import { PG_FLYWAY_DATABASE_URL, PG_FLYWAY_HISTORY_SCHEMA, PG_FLYWAY_HISTORY_TABLE } from '../constants/env-keys';
import { InfoService } from '../services/info.service';

export function info(program: Command) {
  program
    .command('info')
    .description('Prints the details and status information about all the migrations')
    .addOption(
      new Option(
        '-u,--database-url <string>',
        'Database url for connect (example: postgres://POSTGRES_USER:POSTGRES_PASSWORD@localhost:POSTGRES_PORT/POSTGRES_DATABASE?schema=public)'
      )
        .env(PG_FLYWAY_DATABASE_URL)
        .makeOptionMandatory()
    )
    .addOption(
      new Option('-h,--history-table <string>', 'History table with states of migration')
        .default(PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.historyTable)
        .env(PG_FLYWAY_HISTORY_TABLE)
    )
    .addOption(
      new Option('--history-schema <string>', 'History table schema with states of migration')
        .default(PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.historySchema)
        .env(PG_FLYWAY_HISTORY_SCHEMA)
    )
    .action(async (options: { databaseUrl: string; historyTable: string; historySchema: string }) => {
      const infoService = new InfoService({
        databaseUrl: options.databaseUrl,
        historyTable: options.historyTable,
        historySchema: options.historySchema,
      });
      await infoService.info();
      infoService.destroy();
    });
}

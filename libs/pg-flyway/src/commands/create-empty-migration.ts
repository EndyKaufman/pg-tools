import { Command, Option } from 'commander';
import { PG_FLYWAY_DEFAULT_MIGRATE_CONFIG } from '../constants/default';
import {
  PG_FLYWAY_LOCATIONS,
  PG_FLYWAY_SQL_MIGRATION_SEPARATOR,
  PG_FLYWAY_SQL_MIGRATION_SUFFIXES,
} from '../constants/env-keys';
import { CreateEmptyMigrationService } from '../services/create-empty-migration.service';

export function createEmptyMigration(program: Command) {
  program
    .command('create')
    .description(
      'Create empty migration named by mask "VyyyyMMddkkmm__Name.sql" (example: V202501151755__Init.sql, Date field symbol table: https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table)'
    )
    .addOption(new Option('-n,--name <strings>', 'Name the migration').makeOptionMandatory())
    .addOption(
      new Option(
        '-v,--version <strings>',
        'Static version, if the value is not passed, then use the current date and time in the format "yyyyMMddkkmm"'
      )
    )
    .addOption(
      new Option('-l,--locations <strings>', 'Locations with migration files')
        .default(PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.locations?.join(','))
        .env(PG_FLYWAY_LOCATIONS)
    )
    .addOption(
      new Option('-s,--sql-migration-suffixes <strings>', 'Extension of migration files')
        .default(PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationSuffixes?.join(','))
        .env(PG_FLYWAY_SQL_MIGRATION_SUFFIXES)
    )
    .addOption(
      new Option(
        '--sql-migration-separator <strings>',
        'Version separator (example: V1__Name.sql, sqlMigrationSeparator= "__")'
      )
        .default(PG_FLYWAY_DEFAULT_MIGRATE_CONFIG.sqlMigrationSeparator)
        .env(PG_FLYWAY_SQL_MIGRATION_SEPARATOR)
    )
    .action(
      async (options: {
        name: string;
        version?: string;
        locations: string;
        sqlMigrationSuffixes: string;
        sqlMigrationSeparator: string;
      }) => {
        const createEmptyMigrationService = new CreateEmptyMigrationService({
          locations: options.locations.split(',').map((s) => s.trim()),
          sqlMigrationSuffixes: options.sqlMigrationSuffixes.split(',').map((s) => s.trim()),
          sqlMigrationSeparator: options.sqlMigrationSeparator,
        });
        await createEmptyMigrationService.createEmptyMigration({
          name: options.name,
          version: options.version,
        });
      }
    );
}

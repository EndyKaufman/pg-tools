import { format } from 'date-fns';
import { getLogger, Logger } from 'log4js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getLogLevel } from '../utils/get-log-level';

export class CreateEmptyMigrationService {
  protected logger: Logger;

  constructor(
    private readonly options: {
      locations: string[];
      sqlMigrationSuffixes: string[];
      sqlMigrationSeparator: string;
    }
  ) {
    this.logger = getLogger('create');
    this.logger.level = getLogLevel();
  }

  async createEmptyMigration({ name, version }: { name: string; version?: string }) {
    this.logger.info(`Name: ${name}`);
    if (version) {
      this.logger.info(`Version: ${version}`);
    }
    this.logger.info(`Locations: ${this.options.locations.join(',')}`);

    const migrationName = [
      'V',
      version || format(new Date(), 'yyyyMMddkkmm'),
      this.options.sqlMigrationSeparator,
      name.replace(new RegExp(' ', 'g'), '-'),
      this.options.sqlMigrationSuffixes[0],
    ].join('');
    const migrationFullname = join(this.options.locations[0], migrationName);
    await mkdir(dirname(migrationFullname), { recursive: true });
    await writeFile(migrationFullname, 'SELECT 1;');
    this.logger.info(`Migration "${migrationFullname}" was created successfully!`);
  }
}

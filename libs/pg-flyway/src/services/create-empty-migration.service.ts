import { format } from 'date-fns';
import { getLogger, Logger } from 'log4js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getLogLevel } from '../utils/get-log-level';

export class CreateEmptyMigrationService {
  protected logger: Logger;

  constructor() {
    this.logger = getLogger(CreateEmptyMigrationService.name);
    this.logger.level = getLogLevel();
  }

  async createEmptyMigration({
    name,
    version,
    locations,
    sqlMigrationSuffixes,
    sqlMigrationSeparator,
  }: {
    name: string;
    version?: string;
    locations: string[];
    sqlMigrationSuffixes: string[];
    sqlMigrationSeparator: string;
  }) {
    this.logger.info(`Name: ${name}`);
    if (version) {
      this.logger.info(`Version: ${version}`);
    }
    this.logger.info(`Locations: ${locations.join(',')}`);

    const migrationName = [
      'V',
      version || format(new Date(), 'yyyyMMddkkmm'),
      sqlMigrationSeparator,
      name.replace(new RegExp(' ', 'g'), '-'),
      sqlMigrationSuffixes[0],
    ].join('');
    const migrationFullname = join(locations[0], migrationName);
    await mkdir(dirname(migrationFullname), { recursive: true });
    await writeFile(migrationFullname, 'SELECT 1;');
    this.logger.info(`Migration "${migrationFullname}" was created successfully!`);
  }
}

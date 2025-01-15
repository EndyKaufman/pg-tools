import { Command } from 'commander';
import { createEmptyMigration } from './commands/create-empty-migration';
import { migrate } from './commands/migrate';
import { version } from './commands/version';
import { getPackageJson } from './utils/get-package-json';

const program = new Command();
const packageJson = getPackageJson();

createEmptyMigration(program);
migrate(program);
version(program, packageJson);

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}

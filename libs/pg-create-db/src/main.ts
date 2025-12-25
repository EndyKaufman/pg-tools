import { Command } from 'commander';
import { version } from './commands/version';
import { getPackageJson } from './utils/get-package-json';
import { checkToRunCreateDatabaseHandler, createDatabase, createDatabaseHandler } from './commands/create-database';

const program = new Command();
const packageJson = getPackageJson();

createDatabase(program);
version(program, packageJson);

program.parse(process.argv);

if (checkToRunCreateDatabaseHandler(program.opts())) {
  createDatabaseHandler(program.opts());
} else {
  if (!program.args.length) {
    program.help();
  }
}

// fake changes for missing bump version
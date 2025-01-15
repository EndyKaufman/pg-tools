import { Command } from 'commander';
import { migrate } from './commands/migrate';
import { version } from './commands/version';
import { getPackageJson } from './utils/get-package-json';

const program = new Command();
const packageJson = getPackageJson();

migrate(program);
version(program, packageJson);

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}

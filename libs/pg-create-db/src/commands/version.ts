import { Command } from 'commander';
import { PackageJson } from '../types/package-json';

export function version(program: Command, packageJson: PackageJson) {
  program
    .name(packageJson['name'])
    .description(packageJson['description'])
    .version(packageJson['version'], '-v, --version');
}

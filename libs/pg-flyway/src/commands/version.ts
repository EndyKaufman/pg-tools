import { Command } from 'commander';
import { PackageJson } from '../types/package-json';

export function version(program: Command, packageJson: PackageJson) {
  program
    .name('pg-flyway')
    .description('Database migration tool, NodeJS version of Java migration tool - flyway, supported databases: PostrgeSQL')
    .version(packageJson['version'], '-v, --version');
}

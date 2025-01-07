import { Command } from 'commander';

export function migrator(program: Command) {
  program
    .command('migrator')
    .description(
      'Database migration tool, NodeJS version of Java migration tool - flyway, supported databases: PostrgeSQL'
    )
    .action(async () => {
      console.error(
        `Database migration tool, NodeJS version of Java migration tool - flyway, supported databases: PostrgeSQL`
      );
    });
}

import execa from 'execa';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

describe('Basic create empty migrations (e2e)', () => {
  jest.setTimeout(5 * 60 * 1000);

  it('create migrations', async () => {
    const location = join('apps', 'pg-flyway-e2e', 'src', 'basic-migrate-create-empty-migrations-e2e');
    const result = await execa('node', [
      'dist/libs/pg-flyway/index.js',
      'create',
      `--name=Init`,
      `--locations=./${location}`,
    ]);
    expect(result.stderr).toEqual('');
    const migrationFullname = result.stdout.split('Migration "')[1].split('"')[0].replace(location, '');
    const globalMigrationFullname = join(__dirname, 'basic-migrate-create-empty-migrations-e2e', migrationFullname);
    expect(existsSync(globalMigrationFullname)).toBeTruthy();
    expect((await readFile(globalMigrationFullname)).toString()).toEqual('SELECT 1;');
    await rm(globalMigrationFullname);
  });
});

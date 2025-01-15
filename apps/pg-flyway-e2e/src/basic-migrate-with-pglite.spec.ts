import execa from 'execa';
import { Pg, getPostgres } from './utils/get-postgres';

describe('Basic migrate with pglite (e2e)', () => {
  jest.setTimeout(5 * 60 * 1000);
  let pg: Pg;

  beforeAll(async () => {
    pg = await getPostgres();
  });

  afterAll(async () => {
    await pg.teardown();
  });

  it('apply migrations', async () => {
    const result = await execa('node', [
      'dist/libs/pg-flyway/index.js',
      'migrate',
      `--database-url=${pg.connectionString}`,
      '--locations=./apps/pg-flyway-e2e/src/basic-migrate-with-pglite-and-migration-files-e2e',
    ]);
    expect(result.stderr).toEqual('');
  });

  it('check entities and data from migrations', async () => {
    const result = await pg.pool.query('select * from "AppUserCategory"');
    expect(result.rows).toMatchObject([
      {
        // id: '430aa2ab-14d7-4fbe-9b6d-f5e267c88376',
        name: 'VIP',
        description: 'Users with VIP status',
        deletedBy: null,
        createdBy: null,
        updatedBy: null,
        deletedAt: null,
        // createdAt: 2025-01-14T03:15:10.367Z,
        // updatedAt: 2025-01-14T03:15:10.367Z
      },
    ]);
  });
});

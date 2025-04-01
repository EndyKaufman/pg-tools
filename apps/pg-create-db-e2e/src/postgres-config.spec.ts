import execa from 'execa';
import { Client } from 'pg';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

describe('Postgres config (e2e)', () => {
  jest.setTimeout(5 * 60 * 1000);
  let container: StartedTestContainer;
  const ROOT_POSTGRES_USER = 'postgres';
  const ROOT_POSTGRES_PASSWORD = 'ROOT_POSTGRES_PASSWORD';
  const ROOT_POSTGRES_DB = 'postgres';

  const APP1_POSTGRES_USER = 'APP1_POSTGRES_USER';
  const APP1_POSTGRES_PASSWORD = 'APP1_POSTGRES_PASSWORD';
  const APP1_POSTGRES_DB = 'app1';

  const APP2_POSTGRES_USER = 'APP2_POSTGRES_USER';
  const APP2_POSTGRES_PASSWORD = 'APP2_POSTGRES_PASSWORD';
  const APP2_POSTGRES_DB = 'app2';

  beforeAll(async () => {
    container = await new GenericContainer('bitnami/postgresql:15.5.0')
      .withExposedPorts(5432)
      .withEnv('POSTGRESQL_DATABASE', ROOT_POSTGRES_DB)
      .withEnv('POSTGRESQL_USERNAME', ROOT_POSTGRES_USER)
      .withEnv('POSTGRESQL_PASSWORD', ROOT_POSTGRES_PASSWORD)
      .start();
    await new Promise((resolve) => setTimeout(resolve, 30000));
  });

  afterAll(async () => {
    await container.stop();
  });

  it('create applications databases with config file', async () => {
    await execa('node', ['dist/libs/pg-create-db/index.js', `--config=./apps/pg-create-db-e2e/src/pg-create-db`], {
      env: {
        HOST: container.getHost(),
        PORT: String(container.getMappedPort(5432)),
        ROOT_POSTGRES_USER,
        ROOT_POSTGRES_PASSWORD,
        ROOT_POSTGRES_DB,
        APP1_POSTGRES_USER,
        APP1_POSTGRES_PASSWORD,
        APP1_POSTGRES_DB,
        APP2_POSTGRES_USER,
        APP2_POSTGRES_PASSWORD,
        APP2_POSTGRES_DB,
      },
    });

    //

    const pgConfig1 = {
      user: APP1_POSTGRES_USER,
      host: container.getHost(),
      password: APP1_POSTGRES_PASSWORD,
      port: container.getMappedPort(5432),
      database: APP1_POSTGRES_DB,
      idleTimeoutMillis: 30000,
    };
    const client1 = new Client(pgConfig1);
    await client1.connect();
    expect(await client1.query('SELECT current_database();')).toMatchObject({
      rows: [{ current_database: APP1_POSTGRES_DB }],
    });
    expect(await client1.query('SELECT CURRENT_USER;')).toMatchObject({
      rows: [{ current_user: APP1_POSTGRES_USER }],
    });
    await client1.end();

    //

    const pgConfig2 = {
      user: APP2_POSTGRES_USER,
      host: container.getHost(),
      password: APP2_POSTGRES_PASSWORD,
      port: container.getMappedPort(5432),
      database: APP2_POSTGRES_DB,
      idleTimeoutMillis: 30000,
    };
    const client2 = new Client(pgConfig2);
    await client2.connect();
    expect(await client2.query('SELECT current_database();')).toMatchObject({
      rows: [{ current_database: APP2_POSTGRES_DB }],
    });
    expect(await client2.query('SELECT CURRENT_USER;')).toMatchObject({
      rows: [{ current_user: APP2_POSTGRES_USER }],
    });
    await client2.end();
  });
});

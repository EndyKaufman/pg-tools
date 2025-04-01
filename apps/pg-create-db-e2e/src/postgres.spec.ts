import execa from 'execa';
import { Client } from 'pg';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

describe('Postgres (e2e)', () => {
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

  const APP3_POSTGRES_USER = 'APP3_POSTGRES_USER';
  const APP3_POSTGRES_PASSWORD = 'APP3_POSTGRES_PASSWORD';
  const APP3_POSTGRES_DB = 'app3';

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

  it('check works of database as root user', async () => {
    const pgConfig = {
      user: ROOT_POSTGRES_USER,
      host: container.getHost(),
      password: ROOT_POSTGRES_PASSWORD,
      port: container.getMappedPort(5432),
      database: ROOT_POSTGRES_DB,
      idleTimeoutMillis: 30000,
    };

    const client = new Client(pgConfig);
    await client.connect();
    expect(await client.query('SELECT current_database();')).toMatchObject({
      rows: [{ current_database: ROOT_POSTGRES_DB }],
    });
    expect(await client.query('SELECT CURRENT_USER;')).toMatchObject({
      rows: [{ current_user: ROOT_POSTGRES_USER }],
    });
    await client.end();
  });

  it('rename if user does not exist', async () => {
    const result = await execa('node', [
      'dist/libs/pg-create-db/index.js',
      `--root-database-url=postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${ROOT_POSTGRES_DB}?schema=public`,
      '--force-change-username=true',
      `--app-database-url=postgres://newuser:${APP1_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${APP1_POSTGRES_DB}?schema=public`,
    ]);

    expect(result.stderr).toEqual('');

    const pgConfig = {
      user: 'newuser',
      host: container.getHost(),
      password: APP1_POSTGRES_PASSWORD,
      port: container.getMappedPort(5432),
      database: APP1_POSTGRES_DB,
      idleTimeoutMillis: 30000,
    };
    const client = new Client(pgConfig);
    await client.connect();
    expect(await client.query('SELECT current_database();')).toMatchObject({
      rows: [{ current_database: APP1_POSTGRES_DB }],
    });
    expect(await client.query('SELECT CURRENT_USER;')).toMatchObject({
      rows: [{ current_user: 'newuser' }],
    });
    await client.end();

    // rename is back for the reset
    await execa('node', [
      'dist/libs/pg-create-db/index.js',
      `--root-database-url=postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${ROOT_POSTGRES_DB}?schema=public`,
      '--force-change-username=true',
      `--app-database-url=postgres://${APP1_POSTGRES_USER}:${APP1_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${APP1_POSTGRES_DB}?schema=public`,
    ]);
  });

  it('create application database with set command line args ', async () => {
    const result = await execa('node', [
      'dist/libs/pg-create-db/index.js',
      `--root-database-url=postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${ROOT_POSTGRES_DB}?schema=public`,
      `--app-database-url=postgres://${APP1_POSTGRES_USER}:${APP1_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${APP1_POSTGRES_DB}?schema=public`,
    ]);

    expect(result.stderr).toEqual('');

    const pgConfig = {
      user: APP1_POSTGRES_USER,
      host: container.getHost(),
      password: APP1_POSTGRES_PASSWORD,
      port: container.getMappedPort(5432),
      database: APP1_POSTGRES_DB,
      idleTimeoutMillis: 30000,
    };
    const client = new Client(pgConfig);
    await client.connect();
    expect(await client.query('SELECT current_database();')).toMatchObject({
      rows: [{ current_database: APP1_POSTGRES_DB }],
    });
    expect(await client.query('SELECT CURRENT_USER;')).toMatchObject({
      rows: [{ current_user: APP1_POSTGRES_USER }],
    });
    await client.end();
  });

  it('rename username on existing database if one (except root)', async () => {
    const result = await execa('node', [
      'dist/libs/pg-create-db/index.js',
      `--root-database-url=postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${ROOT_POSTGRES_DB}?schema=public`,
      '--force-change-username=true',
      `--app-database-url=postgres://APP_TEST_NAME:${APP1_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${APP1_POSTGRES_DB}?schema=public`,
    ]);

    expect(result.stderr).toEqual('');

    const pgConfig = {
      user: 'APP_TEST_NAME',
      host: container.getHost(),
      password: APP1_POSTGRES_PASSWORD,
      port: container.getMappedPort(5432),
      database: APP1_POSTGRES_DB,
      idleTimeoutMillis: 30000,
    };

    const client = new Client(pgConfig);
    await client.connect();
    expect(await client.query('SELECT current_database();')).toMatchObject({
      rows: [{ current_database: APP1_POSTGRES_DB }],
    });
    expect(await client.query('SELECT CURRENT_USER;')).toMatchObject({
      rows: [{ current_user: 'APP_TEST_NAME' }],
    });
    await client.end();

    // rename is back for the reset
    await execa('node', [
      'dist/libs/pg-create-db/index.js',
      `--root-database-url=postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${ROOT_POSTGRES_DB}?schema=public`,
      '--force-change-username=true',
      `--app-database-url=postgres://${APP1_POSTGRES_USER}:${APP1_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${APP1_POSTGRES_DB}?schema=public`,
    ]);
  });

  it('rename username to the same one', async () => {
    const result = await execa('node', [
      'dist/libs/pg-create-db/index.js',
      `--root-database-url=postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${ROOT_POSTGRES_DB}?schema=public`,
      '--force-change-username=true',
      `--app-database-url=postgres://${APP1_POSTGRES_USER}:${APP1_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${APP1_POSTGRES_DB}?schema=public`,
    ]);

    expect(result.stderr).toEqual('');
    const pgConfig = {
      user: APP1_POSTGRES_USER,
      host: container.getHost(),
      password: APP1_POSTGRES_PASSWORD,
      port: container.getMappedPort(5432),
      database: APP1_POSTGRES_DB,
      idleTimeoutMillis: 30000,
    };
    const client = new Client(pgConfig);
    await client.connect();
    expect(await client.query('SELECT current_database();')).toMatchObject({
      rows: [{ current_database: APP1_POSTGRES_DB }],
    });
    expect(await client.query('SELECT CURRENT_USER;')).toMatchObject({
      rows: [{ current_user: APP1_POSTGRES_USER }],
    });
    await client.end();
  });

  it('change password on existing database', async () => {
    const result = await execa('node', [
      'dist/libs/pg-create-db/index.js',
      `--root-database-url=postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${ROOT_POSTGRES_DB}?schema=public`,
      '--force-change-password=true',
      `--app-database-url=postgres://${APP1_POSTGRES_USER}:${APP2_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${APP1_POSTGRES_DB}?schema=public`,
    ]);

    expect(result.stderr).toEqual('');

    const pgConfig = {
      user: APP1_POSTGRES_USER,
      host: container.getHost(),
      password: APP2_POSTGRES_PASSWORD,
      port: container.getMappedPort(5432),
      database: APP1_POSTGRES_DB,
      idleTimeoutMillis: 30000,
    };

    const client = new Client(pgConfig);
    await client.connect();
    expect(await client.query('SELECT current_database();')).toMatchObject({
      rows: [{ current_database: APP1_POSTGRES_DB }],
    });
    expect(await client.query('SELECT CURRENT_USER;')).toMatchObject({
      rows: [{ current_user: APP1_POSTGRES_USER }],
    });
    await client.end();

    // change password is back for the reset
    await execa('node', [
      'dist/libs/pg-create-db/index.js',
      `--root-database-url=postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${ROOT_POSTGRES_DB}?schema=public`,
      '--force-change-password=true',
      `--app-database-url=postgres://${APP1_POSTGRES_USER}:${APP1_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${APP1_POSTGRES_DB}?schema=public`,
    ]);
  });

  it('change password and username on existing database', async () => {
    const result = await execa('node', [
      'dist/libs/pg-create-db/index.js',
      `--root-database-url=postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${ROOT_POSTGRES_DB}?schema=public`,
      '--force-change-username=true',
      '--force-change-password=true',
      `--app-database-url=postgres://APP_TEST_NAME:${APP2_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${APP1_POSTGRES_DB}?schema=public`,
    ]);

    expect(result.stderr).toEqual('');

    const pgConfig = {
      user: 'APP_TEST_NAME',
      host: container.getHost(),
      password: APP2_POSTGRES_PASSWORD,
      port: container.getMappedPort(5432),
      database: APP1_POSTGRES_DB,
      idleTimeoutMillis: 30000,
    };

    const client = new Client(pgConfig);
    await client.connect();
    expect(await client.query('SELECT current_database();')).toMatchObject({
      rows: [{ current_database: APP1_POSTGRES_DB }],
    });
    expect(await client.query('SELECT CURRENT_USER;')).toMatchObject({
      rows: [{ current_user: 'APP_TEST_NAME' }],
    });
    await client.end();

    // rename and change password is back for the reset
    await execa('node', [
      'dist/libs/pg-create-db/index.js',
      `--root-database-url=postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${ROOT_POSTGRES_DB}?schema=public`,
      '--force-change-username=true',
      '--force-change-password=true',
      `--app-database-url=postgres://${APP1_POSTGRES_USER}:${APP1_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${APP1_POSTGRES_DB}?schema=public`,
    ]);
  });

  it('duplicate create application database with set command line args ', async () => {
    const result = await execa('node', [
      'dist/libs/pg-create-db/index.js',
      `--root-database-url=postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${ROOT_POSTGRES_DB}?schema=public`,
      `--app-database-url=postgres://${APP1_POSTGRES_USER}:${APP1_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${APP1_POSTGRES_DB}?schema=public`,
    ]);

    expect(result.stderr).toEqual('');

    const pgConfig = {
      user: APP1_POSTGRES_USER,
      host: container.getHost(),
      password: APP1_POSTGRES_PASSWORD,
      port: container.getMappedPort(5432),
      database: APP1_POSTGRES_DB,
      idleTimeoutMillis: 30000,
    };
    const client = new Client(pgConfig);
    await client.connect();
    expect(await client.query('SELECT current_database();')).toMatchObject({
      rows: [{ current_database: APP1_POSTGRES_DB }],
    });
    expect(await client.query('SELECT CURRENT_USER;')).toMatchObject({
      rows: [{ current_user: APP1_POSTGRES_USER }],
    });
    await client.end();
  });

  it('drop application database before create application database with set command line args ', async () => {
    // todo: add code for create some table and check it after drop database
    const result = await execa('node', [
      'dist/libs/pg-create-db/index.js',
      '--drop-app-database=true',
      `--root-database-url=postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${ROOT_POSTGRES_DB}?schema=public`,
      `--app-database-url=postgres://${APP1_POSTGRES_USER}:${APP1_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${APP1_POSTGRES_DB}?schema=public`,
    ]);

    expect(result.stderr).toEqual('');

    const pgConfig = {
      user: APP1_POSTGRES_USER,
      host: container.getHost(),
      password: APP1_POSTGRES_PASSWORD,
      port: container.getMappedPort(5432),
      database: APP1_POSTGRES_DB,
      idleTimeoutMillis: 30000,
    };
    const client = new Client(pgConfig);
    await client.connect();
    expect(await client.query('SELECT current_database();')).toMatchObject({
      rows: [{ current_database: APP1_POSTGRES_DB }],
    });
    expect(await client.query('SELECT CURRENT_USER;')).toMatchObject({
      rows: [{ current_user: APP1_POSTGRES_USER }],
    });
    await client.end();
  });

  it('create application 2 database with set command line args ', async () => {
    const result = await execa('node', [
      'dist/libs/pg-create-db/index.js',
      `--root-database-url=postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${ROOT_POSTGRES_DB}?schema=public`,
      `--app-database-url=postgres://${APP2_POSTGRES_USER}:${APP2_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${APP2_POSTGRES_DB}?schema=public`,
    ]);

    expect(result.stderr).toEqual('');

    const pgConfig = {
      user: APP2_POSTGRES_USER,
      host: container.getHost(),
      password: APP2_POSTGRES_PASSWORD,
      port: container.getMappedPort(5432),
      database: APP2_POSTGRES_DB,
      idleTimeoutMillis: 30000,
    };
    const client = new Client(pgConfig);
    await client.connect();
    expect(await client.query('SELECT current_database();')).toMatchObject({
      rows: [{ current_database: APP2_POSTGRES_DB }],
    });
    expect(await client.query('SELECT CURRENT_USER;')).toMatchObject({
      rows: [{ current_user: APP2_POSTGRES_USER }],
    });
    await client.end();
  });

  it('create application database with use envs', async () => {
    const rootDatabaseUrl = `postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
      5432
    )}/${ROOT_POSTGRES_DB}?schema=public`;

    const appDatabaseUrl = `postgres://${APP2_POSTGRES_USER}:${APP2_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
      5432
    )}/${APP2_POSTGRES_DB}?schema=public`;

    const result = await execa('node', ['dist/libs/pg-create-db/index.js'], {
      env: {
        ...process.env,
        PG_CREATE_DB_ROOT_DATABASE_URL: rootDatabaseUrl,
        PG_CREATE_DB_APP_DATABASE_URL: appDatabaseUrl,
      },
    });

    expect(result.stderr).toEqual('');

    const pgConfig = {
      user: APP2_POSTGRES_USER,
      host: container.getHost(),
      password: APP2_POSTGRES_PASSWORD,
      port: container.getMappedPort(5432),
      database: APP2_POSTGRES_DB,
      idleTimeoutMillis: 30000,
    };
    const client = new Client(pgConfig);
    await client.connect();
    expect(await client.query('SELECT current_database();')).toMatchObject({
      rows: [{ current_database: APP2_POSTGRES_DB }],
    });
    expect(await client.query('SELECT CURRENT_USER;')).toMatchObject({
      rows: [{ current_user: APP2_POSTGRES_USER }],
    });
    await client.end();
  });

  it('create application database with use envs and sub envs', async () => {
    const dbPort = container.getMappedPort(5432).toString();

    const dbHost = container.getHost();

    const rootDatabaseUrl = `postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@\${POSTGRES_HOST}:\${POSTGRES_PORT}/${ROOT_POSTGRES_DB}?schema=public`;

    const appDatabaseUrl = `postgres://${APP3_POSTGRES_USER}:${APP3_POSTGRES_PASSWORD}@\${POSTGRES_HOST}:\${POSTGRES_PORT}/${APP3_POSTGRES_DB}?schema=public`;

    const result = await execa('node', ['dist/libs/pg-create-db/index.js'], {
      env: {
        ...process.env,
        PG_CREATE_DB_ROOT_DATABASE_URL: rootDatabaseUrl,
        PG_CREATE_DB_APP_DATABASE_URL: appDatabaseUrl,
        POSTGRES_HOST: dbHost,
        POSTGRES_PORT: dbPort,
      },
    });

    expect(result.stderr).toEqual('');

    const pgConfig = {
      user: APP3_POSTGRES_USER,
      host: container.getHost(),
      password: APP3_POSTGRES_PASSWORD,
      port: container.getMappedPort(5432),
      database: APP3_POSTGRES_DB,
      idleTimeoutMillis: 30000,
    };
    const client = new Client(pgConfig);
    await client.connect();
    expect(await client.query('SELECT current_database();')).toMatchObject({
      rows: [{ current_database: APP3_POSTGRES_DB }],
    });
    expect(await client.query('SELECT CURRENT_USER;')).toMatchObject({
      rows: [{ current_user: APP3_POSTGRES_USER }],
    });
    await client.end();
  });

  it('change username on existing database with multiple users', async () => {
    function createDbUser(username: string) {
      return execa('node', [
        'dist/libs/pg-create-db/index.js',
        `--root-database-url=postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
          5432
        )}/${ROOT_POSTGRES_DB}?schema=public`,
        `--app-database-url=postgres://${username}:${APP2_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
          5432
        )}/${APP1_POSTGRES_DB}_TEST?schema=public`,
      ]);
    }

    const createdDbUserResult = await createDbUser('TEST_USER_1');
    expect(createdDbUserResult.stderr).toEqual('');
    const createdDbUserResult2 = await createDbUser('TEST_USER_2');
    expect(createdDbUserResult2.stderr).toEqual('');

    const result = await execa('node', [
      'dist/libs/pg-create-db/index.js',
      `--root-database-url=postgres://${ROOT_POSTGRES_USER}:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${ROOT_POSTGRES_DB}?schema=public`,
      '--force-change-username=true',
      `--app-database-url=postgres://TEST_USER_3:${APP2_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${APP1_POSTGRES_DB}_TEST?schema=public`,
    ]).catch((err) => `${err}`);

    expect(result).toContain('Cannot update credentials: multiple non-root users exist');
  });

  it('throw error if we use not "postgres" username for root user', async () => {
    const result = await execa('node', [
      'dist/libs/pg-create-db/index.js',
      `--root-database-url=postgres://notpostgres:${ROOT_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${ROOT_POSTGRES_DB}?schema=public`,
      `--app-database-url=postgres://${APP2_POSTGRES_USER}:${APP2_POSTGRES_PASSWORD}@${container.getHost()}:${container.getMappedPort(
        5432
      )}/${APP1_POSTGRES_DB}_TEST?schema=public`,
    ]).catch((err) => `${err}`);

    expect(result).toContain(
      'The username for the root database must always be "postgres", otherwise the user will not receive "super" rights'
    );
  });
});

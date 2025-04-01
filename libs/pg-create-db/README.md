# pg-create-db

Database creation tool for PostgreSQL database server.

[![npm version](https://badge.fury.io/js/pg-create-db.svg)](https://badge.fury.io/js/pg-create-db)
[![monthly downloads](https://badgen.net/npm/dm/pg-create-db)](https://www.npmjs.com/package/pg-create-db)

## Usage

### Starting the database

To start the database, run the following command:

```sh
curl -fsSL https://raw.githubusercontent.com/EndyKaufman/pg-tools/refs/heads/master/docker-compose.yml -o docker-compose.yml
docker compose up -d
```

This will result in a successful PostgreSQL container startup:

```sh
[+] Running 3/3
 ✔ Network pg-tools_default              Created                         0.1s
 ✔ Volume "pg-tools-postgre-sql-volume"  Created                         0.0s
 ✔ Container pg-tools-postgre-sql        Started                         0.2s
```

### Creating application database

To create new application database, run the following command:

```sh
npx pg-create-db --root-database-url=postgres://postgres:pgtoolspassword@localhost:5432/postgres?schema=public --app-database-url=postgres://appusername:apppassword@localhost:5432/appdatabase?schema=public
```

The result will be the successful:

```sh
 NX   Successfully ran target build for project pg-create-db (1s)

[2025-04-01T07:54:53.344] [INFO] create-database - dryRun: false
[2025-04-01T07:54:53.376] [INFO] create-database - Start create database...
[2025-04-01T07:54:53.431] [INFO] create-database - Start apply permissions...
[2025-04-01T07:54:53.461] [INFO] create-database - End of apply permissions...
[2025-04-01T07:54:53.472] [INFO] create-database - End of create database...
```

### Stopping the database

To stop the database, run the following command:

```sh
docker compose down
```

This command will stop the container with the PostgreSQL database.

## Extended description of launch parameters

Database creation tool for PostgreSQL database server

```sh
Usage: pg-create-db [options]

Options:
  -d,--dry-run <boolean>                Show queries to execute without apply them in database (default: "false", env: PG_CREATE_DB_DRY_RUN)
  -c,--config <string>                  Configuration file for bulk migrations (example content:
                                        [{"databaseUrl":"postgres://${POSTGRES_USER}:POSTGRES_PASSWORD@localhost:POSTGRES_PORT/POSTGRES_DATABASE?schema=public"}], rules: https://github.com/cosmiconfig/cosmiconfig)
                                        (default: "pgCreateDb", env: PG_CREATE_DB_CONFIG)
  -r,--root-database-url <string>       Database url for connect as root user (example:
                                        postgres://postgres:ROOT_POSTGRES_PASSWORD@localhost:POSTGRES_PORT/postgres?schema=public) (default: "", env:
                                        PG_CREATE_DB_ROOT_DATABASE_URL)
  -a,--app-database-url <string>        Application database url used for create new database (example:
                                        postgres://POSTGRES_USER:POSTGRES_PASSWORD@localhost:POSTGRES_PORT/POSTGRES_DATABASE?schema=public) (default: "", env:
                                        PG_CREATE_DB_APP_DATABASE_URL)
  -n,--force-change-username <boolean>  Force rename username if one exists in database for app-database-url excluding root (default: "false", env:
                                        PG_CREATE_DB_FORCE_CHANGE_USERNAME)
  -p,--force-change-password <boolean>  Force change password of specified app-database-url (default: "false", env: PG_CREATE_DB_FORCE_CHANGE_PASSWORD)
  --drop-app-database <boolean>         Drop application database before try create it (default: "false", env: PG_CREATE_DB_DROP_APP_DATABASE)
  -e,--extensions <boolean>             Default extensions (default: "uuid-ossp,pg_trgm", env: PG_CREATE_DB_EXTENSIONS)
  -v, --version                         output the version number
  -h, --help                            display help for command
```

## Links

https://github.com/EndyKaufman/pg-tools - repository with the project

https://www.npmjs.com/package/pg-create-db - utility on npm

## License

MIT

# pg-flyway

Migration tool for `PostgreSQL` database, `NodeJS` version of `Java` migration tool - `flyway` (not wrapper for [flywaydb cli](https://flywaydb.org/documentation/commandline/)).

[![npm version](https://badge.fury.io/js/pg-flyway.svg)](https://badge.fury.io/js/pg-flyway)
[![monthly downloads](https://badgen.net/npm/dm/pg-flyway)](https://www.npmjs.com/package/pg-flyway)

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

### Creating a migration

To create your first migration, run the following command:

```sh
npx pg-flyway create --name=Init --version=1
echo "CREATE TABLE \"User\"(id uuid NOT NULL DEFAULT uuid_generate_v4() constraint PK_USER primary key,email varchar(20));" > migrations/V1__Init.sql
```

The result will be the successful creation of an empty migration:

```sh
[2025-01-15T23:23:53.903] [INFO] CreateEmptyMigrationService - Name: Init
[2025-01-15T23:23:53.904] [INFO] CreateEmptyMigrationService - Locations: migrations
[2025-01-15T23:23:53.914] [INFO] CreateEmptyMigrationService - Migration "migrations/V1__Init.sql" was created successfully!
```

### Applying migration

To apply the created migration, run the following command:

```sh
npx pg-flyway migrate --database-url=postgres://postgres:pgtoolspassword@localhost:5432/pgtoolsdatabase?schema=public
```

The result will be a successful migration:

```sh
[2025-01-16T00:08:39.052] [INFO] MigrateService - Locations: migrations
[2025-01-16T00:08:39.053] [INFO] MigrateService - HistoryTable: __migrations
[2025-01-16T00:08:39.053] [INFO] MigrateService - DatabaseUrl: postgres://postgres:pgtoolspassword@localhost:5432/pgtoolsdatabase?schema=public
[2025-01-16T00:08:39.074] [INFO] MigrateService - Migrations: 1
```

### View a list of completed migrations

To view a list of completed migrations, run the following command:

```sh
npx pg-flyway info --database-url=postgres://postgres:pgtoolspassword@localhost:5432/pgtoolsdatabase?schema=public
```

The result will be a table with information about completed migrations:

```sh
[2025-01-16T09:15:34.007] [INFO] info - HistoryTable: __migrations
[2025-01-16T09:15:34.008] [INFO] info - DatabaseUrl: postgres://postgres:pgtoolspassword@localhost:5432/pgtoolsdatabase?schema=public
[2025-01-16T09:15:34.057] [INFO] info - Migrations: 1
┌───────────┬─────────┬─────────────┬──────┬─────────────────────┬─────────┬──────────┐
│  Category │ Version │ Description │ Type │        Installed On │   State │ Undoable │
├───────────┼─────────┼─────────────┼──────┼─────────────────────┼─────────┼──────────┤
│ Versioned │       1 │        Init │  SQL │ 2025-01-15 20:08:39 │ Success │       No │
└───────────┴─────────┴─────────────┴──────┴─────────────────────┴─────────┴──────────┘
```

### Stopping the database

To stop the database, run the following command:

```sh
docker compose down
```

This command will stop the container with the PostgreSQL database.

## Extended description of commands and their parameters

### Create

Create empty migration named by mask `VyyyyMMddkkmm__Name.sql` (example: `V202501151755__Init.sql`, Date field symbol table:
https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table).

```sh
Usage: pg-flyway create [options]

Options:
  -n,--name <strings>                    Name the migration.
  -v,--version <strings>                 Static version, if the value is not passed, then use the current date and time in the format "yyyyMMddkkmm".
  -l,--locations <strings>               Locations with migration files. (default: "migrations", env: PG_FLYWAY_LOCATIONS)
  -s,--sql-migration-suffixes <strings>  Extension of migration files. (default: ".sql", env: PG_FLYWAY_SQL_MIGRATION_SUFFIXES)
  --sql-migration-separator <strings>    Version separator (example: V1__Name.sql, sqlMigrationSeparator= "__"). (default: "__", env: PG_FLYWAY_SQL_MIGRATION_SEPARATOR)
  -h, --help                             display help for command
```

### Migrate

Migrates the schema to the latest version.

```sh
Usage: pg-flyway migrate [options]

Options:
  -d,--dry-run <boolean>                         Show content of migrations without apply them in database. (default: "false", env: PG_FLYWAY_DRY_RUN)
  -u,--database-url <string>                     Database url for connect (example:
                                                 postgres://POSTGRES_USER:POSTGRES_PASSWORD@localhost:POSTGRES_PORT/POSTGRES_DATABASE?schema=public). (env:
                                                 PG_FLYWAY_DATABASE_URL)
  -l,--locations <strings>                       Locations with migration files. (default: "migrations", env: PG_FLYWAY_LOCATIONS)
  -h,--history-table <string>                    History table with states of migration. (default: "__migrations", env: PG_FLYWAY_HISTORY_TABLE)
  --history-schema <string>                      History table schema with states of migration. (default: "public", env: PG_FLYWAY_HISTORY_SCHEMA)
  -s,--sql-migration-suffixes <strings>          Extension of migration files. (default: ".sql", env: PG_FLYWAY_SQL_MIGRATION_SUFFIXES)
  --sql-migration-separator <strings>            Version separator (example: V1__Name.sql, sqlMigrationSeparator= "__"). (default: "__", env:
                                                 PG_FLYWAY_SQL_MIGRATION_SEPARATOR)
  --sql-migration-statement-separator <strings>  Separator of nested queries within a sql query. (default: "--", env: PG_FLYWAY_SQL_MIGRATION_STATEMENT_SEPARATOR)
  --help                                         display help for command
```

### Info

Prints the details and status information about all the migrations.

```sh
Usage: pg-flyway info [options]

Options:
  -u,--database-url <string>   Database url for connect (example: postgres://POSTGRES_USER:POSTGRES_PASSWORD@localhost:POSTGRES_PORT/POSTGRES_DATABASE?schema=public). (env:
                               PG_FLYWAY_DATABASE_URL)
  -h,--history-table <string>  History table with states of migration. (default: "__migrations", env: PG_FLYWAY_HISTORY_TABLE)
  --history-schema <string>    History table schema with states of migration. (default: "public", env: PG_FLYWAY_HISTORY_SCHEMA)
  --help                       display help for command
```

## Links

https://github.com/EndyKaufman/pg-tools - repository with the project

https://www.npmjs.com/package/pg-flyway - utility on npm

https://documentation.red-gate.com/fd/flyway-concepts-271583830.html - Flyway documentation

https://www.npmjs.com/package/node-flywaydb - wrapper for Flyway (Java) on NodeJS

## License

MIT

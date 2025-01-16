## [2025-01-16] Lite version of Flyway migrator for PostgreSQL in TypeScript.

## Description

In my projects, I always use [Flyway](https://documentation.red-gate.com/fd/installers-172490864.html) to manage database migrations, including some important components of its ecosystem:

1. [Versioned migrations](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html) are standard migrations that are applied sequentially one after another.
2. [Repeatable migrations](https://documentation.red-gate.com/fd/repeatable-migrations-273973335.html) are repeatable migrations, such as scripts for creating procedures. They allow you to track the history of changes using Git.

3. [Callbacks](https://documentation.red-gate.com/fd/callbacks-275218509.html) are various hooks that are triggered at a specific time. For example, you can create a script `beforeMigrate__init_types.sql`, which describes all the custom types used in the database. The migrator first executes this script, and then the rest of the operations.

Since my projects are mostly based on `Node.js`, I use a `Node.js` wrapper for `Flyway` — [node-flywaydb](https://www.npmjs.com/package/node-flywaydb). This tool is very easy to use: when launched, it downloads the original `Java` utility and runs it, so it requires a `JVM` on the machine to work.

## Problem

When we build `Docker` images intended for running database migrations, we have to include `JVM` in them, which significantly increases the image size and slows down the whole `CI/CD` process.

## Possible solutions

1. Use `Node.js`-migrants (for example: `db-migrate`, `umzug`, `pg-migrate`).
2. Use migrators built into the `ORM` used in the project (for example: `prisma`, `typeorm`).
3. Write a lightweight clone of `Flyway` in `Node.js` for one database type (`PostgreSQL`).

## The decision made

Since I actively use the features of `Flyway`, such as `repeatable migrations` and `callbacks`, and do not want to give them up, and there are no analogues of these functions in other migration systems, I decided to write my own lightweight clone of `Flyway` in `Node.js` for `PostgreSQL`, which was done.

## Development stages

1. [Versioned migrations](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html) — **done**.
2. [Repeatable migrations](https://documentation.red-gate.com/fd/repeatable-migrations-273973335.html) — **done**.
3. [Callbacks](https://documentation.red-gate.com/fd/callbacks-275218509.html) — **partially done**, for `versioned` only.
4. [Flyway schema history table](https://documentation.red-gate.com/fd/flyway-schema-history-table-273973417.html) - **partially completed**, only for `versioned` and `repeatable`.
5. [Migration Command Dry Runs](https://documentation.red-gate.com/fd/migration-command-dry-runs-275218517.html) - **completed**.
6. [Baseline migrations](https://documentation.red-gate.com/fd/baseline-migrations-273973336.html) - not completed.
7. [Undo migrations](https://documentation.red-gate.com/fd/baseline-migrations-273973336.html) - not completed.
8. [Script migrations](https://documentation.red-gate.com/fd/script-migrations-273973390.html) — not implemented.

9. [Migration transaction handling](https://documentation.red-gate.com/fd/migration-transaction-handling-273973399.html) — not implemented.

[There](https://github.com/flyway/flyway/blob/main/documentation/Flyway%20CLI%20and%20API/Concepts/Migrations.md) they really have a lot of interesting features, I listed only those that were most useful in my practice.

## Example of use

### Starting the database

To start the database, run the following command:

```sh
curl -fsSL https://raw.githubusercontent.com/EndyKaufman/pg-tools/refs/heads/master/docker-compose.yml -o docker-compose.yml
docker compose up -d
```

The result will be a successful launch of the PostgreSQL container:

```sh
[+] Running 3/3
 ✔ Network pg-tools_default              Created                         0.1s
 ✔ Volume "pg-tools-postgre-sql-volume"  Created                         0.0s
 ✔ Container pg-tools-postgre-sql        Started                         0.2s
```

### Create a migration

To create your first migration, run the following command:

```sh
npx pg-flyway create --name=Init --version=1
echo "CREATE TABLE \"User\"(id uuid NOT NULL DEFAULT uuid_generate_v4() constraint PK_USER primary key,email varchar(20));" > migrations/V1__Init.sql
```

The result will be a successful creation of an empty migration:

```sh
[2025-01-15T23:23:53.903] [INFO] CreateEmptyMigrationService - Name: Init
[2025-01-15T23:23:53.904] [INFO] CreateEmptyMigrationService - Locations: migrations
[2025-01-15T23:23:53.914] [INFO] CreateEmptyMigrationService - Migration "migrations/V1__Init.sql" was created successfully!
```

### Applying the migration

To apply the created migration, run the following command:

```sh
npx pg-flyway migrate --database-url=postgres://pgtoolsusername:pgtoolspassword@localhost:5432/pgtoolsdatabase?schema=public
```

The result will be a successful migration:

```sh
[2025-01-16T00:08:39.052] [INFO] MigrateService - Locations: migrations
[2025-01-16T00:08:39.053] [INFO] MigrateService - HistoryTable: __migrations
[2025-01-16T00:08:39.053] [INFO] MigrateService - DatabaseUrl: postgres://pgtoolsusername:pgtoolspassword@localhost:5432/pgtoolsdatabase?schema=public
[2025-01-16T00:08:39.074] [INFO] MigrateService - Migrations: 1
```

### Viewing a list of completed migrations

To view a list of completed migrations, run the following command:

```sh
npx pg-flyway info --database-url=postgres://pgtoolsusername:pgtoolspassword@localhost:5432/pgtoolsdatabase?schema=public
```

The result will be a table with information about the completed migrations:

```sh
[2025-01-16T09:15:34.007] [INFO] info - HistoryTable: __migrations
[2025-01-16T09:15:34.008] [INFO] info - DatabaseUrl: postgres://pgtoolsusername:pgtoolspassword@localhost:5432/pgtoolsdatabase?schema=public
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

## Plans

The main functions of `Flyway` have already been ported to `Typescript` code, which provides the necessary functionality for most scenarios when working with migrations.

I plan to port the remaining unported functions as soon as I have free time.

I will be glad to `pull` requests with new functions and bug fixes.

## Links

- https://github.com/EndyKaufman/pg-tools - Project repository

- https://www.npmjs.com/package/pg-flyway - Utility on NPM

- https://www.npmjs.com/package/node-flywaydb - Wrapper for `Flyway` (`Java`) on `NodeJS`

- https://documentation.red-gate.com/flyway-concepts-271583830.html - `Flyway` documentation

#typescript #postgres #database #nodejs

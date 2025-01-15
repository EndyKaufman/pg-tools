# pg-flyway

Migration tool for `PostgreSQL` database, `NodeJS` version of `Java` migration tool - `flyway` (not wrapper for [flywaydb cli](https://flywaydb.org/documentation/commandline/)).

[![npm version](https://badge.fury.io/js/pg-flyway.svg)](https://badge.fury.io/js/pg-flyway)
[![monthly downloads](https://badgen.net/npm/dm/pg-flyway)](https://www.npmjs.com/package/pg-flyway)

## Commands

### Create

Create empty migration named by mask `"VyyyyMMddkkmm__Name.sql"` (example: `V202501151755__Init.sql`, Date field symbol table: https://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table).

```sh
> npx pg-flyway create --help

Usage: pg-flyway create [options]

Options:
  -n,--name <strings>                    Name the migration.
  -l,--locations <strings>               Locations with migration files. (default: "migrations", env: PG_FLYWAY_LOCATIONS)
  -s,--sql-migration-suffixes <strings>  Extension of migration files. (default: ".sql", env: PG_FLYWAY_SQL_MIGRATION_SUFFIXES)
  --sql-migration-separator <strings>    Version separator (example: V1__Name.sql, sqlMigrationSeparator= "__"). (default: "__", env: PG_FLYWAY_SQL_MIGRATION_SEPARATOR)
  -h, --help                             display help for command
```

### Migrate

Migrates the schema to the latest version.

```sh
> npx pg-flyway migrate --help

Usage: pg-flyway migrate [options]

Migrates the schema to the latest version.

Options:
  -d,--dry-run <boolean>                         Show content of migrations without apply them in database. (default: "false", env: PG_FLYWAY_DRY_RUN)
  -u,--database-url <string>                     Database url for connect (example:
                                                 postgres://POSTGRES_USER:POSTGRES_PASSWORD@localhost:POSTGRES_PORT/POSTGRES_DATABASE?schema=public). (env:
                                                 PG_FLYWAY_DATABASE_URL)
  -l,--locations <strings>                       Locations with migration files. (default: "migrations", env: PG_FLYWAY_LOCATIONS)
  -h,--history-table <string>                    History table with states of migration. (default: "__migrations", env: PG_FLYWAY_HISTORY_TABLE)
  --history-schema <string>                      History table schema with states of migration. (default: "public", env: PG_FLYWAY_HISTORY_SCHEMA)
  -s,--sql-migration-suffixes <strings>          Extension of migration files. (default: ".sql", env: PG_FLYWAY_SQL_MIGRATION_SUFFIXES)
  --sql-migration-separator <strings>            Version separator (example: V1__Name.sql, sqlMigrationSeparator= "__"). (default: "__", env: PG_FLYWAY_SQL_MIGRATION_SEPARATOR)
  --sql-migration-statement-separator <strings>  Separator of nested queries within a sql query. (default: "--", env: PG_FLYWAY_SQL_MIGRATION_STATEMENT_SEPARATOR)
  --help                                         display help for command
```

## Описание:

В своих проектах для управления миграциями баз данных я всегда использую `flyway`, включая некоторые важные компоненты его экосистемы:

1. [Versioned migrations](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html) — это стандартные миграции, которые применяются последовательно друг за другом.
2. [Repeatable migrations](https://documentation.red-gate.com/fd/repeatable-migrations-273973335.html) — это повторяемые миграции, например, скрипты для создания процедур. Они позволяют отслеживать историю изменений с помощью Git.

3. [Callbacks](https://documentation.red-gate.com/fd/callbacks-275218509.html) — это различные хуки, которые срабатывают в определённое время. Например, можно создать скрипт `beforeMigrate__init_types.sql`, в котором описаны все кастомные типы, используемые в базе данных. Мигратор сначала выполняет этот скрипт, а затем остальные операции.

Так как мои проекты преимущественно основаны на `Node.js`, я использую `Node.js`-обёртку для `flyway` — [node-flywaydb](https://www.npmjs.com/package/node-flywaydb). Этот инструмент очень прост в использовании: при запуске он скачивает оригинальную `Java`-утилиту и запускает её, поэтому для работы требуется наличие `JVM` на машине.

## Проблема:

Когда мы создаем `Docker`-образы, предназначенные для запуска миграций базы данных, нам приходится включать в них `JVM`, что значительно увеличивает размер образа и замедляет весь `CI/CD`-процесс.

## Возможные решения:

1. Использовать `Node.js`-миграторы (например: `db-migrate`, `umzug`, `pg-migrate`).
2. Использовать миграторы, встроенные в `ORM`, применяемую в проекте (например: `prisma`, `typeorm`).
3. Написать лёгкий клон `flyway` на `Node.js`.

## Принятое решение:

Так как я активно использую возможности `flyway`, такие как `repeatable migrations` и `callbacks`, и не хочу от них отказываться, а аналогов этих функций в других системах миграции нет, я решил написать собственный лёгкий клон `flyway` на `Node.js`, что и было сделано.

## Этапы разработки:

1. [Versioned migrations](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html) — **выполнено**.
2. [Repeatable migrations](https://documentation.red-gate.com/fd/repeatable-migrations-273973335.html) — **выполнено**.
3. [Callbacks](https://documentation.red-gate.com/fd/callbacks-275218509.html) — **частично выполнено**, только для `versioned`.
4. [Flyway schema history table](https://documentation.red-gate.com/fd/flyway-schema-history-table-273973417.html) — **частично выполнена**, только для `versioned` и `repeatable`.
5. [Migration Command Dry Runs](https://documentation.red-gate.com/fd/migration-command-dry-runs-275218517.html) — _выполнено_.
6. [Baseline migrations](https://documentation.red-gate.com/fd/baseline-migrations-273973336.html) — не выполнено.
7. [Undo migrations](https://documentation.red-gate.com/fd/baseline-migrations-273973336.html) — не выполнено.
8. [Script migrations](https://documentation.red-gate.com/fd/script-migrations-273973390.html) — не выполнено.
9. [Migration transaction handling](https://documentation.red-gate.com/fd/migration-transaction-handling-273973399.html) — не выполнено.

Там у них действительно много интересных возможностей, я перечислил только те, которые были наиболее полезными в моей практике.

## Использование

### Запускаем базу данных

Команда:

```sh
curl -fsSL https://raw.githubusercontent.com/nestjs-mod/nestjs-mod-contrib/refs/heads/master/apps/example-prisma-flyway/docker-compose-prod.yml -o docker-compose.yml
docker compose up -d
```

Результат:

```sh
[+] Running 3/3
 ✔ Network pg-tools_default              Created                         0.1s
 ✔ Volume "pg-tools-postgre-sql-volume"  Created                         0.0s
 ✔ Container pg-tools-postgre-sql        Started                         0.2s
```

### Создаем миграцию

Команда:

```sh
npx pg-flyway create --name=Init --version=1
echo "CREATE TABLE \"User\"(id uuid NOT NULL DEFAULT uuid_generate_v4() constraint PK_USER primary key,email varchar(20));" > migrations/V1__Init.sql
```

Результат:

```sh
[2025-01-15T23:23:53.903] [INFO] CreateEmptyMigrationService - Name: Init
[2025-01-15T23:23:53.904] [INFO] CreateEmptyMigrationService - Locations: migrations
[2025-01-15T23:23:53.914] [INFO] CreateEmptyMigrationService - Migration "migrations/V1__Init.sql" was created successfully!
```

### Применяем миграцию

Команда:

```sh
npx pg-flyway migrate --database-url=postgres://pgtoolsusername:pgtoolspassword@localhost:5432/pgtoolsdatabase?schema=public
```

Результат:

```sh
[2025-01-16T00:08:39.052] [INFO] MigrateService - Locations: migrations
[2025-01-16T00:08:39.053] [INFO] MigrateService - HistoryTable: __migrations
[2025-01-16T00:08:39.053] [INFO] MigrateService - DatabaseUrl: postgres://pgtoolsusername:pgtoolspassword@localhost:5432/pgtoolsdatabase?schema=public
[2025-01-16T00:08:39.074] [INFO] MigrateService - Migrations: 1
```

### Останавливаем базу данных

Команда:

```sh
docker compose down
```

Результат:

```sh
[+] Running 2/1
 ✔ Container pg-tools-postgre-sql  Removed           0.2s
 ✔ Network pg-tools_default        Removed           0.1s
```

## License

MIT

## Описание

В своих проектах для управления миграциями баз данных я всегда использую `flyway`, включая некоторые важные компоненты его экосистемы:

1. [Versioned migrations](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html) — это стандартные миграции, которые применяются последовательно друг за другом.
2. [Repeatable migrations](https://documentation.red-gate.com/fd/repeatable-migrations-273973335.html) — это повторяемые миграции, например, скрипты для создания процедур. Они позволяют отслеживать историю изменений с помощью Git.

3. [Callbacks](https://documentation.red-gate.com/fd/callbacks-275218509.html) — это различные хуки, которые срабатывают в определённое время. Например, можно создать скрипт `beforeMigrate__init_types.sql`, в котором описаны все кастомные типы, используемые в базе данных. Мигратор сначала выполняет этот скрипт, а затем остальные операции.

Так как мои проекты преимущественно основаны на `Node.js`, я использую `Node.js`-обёртку для `flyway` — [node-flywaydb](https://www.npmjs.com/package/node-flywaydb). Этот инструмент очень прост в использовании: при запуске он скачивает оригинальную `Java`-утилиту и запускает её, поэтому для работы требуется наличие `JVM` на машине.

## Проблема

Когда мы создаем `Docker`-образы, предназначенные для запуска миграций базы данных, нам приходится включать в них `JVM`, что значительно увеличивает размер образа и замедляет весь `CI/CD`-процесс.

## Возможные решения

1. Использовать `Node.js`-миграторы (например: `db-migrate`, `umzug`, `pg-migrate`).
2. Использовать миграторы, встроенные в `ORM`, применяемую в проекте (например: `prisma`, `typeorm`).
3. Написать лёгкий клон `flyway` на `Node.js`.

## Принятое решение

Так как я активно использую возможности `flyway`, такие как `repeatable migrations` и `callbacks`, и не хочу от них отказываться, а аналогов этих функций в других системах миграции нет, я решил написать собственный лёгкий клон `flyway` на `Node.js`, что и было сделано.

## Этапы разработки

1. [Versioned migrations](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html) — **выполнено**.
2. [Repeatable migrations](https://documentation.red-gate.com/fd/repeatable-migrations-273973335.html) — **выполнено**.
3. [Callbacks](https://documentation.red-gate.com/fd/callbacks-275218509.html) — **частично выполнено**, только для `versioned`.
4. [Flyway schema history table](https://documentation.red-gate.com/fd/flyway-schema-history-table-273973417.html) — **частично выполнена**, только для `versioned` и `repeatable`.
5. [Migration Command Dry Runs](https://documentation.red-gate.com/fd/migration-command-dry-runs-275218517.html) — _выполнено_.
6. [Baseline migrations](https://documentation.red-gate.com/fd/baseline-migrations-273973336.html) — не выполнено.
7. [Undo migrations](https://documentation.red-gate.com/fd/baseline-migrations-273973336.html) — не выполнено.
8. [Script migrations](https://documentation.red-gate.com/fd/script-migrations-273973390.html) — не выполнено.
9. [Migration transaction handling](https://documentation.red-gate.com/fd/migration-transaction-handling-273973399.html) — не выполнено.

[Там](https://github.com/flyway/flyway/blob/main/documentation/Flyway%20CLI%20and%20API/Concepts/Migrations.md) у них действительно много интересных возможностей, я перечислил только те, которые были наиболее полезными в моей практике.

## Пример использования

### Запуск базы данных

Для запуска базы данных выполните следующую команду:

```sh
curl -fsSL https://raw.githubusercontent.com/EndyKaufman/pg-tools/refs/heads/master/docker-compose.yml -o docker-compose.yml
docker compose up -d
```

Результатом будет успешный запуск контейнера PostgreSQL:

```sh
[+] Running 3/3
 ✔ Network pg-tools_default              Created                         0.1s
 ✔ Volume "pg-tools-postgre-sql-volume"  Created                         0.0s
 ✔ Container pg-tools-postgre-sql        Started                         0.2s
```

### Создание миграции

Для создания первой миграции выполните следующую команду:

```sh
npx pg-flyway create --name=Init --version=1
echo "CREATE TABLE \"User\"(id uuid NOT NULL DEFAULT uuid_generate_v4() constraint PK_USER primary key,email varchar(20));" > migrations/V1__Init.sql
```

Результатом будет успешное создание пустой миграции:

```sh
[2025-01-15T23:23:53.903] [INFO] CreateEmptyMigrationService - Name: Init
[2025-01-15T23:23:53.904] [INFO] CreateEmptyMigrationService - Locations: migrations
[2025-01-15T23:23:53.914] [INFO] CreateEmptyMigrationService - Migration "migrations/V1__Init.sql" was created successfully!
```

### Применение миграции

Для применения созданной миграции выполните следующую команду:

```sh
npx pg-flyway migrate --database-url=postgres://pgtoolsusername:pgtoolspassword@localhost:5432/pgtoolsdatabase?schema=public
```

Результатом будет успешное выполнение миграции:

```sh
[2025-01-16T00:08:39.052] [INFO] MigrateService - Locations: migrations
[2025-01-16T00:08:39.053] [INFO] MigrateService - HistoryTable: __migrations
[2025-01-16T00:08:39.053] [INFO] MigrateService - DatabaseUrl: postgres://pgtoolsusername:pgtoolspassword@localhost:5432/pgtoolsdatabase?schema=public
[2025-01-16T00:08:39.074] [INFO] MigrateService - Migrations: 1
```

### Просмотр списка выполненных миграций

Для просмотра списка выполненных миграций выполните следующую команду:

```sh
npx pg-flyway info --database-url=postgres://pgtoolsusername:pgtoolspassword@localhost:5432/pgtoolsdatabase?schema=public
```

Результатом будет таблица с информацией о выполненных миграциях:

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

### Остановка базы данных

Для остановки базы данных выполните следующую команду:

```sh
docker compose down
```

## Планы

Основные функций flyway успешно портированы в JS-код, это уже покрывает типовой функционал любого из миграторов.

Оставшийся не портированный функционал я постараюсь добавлять по мере появления свободного времени.

Если у кого появится время и желание, то я всегда буду рад пул реквестам с фичами и исправлениями по коду.

## Ссылки

https://github.com/EndyKaufman/pg-tools - репозиторий с проектом

https://www.npmjs.com/package/pg-flyway - утилита на npm

https://documentation.red-gate.com/fd/flyway-concepts-271583830.html - документация Flyway

https://www.npmjs.com/package/node-flywaydb - враппер для Flyway (Java) на NodeJS

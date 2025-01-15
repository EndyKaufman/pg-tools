import { FLYWAY_HISTORY_SCHEMA, FLYWAY_HISTORY_TABLE } from '../constants/default';
import { Migration } from '../types/migration';

export type History = {
  installed_rank: number;
  version: number;
  description: string;
  type: string;
  script: string;
  checksum: number;
  installed_by: string;
  installed_on: Date;
  execution_time: number;
  success: boolean;
};

export class HistoryTableService {
  getCreateHistoryTableSql({
    historyTable = FLYWAY_HISTORY_TABLE,
    schema = FLYWAY_HISTORY_SCHEMA,
  }: { historyTable?: string; schema?: string } = {}) {
    return `create table if not exists ${this.getFullHistoryTableName({
      historyTable,
      schema,
    })}
(
    installed_rank integer                 not null
        constraint ${historyTable}_pk
            primary key,
    version        varchar(50),
    description    varchar(200)            not null,
    type           varchar(20)             not null,
    script         varchar(1000)           not null,
    checksum       integer,
    installed_by   varchar(100)            not null,
    installed_on   timestamp default now() not null,
    execution_time integer                 not null,
    success        boolean                 not null
);
--
create index if not exists ${historyTable}_s_idx
    on ${this.getFullHistoryTableName({
      historyTable,
      schema,
    })} (success);
--
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
`;
  }

  getMigrationsHistorySql({
    historyTable = FLYWAY_HISTORY_TABLE,
    schema = FLYWAY_HISTORY_SCHEMA,
  }: { historyTable?: string; schema?: string } = {}) {
    return `select * from ${this.getFullHistoryTableName({
      historyTable,
      schema,
    })} order by installed_rank`;
  }

  private getFullHistoryTableName({ historyTable, schema }: { historyTable: string; schema: string }) {
    return `${schema ? `"${schema}"` + '.' : ''}"${historyTable}"`;
  }

  getNextInstalledRankSql({
    historyTable = FLYWAY_HISTORY_TABLE,
    schema = FLYWAY_HISTORY_SCHEMA,
  }: {
    migration: Migration;
    historyTable?: string;
    schema?: string;
  }) {
    return `select coalesce(max(installed_rank),0)+1 installed_rank from ${this.getFullHistoryTableName({
      historyTable,
      schema,
    })}`;
  }

  getBeforeRunMigrationSql({
    migration,
    historyTable = FLYWAY_HISTORY_TABLE,
    schema = FLYWAY_HISTORY_SCHEMA,
    installed_rank,
  }: {
    migration: Migration;
    historyTable?: string;
    schema?: string;
    installed_rank: number;
  }) {
    const version = migration.version || 'null';
    const description = migration.name;
    const script = migration.script;
    const checksum = migration.filechecksum;
    const installed_by = '(SELECT current_user)';
    const execution_time = 0;
    const success = 'false';
    return `INSERT INTO ${this.getFullHistoryTableName({
      historyTable,
      schema,
    })}
    (installed_rank, version, description, type, script,
checksum, installed_by, installed_on, execution_time, success) 
VALUES
  (${installed_rank}, ${version},'${description}', 'SQL', '${script}', 
  ${checksum}, ${installed_by}, now(), ${execution_time}, ${success});`;
  }

  getAfterRunMigrationSql({
    historyTable = FLYWAY_HISTORY_TABLE,
    schema = FLYWAY_HISTORY_SCHEMA,
    installed_rank,
    execution_time,
    success,
  }: {
    historyTable?: string;
    schema?: string;
    installed_rank: number;
    execution_time: number;
    success: boolean;
  }) {
    return `UPDATE ${this.getFullHistoryTableName({
      historyTable,
      schema,
    })} SET execution_time=${execution_time}, success=${
      success ? 'true' : 'false'
    } where installed_rank=${installed_rank};`;
  }
}

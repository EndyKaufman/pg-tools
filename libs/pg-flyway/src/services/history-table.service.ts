import { PG_FLYWAY_DEFAULT_HISTORY_SCHEMA, PG_FLYWAY_DEFAULT_HISTORY_TABLE } from '../constants/default';
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
  constructor(private readonly historyTable?: string, private readonly historySchema?: string) {
    if (!this.historyTable) {
      this.historyTable = PG_FLYWAY_DEFAULT_HISTORY_TABLE;
    }
    if (!this.historySchema) {
      this.historySchema = PG_FLYWAY_DEFAULT_HISTORY_SCHEMA;
    }
  }

  getCreateHistoryTableSql() {
    return `create table if not exists ${this.getFullHistoryTableName()}
(
    installed_rank integer                 not null
        constraint ${this.historyTable}_pk
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
create index if not exists ${this.historyTable}_s_idx
    on ${this.getFullHistoryTableName()} (success);
--
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
`;
  }

  getMigrationsHistorySql() {
    return `select * from ${this.getFullHistoryTableName()} order by installed_rank`;
  }

  private getFullHistoryTableName() {
    return `${this.historySchema ? `"${this.historySchema}"` + '.' : ''}"${this.historyTable}"`;
  }

  getNextInstalledRankSql() {
    return `select coalesce(max(installed_rank),0)+1 installed_rank from ${this.getFullHistoryTableName()}`;
  }

  getBeforeRunMigrationSql({ migration, installed_rank }: { migration: Migration; installed_rank: number }) {
    const version = migration.version || 'null';
    const description = migration.name;
    const script = migration.script;
    const checksum = migration.filechecksum;
    const installed_by = '(SELECT current_user)';
    const execution_time = 0;
    const success = 'false';
    return `INSERT INTO ${this.getFullHistoryTableName()}
    (installed_rank, version, description, type, script,
checksum, installed_by, installed_on, execution_time, success) 
VALUES
  (${installed_rank}, ${version},'${description}', 'SQL', '${script}', 
  ${checksum}, ${installed_by}, now(), ${execution_time}, ${success});`;
  }

  getAfterRunMigrationSql({
    installed_rank,
    execution_time,
    success,
  }: {
    installed_rank: number;
    execution_time: number;
    success: boolean;
  }) {
    return `UPDATE ${this.getFullHistoryTableName()} SET execution_time=${execution_time}, success=${
      success ? 'true' : 'false'
    } where installed_rank=${installed_rank};`;
  }
}

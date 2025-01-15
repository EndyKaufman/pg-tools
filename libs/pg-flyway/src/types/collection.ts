import { Migration } from './migration';

export type Collection = {
  filedir?: string;
  callback: {
    beforeMigrate?: Migration[];
    beforeRepeatables?: Migration[];
    beforeEachMigrate?: Migration[];
    beforeEachMigrateStatement?: Migration[];
    afterEachMigrateStatement?: Migration[];
    afterEachMigrateStatementError?: Migration[];
    afterEachMigrate?: Migration[];
    afterEachMigrateError?: Migration[];
    afterMigrate?: Migration[];
    afterMigrateApplied?: Migration[];
    afterVersioned?: Migration[];
    afterMigrateError?: Migration[];
  };
};

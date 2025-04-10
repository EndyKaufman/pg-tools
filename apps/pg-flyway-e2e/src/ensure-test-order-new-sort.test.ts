import { orderBy } from 'natural-orderby';

describe('Ensure test order with new sort', () => {
  it('Apply migrations and check executed sql scripts', async () => {
    const files = [
      {
        filepath: 'V2.sql',
        location: './migrations',
        sqlMigrationSuffix: '.sql',
      },
      {
        filepath: 'V3.sql',
        location: './migrations',
        sqlMigrationSuffix: '.sql',
      },
      { filepath: 'V1.sql', location: './migrations', sqlMigrationSuffix: '.sql' },
      {
        filepath: 'V4.sql',
        location: './migrations',
        sqlMigrationSuffix: '.sql',
      },
      {
        filepath: 'V5.sql',
        location: './migrations',
        sqlMigrationSuffix: '.sql',
      },
      {
        filepath: 'V6.sql',
        location: './migrations',
        sqlMigrationSuffix: '.sql',
      },
    ];

    const sortedFiles = orderBy(files, 'filepath');

    for (let i = 0; i < sortedFiles.length; i++) {
      expect(sortedFiles[i].filepath).toBe(`V${i + 1}.sql`);
    }
  });
});

import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { HardenConflictAuditColumnsInScheduledDoses1763662800000 } from '../src/database/migrations/1763662800000-HardenConflictAuditColumnsInScheduledDoses';

describe('HardenConflictAuditColumnsInScheduledDoses1763662800000', () => {
  it('adds structured conflict audit columns to scheduled_doses', async () => {
    const migration = new HardenConflictAuditColumnsInScheduledDoses1763662800000();
    const executedQueries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        executedQueries.push(normalizeSql(sql));
      }),
    } as unknown as QueryRunner;

    await migration.up(queryRunner);

    expect(executedQueries).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ADD COLUMN IF NOT EXISTS "conflictMatchKind" character varying(40)'),
        expect.stringContaining('ADD COLUMN IF NOT EXISTS "resolutionReasonCode" character varying(60)'),
        expect.stringContaining('ADD COLUMN IF NOT EXISTS "resolutionReasonText" text'),
      ]),
    );
  });

  it('drops the structured conflict audit columns on down', async () => {
    const migration = new HardenConflictAuditColumnsInScheduledDoses1763662800000();
    const executedQueries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        executedQueries.push(normalizeSql(sql));
      }),
    } as unknown as QueryRunner;

    await migration.down(queryRunner);

    expect(executedQueries).toEqual(
      expect.arrayContaining([
        expect.stringContaining('DROP COLUMN IF EXISTS "resolutionReasonText"'),
        expect.stringContaining('DROP COLUMN IF EXISTS "resolutionReasonCode"'),
        expect.stringContaining('DROP COLUMN IF EXISTS "conflictMatchKind"'),
      ]),
    );
  });
});

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

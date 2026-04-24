import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { AddBathTimeToPatientRoutines1763749200000 } from '../src/database/migrations/1763749200000-AddBathTimeToPatientRoutines';

describe('AddBathTimeToPatientRoutines1763749200000', () => {
  it('adds nullable banho to patient routines', async () => {
    const migration = new AddBathTimeToPatientRoutines1763749200000();
    const executedQueries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        executedQueries.push(normalizeSql(sql));
      }),
    } as unknown as QueryRunner;

    await migration.up(queryRunner);

    expect(executedQueries).toEqual([
      'ALTER TABLE "patient_routines" ADD COLUMN IF NOT EXISTS "banho" character varying(5)',
    ]);
  });

  it('removes banho on down migration', async () => {
    const migration = new AddBathTimeToPatientRoutines1763749200000();
    const executedQueries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        executedQueries.push(normalizeSql(sql));
      }),
    } as unknown as QueryRunner;

    await migration.down(queryRunner);

    expect(executedQueries).toEqual([
      'ALTER TABLE "patient_routines" DROP COLUMN IF EXISTS "banho"',
    ]);
  });
});

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

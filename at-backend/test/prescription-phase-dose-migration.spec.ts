import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { NormalizePrescriptionPhaseDoseOverrides1763571600000 } from '../src/database/migrations/1763571600000-NormalizePrescriptionPhaseDoseOverrides';

describe('NormalizePrescriptionPhaseDoseOverrides1763571600000', () => {
  it('creates the relational phase dose table and backfills perDoseOverrides from legacy JSON', async () => {
    const migration = new NormalizePrescriptionPhaseDoseOverrides1763571600000();
    const executedQueries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        executedQueries.push(normalizeSql(sql));
      }),
    } as unknown as QueryRunner;

    await migration.up(queryRunner);

    expect(executedQueries).toEqual(
      expect.arrayContaining([
        expect.stringContaining('CREATE TABLE IF NOT EXISTS "patient_prescription_phase_doses"'),
        expect.stringContaining('CREATE UNIQUE INDEX IF NOT EXISTS "IDX_phase_doses_unique_label_per_phase"'),
        expect.stringContaining('INSERT INTO "patient_prescription_phase_doses"'),
        expect.stringContaining(`phase."perDoseOverrides"::jsonb`),
        expect.stringContaining('DROP COLUMN IF EXISTS "perDoseOverrides"'),
      ]),
    );
  });

  it('rebuilds the legacy JSON column from relational rows on down', async () => {
    const migration = new NormalizePrescriptionPhaseDoseOverrides1763571600000();
    const executedQueries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        executedQueries.push(normalizeSql(sql));
      }),
    } as unknown as QueryRunner;

    await migration.down(queryRunner);

    expect(executedQueries).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ADD COLUMN IF NOT EXISTS "perDoseOverrides" text'),
        expect.stringContaining('jsonb_agg('),
        expect.stringContaining(`'doseLabel', dose."doseLabel"`),
        expect.stringContaining('DROP INDEX IF EXISTS "IDX_phase_doses_unique_label_per_phase"'),
        expect.stringContaining('DROP TABLE IF EXISTS "patient_prescription_phase_doses"'),
      ]),
    );
  });
});

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

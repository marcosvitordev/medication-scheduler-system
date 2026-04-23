import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { ConvertClinicalTimeColumnsToVarchar1763488800000 } from '../src/database/migrations/1763488800000-ConvertClinicalTimeColumnsToVarchar';

describe('ConvertClinicalTimeColumnsToVarchar1763488800000', () => {
  it('converts routine and scheduled display columns from SQL time to varchar(5)', async () => {
    const migration = new ConvertClinicalTimeColumnsToVarchar1763488800000();
    const executedQueries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        executedQueries.push(normalizeSql(sql));
      }),
    } as unknown as QueryRunner;

    await migration.up(queryRunner);

    expect(executedQueries).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ALTER TABLE "patient_routines" ALTER COLUMN "acordar" TYPE character varying(5)'),
        expect.stringContaining('ALTER TABLE "patient_routines" ALTER COLUMN "dormir" TYPE character varying(5)'),
        expect.stringContaining('ALTER TABLE "scheduled_doses" ALTER COLUMN "timeFormatted" TYPE character varying(5)'),
        expect.stringContaining('ALTER TABLE "scheduled_doses" ALTER COLUMN "originalTimeFormatted" TYPE character varying(5)'),
        expect.stringContaining(`USING to_char("timeFormatted", 'HH24:MI')`),
      ]),
    );
  });

  it('restores SQL time columns on down while handling persisted 24:00 values', async () => {
    const migration = new ConvertClinicalTimeColumnsToVarchar1763488800000();
    const executedQueries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        executedQueries.push(normalizeSql(sql));
      }),
    } as unknown as QueryRunner;

    await migration.down(queryRunner);

    expect(executedQueries).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ALTER TABLE "scheduled_doses" ALTER COLUMN "timeFormatted" TYPE time'),
        expect.stringContaining(`WHEN "timeFormatted" = '24:00' THEN TIME '00:00'`),
        expect.stringContaining('ALTER TABLE "patient_routines" ALTER COLUMN "dormir" TYPE time'),
        expect.stringContaining(`WHEN "dormir" = '24:00' THEN TIME '00:00'`),
      ]),
    );
  });
});

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

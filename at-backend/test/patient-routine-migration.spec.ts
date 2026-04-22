import 'reflect-metadata';
import { QueryRunner } from 'typeorm';
import { BaselineClinicalCatalogAndPatientPrescriptions1763406000000 } from '../src/database/migrations/1763406000000-BaselineClinicalCatalogAndPatientPrescriptions';

describe('BaselineClinicalCatalogAndPatientPrescriptions1763406000000', () => {
  it('creates the new baseline tables for clinical catalog and patient prescriptions', async () => {
    const migration = new BaselineClinicalCatalogAndPatientPrescriptions1763406000000();
    const executedQueries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        executedQueries.push(normalizeSql(sql));
      }),
    } as unknown as QueryRunner;

    await migration.up(queryRunner);

    expect(executedQueries).toEqual(
      expect.arrayContaining([
        expect.stringContaining('CREATE TABLE IF NOT EXISTS "clinical_groups"'),
        expect.stringContaining('CREATE TABLE IF NOT EXISTS "clinical_medications"'),
        expect.stringContaining('CREATE TABLE IF NOT EXISTS "clinical_protocols"'),
        expect.stringContaining('CREATE TABLE IF NOT EXISTS "patient_prescriptions"'),
        expect.stringContaining(
          'CREATE TABLE IF NOT EXISTS "patient_prescription_medications"',
        ),
        expect.stringContaining(
          'CREATE TABLE IF NOT EXISTS "patient_prescription_phases"',
        ),
        expect.stringContaining('CREATE TABLE IF NOT EXISTS "scheduled_doses"'),
        expect.stringContaining(
          'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_patient_routines_single_active"',
        ),
        expect.stringContaining('"pharmaceuticalForm" character varying(255)'),
        expect.stringContaining('"windowBeforeMinutes" integer'),
        expect.stringContaining('"windowAfterMinutes" integer'),
        expect.stringContaining('"anchor" character varying(30)'),
        expect.stringContaining('"ocularLaterality" character varying(30)'),
        expect.stringContaining('"oticLaterality" character varying(30)'),
        expect.stringContaining('"originalTimeInMinutes" integer NOT NULL'),
        expect.stringContaining('"conflictInteractionType" character varying(40)'),
        expect.stringContaining('"timeFormatted" time NOT NULL'),
        expect.stringContaining('WHERE active = true'),
      ]),
    );
  });

  it('drops the baseline tables in reverse order on down', async () => {
    const migration = new BaselineClinicalCatalogAndPatientPrescriptions1763406000000();
    const executedQueries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        executedQueries.push(normalizeSql(sql));
      }),
    } as unknown as QueryRunner;

    await migration.down(queryRunner);

    expect(executedQueries).toEqual([
      expect.stringContaining('DROP INDEX IF EXISTS "IDX_patient_routines_single_active"'),
      expect.stringContaining('DROP TABLE IF EXISTS "scheduled_doses"'),
      expect.stringContaining('DROP TABLE IF EXISTS "patient_prescription_phases"'),
      expect.stringContaining('DROP TABLE IF EXISTS "patient_prescription_medications"'),
      expect.stringContaining('DROP TABLE IF EXISTS "patient_prescriptions"'),
      expect.stringContaining('DROP TABLE IF EXISTS "clinical_interaction_rules"'),
      expect.stringContaining('DROP TABLE IF EXISTS "clinical_protocol_steps"'),
      expect.stringContaining('DROP TABLE IF EXISTS "clinical_protocol_frequencies"'),
      expect.stringContaining('DROP TABLE IF EXISTS "clinical_protocols"'),
      expect.stringContaining('DROP TABLE IF EXISTS "clinical_medications"'),
      expect.stringContaining('DROP TABLE IF EXISTS "clinical_groups"'),
    ]);
  });
});

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

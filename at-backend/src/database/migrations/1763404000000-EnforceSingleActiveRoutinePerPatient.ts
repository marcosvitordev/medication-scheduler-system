import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceSingleActiveRoutinePerPatient1763404000000
  implements MigrationInterface
{
  name = 'EnforceSingleActiveRoutinePerPatient1763404000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH ranked_routines AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY "patientId"
            ORDER BY id DESC
          ) AS row_number
        FROM "patient_routines"
        WHERE active = true
      )
      UPDATE "patient_routines" pr
      SET active = false
      FROM ranked_routines rr
      WHERE pr.id = rr.id
        AND rr.row_number > 1
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_patient_routines_single_active"
      ON "patient_routines" ("patientId")
      WHERE active = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_patient_routines_single_active"
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCreatedAtToPatientRoutines1763405000000 implements MigrationInterface {
  name = 'AddCreatedAtToPatientRoutines1763405000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_routines"
      ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    `);

    await queryRunner.query(`
      UPDATE "patient_routines"
      SET "createdAt" = NOW()
      WHERE "createdAt" IS NULL
    `);

    await queryRunner.query(`
      WITH ranked_routines AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY "patientId"
            ORDER BY "createdAt" DESC, id DESC
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
      ALTER TABLE "patient_routines"
      DROP COLUMN IF EXISTS "createdAt"
    `);
  }
}

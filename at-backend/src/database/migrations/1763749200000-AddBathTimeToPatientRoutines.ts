import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBathTimeToPatientRoutines1763749200000
  implements MigrationInterface
{
  name = 'AddBathTimeToPatientRoutines1763749200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_routines"
      ADD COLUMN IF NOT EXISTS "banho" character varying(5)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_routines"
      DROP COLUMN IF EXISTS "banho"
    `);
  }
}

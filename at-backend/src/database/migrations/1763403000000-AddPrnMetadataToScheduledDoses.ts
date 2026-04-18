import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPrnMetadataToScheduledDoses1763403000000 implements MigrationInterface {
  name = 'AddPrnMetadataToScheduledDoses1763403000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      ADD COLUMN IF NOT EXISTS "isPrn" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "clinicalInstructionLabel" character varying(150)
    `);

    await queryRunner.query(`
      UPDATE "scheduled_doses"
      SET
        "isPrn" = CASE WHEN "recurrenceType" = 'PRN' THEN true ELSE false END,
        "clinicalInstructionLabel" = CASE
          WHEN "recurrenceType" <> 'PRN' THEN NULL
          WHEN "prnReason" = 'CRISIS' THEN 'Uso se necessario em caso de crise.'
          WHEN "prnReason" = 'FEVER' THEN 'Uso se necessario em caso de febre.'
          WHEN "prnReason" = 'PAIN' THEN 'Uso se necessario em caso de dor.'
          ELSE 'Uso se necessario.'
        END
      WHERE "recurrenceType" = 'PRN' OR "prnReason" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      DROP COLUMN IF EXISTS "clinicalInstructionLabel",
      DROP COLUMN IF EXISTS "isPrn"
    `);
  }
}

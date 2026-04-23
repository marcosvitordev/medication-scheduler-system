import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenConflictAuditColumnsInScheduledDoses1763662800000
  implements MigrationInterface
{
  name = 'HardenConflictAuditColumnsInScheduledDoses1763662800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      ADD COLUMN IF NOT EXISTS "conflictMatchKind" character varying(40)
    `);

    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      ADD COLUMN IF NOT EXISTS "resolutionReasonCode" character varying(60)
    `);

    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      ADD COLUMN IF NOT EXISTS "resolutionReasonText" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      DROP COLUMN IF EXISTS "resolutionReasonText"
    `);

    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      DROP COLUMN IF EXISTS "resolutionReasonCode"
    `);

    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      DROP COLUMN IF EXISTS "conflictMatchKind"
    `);
  }
}

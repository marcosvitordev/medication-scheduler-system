import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizePrescriptionPhaseDoseOverrides1763571600000
  implements MigrationInterface
{
  name = 'NormalizePrescriptionPhaseDoseOverrides1763571600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_prescription_phase_doses" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "doseLabel" character varying(20) NOT NULL,
        "doseValue" character varying(50) NOT NULL,
        "doseUnit" character varying(30) NOT NULL,
        "phaseId" uuid NOT NULL REFERENCES "patient_prescription_phases"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_phase_doses_unique_label_per_phase"
      ON "patient_prescription_phase_doses" ("phaseId", "doseLabel")
    `);
    await queryRunner.query(`
      INSERT INTO "patient_prescription_phase_doses" ("doseLabel", "doseValue", "doseUnit", "phaseId")
      SELECT
        dose_override ->> 'doseLabel',
        dose_override ->> 'doseValue',
        dose_override ->> 'doseUnit',
        phase."id"
      FROM "patient_prescription_phases" phase
      CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(phase."perDoseOverrides"::jsonb, '[]'::jsonb)
      ) AS dose_override
      WHERE phase."perDoseOverrides" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "patient_prescription_phases"
      DROP COLUMN IF EXISTS "perDoseOverrides"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_prescription_phases"
      ADD COLUMN IF NOT EXISTS "perDoseOverrides" text
    `);
    await queryRunner.query(`
      UPDATE "patient_prescription_phases" phase
      SET "perDoseOverrides" = aggregated.payload
      FROM (
        SELECT
          dose."phaseId",
          jsonb_agg(
            jsonb_build_object(
              'doseLabel', dose."doseLabel",
              'doseValue', dose."doseValue",
              'doseUnit', dose."doseUnit"
            )
            ORDER BY substring(dose."doseLabel" from '[0-9]+')::int, dose."doseLabel"
          )::text AS payload
        FROM "patient_prescription_phase_doses" dose
        GROUP BY dose."phaseId"
      ) AS aggregated
      WHERE aggregated."phaseId" = phase."id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_phase_doses_unique_label_per_phase"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "patient_prescription_phase_doses"
    `);
  }
}

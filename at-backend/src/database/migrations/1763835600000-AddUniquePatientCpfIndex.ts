import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUniquePatientCpfIndex1763835600000 implements MigrationInterface {
  name = 'AddUniquePatientCpfIndex1763835600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "patients"
      SET "cpf" = NULLIF(regexp_replace("cpf", '\\D', '', 'g'), '')
      WHERE "cpf" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_patients_cpf_unique"
      ON "patients" ("cpf")
      WHERE "cpf" IS NOT NULL AND "cpf" <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_patients_cpf_unique"`);
  }
}

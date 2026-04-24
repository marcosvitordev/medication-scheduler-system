import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConvertClinicalTimeColumnsToVarchar1763488800000
  implements MigrationInterface
{
  name = 'ConvertClinicalTimeColumnsToVarchar1763488800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "patient_routines"
      ALTER COLUMN "acordar" TYPE character varying(5)
      USING to_char("acordar", 'HH24:MI')
    `);
    await queryRunner.query(`
      ALTER TABLE "patient_routines"
      ALTER COLUMN "cafe" TYPE character varying(5)
      USING to_char("cafe", 'HH24:MI')
    `);
    await queryRunner.query(`
      ALTER TABLE "patient_routines"
      ALTER COLUMN "almoco" TYPE character varying(5)
      USING to_char("almoco", 'HH24:MI')
    `);
    await queryRunner.query(`
      ALTER TABLE "patient_routines"
      ALTER COLUMN "lanche" TYPE character varying(5)
      USING to_char("lanche", 'HH24:MI')
    `);
    await queryRunner.query(`
      ALTER TABLE "patient_routines"
      ALTER COLUMN "jantar" TYPE character varying(5)
      USING to_char("jantar", 'HH24:MI')
    `);
    await queryRunner.query(`
      ALTER TABLE "patient_routines"
      ALTER COLUMN "dormir" TYPE character varying(5)
      USING to_char("dormir", 'HH24:MI')
    `);
    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      ALTER COLUMN "timeFormatted" TYPE character varying(5)
      USING to_char("timeFormatted", 'HH24:MI')
    `);
    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      ALTER COLUMN "originalTimeFormatted" TYPE character varying(5)
      USING to_char("originalTimeFormatted", 'HH24:MI')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      ALTER COLUMN "originalTimeFormatted" TYPE time
      USING CASE
        WHEN "originalTimeFormatted" = '24:00' THEN TIME '00:00'
        ELSE "originalTimeFormatted"::time
      END
    `);
    await queryRunner.query(`
      ALTER TABLE "scheduled_doses"
      ALTER COLUMN "timeFormatted" TYPE time
      USING CASE
        WHEN "timeFormatted" = '24:00' THEN TIME '00:00'
        ELSE "timeFormatted"::time
      END
    `);
    await queryRunner.query(`
      ALTER TABLE "patient_routines"
      ALTER COLUMN "dormir" TYPE time
      USING CASE
        WHEN "dormir" = '24:00' THEN TIME '00:00'
        ELSE "dormir"::time
      END
    `);
    await queryRunner.query(`
      ALTER TABLE "patient_routines"
      ALTER COLUMN "jantar" TYPE time
      USING CASE
        WHEN "jantar" = '24:00' THEN TIME '00:00'
        ELSE "jantar"::time
      END
    `);
    await queryRunner.query(`
      ALTER TABLE "patient_routines"
      ALTER COLUMN "lanche" TYPE time
      USING CASE
        WHEN "lanche" = '24:00' THEN TIME '00:00'
        ELSE "lanche"::time
      END
    `);
    await queryRunner.query(`
      ALTER TABLE "patient_routines"
      ALTER COLUMN "almoco" TYPE time
      USING CASE
        WHEN "almoco" = '24:00' THEN TIME '00:00'
        ELSE "almoco"::time
      END
    `);
    await queryRunner.query(`
      ALTER TABLE "patient_routines"
      ALTER COLUMN "cafe" TYPE time
      USING CASE
        WHEN "cafe" = '24:00' THEN TIME '00:00'
        ELSE "cafe"::time
      END
    `);
    await queryRunner.query(`
      ALTER TABLE "patient_routines"
      ALTER COLUMN "acordar" TYPE time
      USING CASE
        WHEN "acordar" = '24:00' THEN TIME '00:00'
        ELSE "acordar"::time
      END
    `);
  }
}

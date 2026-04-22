import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineClinicalCatalogAndPatientPrescriptions1763406000000
  implements MigrationInterface
{
  name = 'BaselineClinicalCatalogAndPatientPrescriptions1763406000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clinical_groups" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "code" character varying(60) NOT NULL UNIQUE,
        "name" character varying(255) NOT NULL,
        "description" text
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clinical_medications" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "commercialName" character varying(255),
        "activePrinciple" character varying(255) NOT NULL,
        "presentation" character varying(255) NOT NULL,
        "pharmaceuticalForm" character varying(255),
        "administrationRoute" character varying(255) NOT NULL,
        "usageInstructions" text NOT NULL,
        "diluentType" character varying(255),
        "defaultAdministrationUnit" character varying(30),
        "supportsManualAdjustment" boolean NOT NULL DEFAULT false,
        "isOphthalmic" boolean NOT NULL DEFAULT false,
        "isOtic" boolean NOT NULL DEFAULT false,
        "isContraceptiveMonthly" boolean NOT NULL DEFAULT false,
        "requiresGlycemiaScale" boolean NOT NULL DEFAULT false,
        "notes" text,
        "isDefault" boolean NOT NULL DEFAULT false
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clinical_protocols" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "code" character varying(100) NOT NULL UNIQUE,
        "name" character varying(255) NOT NULL,
        "description" text NOT NULL,
        "subgroupCode" character varying(100),
        "priority" integer NOT NULL DEFAULT 0,
        "isDefault" boolean NOT NULL DEFAULT false,
        "active" boolean NOT NULL DEFAULT true,
        "clinicalNotes" text,
        "medicationId" uuid NOT NULL REFERENCES "clinical_medications"("id") ON DELETE CASCADE,
        "groupId" uuid NOT NULL REFERENCES "clinical_groups"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clinical_protocol_frequencies" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "frequency" integer NOT NULL,
        "label" character varying(255),
        "allowedRecurrenceTypes" text,
        "allowsPrn" boolean NOT NULL DEFAULT false,
        "allowsVariableDoseBySchedule" boolean NOT NULL DEFAULT false,
        "protocolId" uuid NOT NULL REFERENCES "clinical_protocols"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clinical_protocol_steps" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "doseLabel" character varying(20) NOT NULL,
        "anchor" character varying(40) NOT NULL,
        "offsetMinutes" integer NOT NULL,
        "semanticTag" character varying(40) NOT NULL DEFAULT 'STANDARD',
        "frequencyId" uuid NOT NULL REFERENCES "clinical_protocol_frequencies"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clinical_interaction_rules" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "interactionType" character varying(60) NOT NULL,
        "targetGroupCode" character varying(60),
        "targetProtocolCode" character varying(100),
        "resolutionType" character varying(60) NOT NULL,
        "windowMinutes" integer,
        "windowBeforeMinutes" integer,
        "windowAfterMinutes" integer,
        "applicableSemanticTags" text,
        "priority" integer NOT NULL DEFAULT 0,
        "protocolId" uuid NOT NULL REFERENCES "clinical_protocols"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_prescriptions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "startedAt" date NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'ACTIVE',
        "patientId" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_prescription_medications" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "sourceClinicalMedicationId" uuid NOT NULL,
        "sourceProtocolId" uuid NOT NULL,
        "medicationSnapshot" text NOT NULL,
        "protocolSnapshot" text NOT NULL,
        "interactionRulesSnapshot" text NOT NULL,
        "prescriptionId" uuid NOT NULL REFERENCES "patient_prescriptions"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_prescription_phases" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "phaseOrder" integer NOT NULL,
        "frequency" integer NOT NULL,
        "sameDosePerSchedule" boolean NOT NULL DEFAULT true,
        "doseAmount" character varying(100) NOT NULL DEFAULT '1 unidade',
        "doseValue" character varying(50),
        "doseUnit" character varying(30),
        "perDoseOverrides" text,
        "recurrenceType" character varying(30) NOT NULL DEFAULT 'DAILY',
        "alternateDaysInterval" integer,
        "weeklyDay" character varying(20),
        "monthlyRule" character varying(100),
        "monthlyDay" integer,
        "monthlySpecialReference" character varying(50),
        "monthlySpecialBaseDate" date,
        "monthlySpecialOffsetDays" integer,
        "treatmentDays" integer,
        "continuousUse" boolean NOT NULL DEFAULT false,
        "prnReason" character varying(20),
        "ocularLaterality" character varying(30),
        "oticLaterality" character varying(30),
        "glycemiaScaleRanges" text,
        "manualAdjustmentEnabled" boolean NOT NULL DEFAULT false,
        "manualTimes" text,
        "prescriptionMedicationId" uuid NOT NULL REFERENCES "patient_prescription_medications"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "scheduled_doses" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "phaseOrder" integer NOT NULL,
        "doseLabel" character varying(20) NOT NULL,
        "administrationValue" character varying(50),
        "administrationUnit" character varying(30),
        "administrationLabel" character varying(100),
        "recurrenceType" character varying(30),
        "startDate" date,
        "endDate" date,
        "weeklyDay" character varying(20),
        "monthlyRule" character varying(100),
        "monthlyDay" integer,
        "alternateDaysInterval" integer,
        "continuousUse" boolean NOT NULL DEFAULT false,
        "isPrn" boolean NOT NULL DEFAULT false,
        "prnReason" character varying(20),
        "clinicalInstructionLabel" text,
        "timeInMinutes" integer NOT NULL,
        "timeFormatted" time NOT NULL,
        "anchor" character varying(30),
        "anchorTimeInMinutes" integer,
        "offsetMinutes" integer,
        "semanticTag" character varying(40),
        "originalTimeInMinutes" integer NOT NULL,
        "originalTimeFormatted" time NOT NULL,
        "status" character varying(30) NOT NULL,
        "note" text,
        "conflictInteractionType" character varying(40),
        "conflictResolutionType" character varying(50),
        "conflictTriggerMedicationName" character varying(255),
        "conflictTriggerGroupCode" character varying(60),
        "conflictTriggerProtocolCode" character varying(100),
        "conflictRulePriority" integer,
        "conflictWindowBeforeMinutes" integer,
        "conflictWindowAfterMinutes" integer,
        "prescriptionId" uuid NOT NULL REFERENCES "patient_prescriptions"("id") ON DELETE CASCADE,
        "prescriptionMedicationId" uuid NOT NULL REFERENCES "patient_prescription_medications"("id") ON DELETE CASCADE,
        "phaseId" uuid NOT NULL REFERENCES "patient_prescription_phases"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_patient_routines_single_active"
      ON "patient_routines" ("patientId")
      WHERE active = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_patient_routines_single_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "scheduled_doses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_prescription_phases"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_prescription_medications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_prescriptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clinical_interaction_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clinical_protocol_steps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clinical_protocol_frequencies"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clinical_protocols"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clinical_medications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "clinical_groups"`);
  }
}

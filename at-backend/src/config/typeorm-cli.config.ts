import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Patient } from '../modules/patients/entities/patient.entity';
import { PatientRoutine } from '../modules/patients/entities/patient-routine.entity';
import { ClinicalMedication } from '../modules/clinical-catalog/entities/clinical-medication.entity';
import { ClinicalGroup } from '../modules/clinical-catalog/entities/clinical-group.entity';
import { ClinicalProtocol } from '../modules/clinical-catalog/entities/clinical-protocol.entity';
import { ClinicalProtocolFrequency } from '../modules/clinical-catalog/entities/clinical-protocol-frequency.entity';
import { ClinicalProtocolStep } from '../modules/clinical-catalog/entities/clinical-protocol-step.entity';
import { ClinicalInteractionRule } from '../modules/clinical-catalog/entities/clinical-interaction-rule.entity';
import { PatientPrescription } from '../modules/patient-prescriptions/entities/patient-prescription.entity';
import { PatientPrescriptionMedication } from '../modules/patient-prescriptions/entities/patient-prescription-medication.entity';
import { PatientPrescriptionPhaseDose } from '../modules/patient-prescriptions/entities/patient-prescription-phase-dose.entity';
import { PatientPrescriptionPhase } from '../modules/patient-prescriptions/entities/patient-prescription-phase.entity';
import { ScheduledDose } from '../modules/scheduling/entities/scheduled-dose.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? process.env.DB_DATABASE,
  entities: [
    Patient,
    PatientRoutine,
    ClinicalGroup,
    ClinicalMedication,
    ClinicalProtocol,
    ClinicalProtocolFrequency,
    ClinicalProtocolStep,
    ClinicalInteractionRule,
    PatientPrescription,
    PatientPrescriptionMedication,
    PatientPrescriptionPhase,
    PatientPrescriptionPhaseDose,
    ScheduledDose,
  ],
  migrations: ['src/database/migrations/*.ts']
});

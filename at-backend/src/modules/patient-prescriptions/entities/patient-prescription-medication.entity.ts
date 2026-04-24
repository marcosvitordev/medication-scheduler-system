import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import {
  ClinicalInteractionRuleSnapshot,
  ClinicalMedicationSnapshot,
  ClinicalProtocolSnapshot,
} from './patient-prescription-snapshot.types';
import { PatientPrescription } from './patient-prescription.entity';
import { PatientPrescriptionPhase } from './patient-prescription-phase.entity';

@Entity('patient_prescription_medications')
export class PatientPrescriptionMedication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PatientPrescription, (prescription) => prescription.medications, {
    onDelete: 'CASCADE',
  })
  prescription: PatientPrescription;

  @Column({ type: 'uuid' })
  sourceClinicalMedicationId: string;

  @Column({ type: 'uuid' })
  sourceProtocolId: string;

  @Column({ type: 'simple-json' })
  medicationSnapshot: ClinicalMedicationSnapshot;

  @Column({ type: 'simple-json' })
  protocolSnapshot: ClinicalProtocolSnapshot;

  @Column({ type: 'simple-json' })
  interactionRulesSnapshot: ClinicalInteractionRuleSnapshot[];

  @OneToMany(() => PatientPrescriptionPhase, (phase) => phase.prescriptionMedication, {
    cascade: true,
    eager: true,
  })
  phases: PatientPrescriptionPhase[];
}

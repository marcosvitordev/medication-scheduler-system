import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ClinicalAnchor } from '../../../common/enums/clinical-anchor.enum';
import { ClinicalInteractionType } from '../../../common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../../../common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../../../common/enums/clinical-semantic-tag.enum';
import { PrnReason } from '../../../common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';
import { PatientPrescriptionMedication } from '../../patient-prescriptions/entities/patient-prescription-medication.entity';
import { PatientPrescriptionPhase } from '../../patient-prescriptions/entities/patient-prescription-phase.entity';
import { PatientPrescription } from '../../patient-prescriptions/entities/patient-prescription.entity';

@Entity('scheduled_doses')
export class ScheduledDose {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PatientPrescription, { onDelete: 'CASCADE' })
  prescription: PatientPrescription;

  @ManyToOne(() => PatientPrescriptionMedication, { eager: true, onDelete: 'CASCADE' })
  prescriptionMedication: PatientPrescriptionMedication;

  @ManyToOne(() => PatientPrescriptionPhase, { eager: true, onDelete: 'CASCADE' })
  phase: PatientPrescriptionPhase;

  @Column({ type: 'int' })
  phaseOrder: number;

  @Column({ type: 'varchar', length: 20 })
  doseLabel: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  administrationValue?: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  administrationUnit?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  administrationLabel?: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  recurrenceType?: TreatmentRecurrence;

  @Column({ type: 'date', nullable: true })
  startDate?: string;

  @Column({ type: 'date', nullable: true })
  endDate?: string;

  @Column({ nullable: true })
  weeklyDay?: string;

  @Column({ nullable: true })
  monthlyRule?: string;

  @Column({ type: 'int', nullable: true })
  monthlyDay?: number;

  @Column({ type: 'int', nullable: true })
  alternateDaysInterval?: number;

  @Column({ default: false })
  continuousUse: boolean;

  @Column({ default: false })
  isPrn: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  prnReason?: PrnReason;

  @Column({ type: 'text', nullable: true })
  clinicalInstructionLabel?: string;

  @Column({ type: 'int' })
  timeInMinutes: number;

  @Column({ type: 'varchar', length: 5 })
  timeFormatted: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  anchor?: ClinicalAnchor;

  @Column({ type: 'int', nullable: true })
  anchorTimeInMinutes?: number;

  @Column({ type: 'int', nullable: true })
  offsetMinutes?: number;

  @Column({ type: 'varchar', length: 40, nullable: true })
  semanticTag?: ClinicalSemanticTag;

  @Column({ type: 'int' })
  originalTimeInMinutes: number;

  @Column({ type: 'varchar', length: 5 })
  originalTimeFormatted: string;

  @Column({ type: 'varchar', length: 30, default: 'ACTIVE' })
  status: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  conflictInteractionType?: ClinicalInteractionType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  conflictResolutionType?: ClinicalResolutionType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  conflictTriggerMedicationName?: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  conflictTriggerGroupCode?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  conflictTriggerProtocolCode?: string;

  @Column({ type: 'int', nullable: true })
  conflictRulePriority?: number;

  @Column({ type: 'int', nullable: true })
  conflictWindowBeforeMinutes?: number;

  @Column({ type: 'int', nullable: true })
  conflictWindowAfterMinutes?: number;
}

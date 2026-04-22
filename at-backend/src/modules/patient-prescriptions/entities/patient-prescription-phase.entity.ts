import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DoseUnit } from '../../../common/enums/dose-unit.enum';
import { OcularLaterality } from '../../../common/enums/ocular-laterality.enum';
import { OticLaterality } from '../../../common/enums/otic-laterality.enum';
import { PrnReason } from '../../../common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';
import { MonthlySpecialReference } from '../../../common/enums/monthly-special-reference.enum';
import {
  PrescriptionPhaseDoseOverride,
  PrescriptionPhaseGlycemiaScaleRange,
} from './patient-prescription-snapshot.types';
import { PatientPrescriptionMedication } from './patient-prescription-medication.entity';

@Entity('patient_prescription_phases')
export class PatientPrescriptionPhase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => PatientPrescriptionMedication,
    (prescriptionMedication) => prescriptionMedication.phases,
    { onDelete: 'CASCADE' },
  )
  prescriptionMedication: PatientPrescriptionMedication;

  @Column({ type: 'int' })
  phaseOrder: number;

  @Column({ type: 'int' })
  frequency: number;

  @Column({ default: true })
  sameDosePerSchedule: boolean;

  @Column({ type: 'varchar', length: 50, default: '1 unidade' })
  doseAmount: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  doseValue?: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  doseUnit?: DoseUnit;

  @Column({ type: 'simple-json', nullable: true })
  perDoseOverrides?: PrescriptionPhaseDoseOverride[];

  @Column({ type: 'varchar', length: 30, default: TreatmentRecurrence.DAILY })
  recurrenceType: TreatmentRecurrence;

  @Column({ nullable: true })
  weeklyDay?: string;

  @Column({ nullable: true })
  monthlyRule?: string;

  @Column({ type: 'int', nullable: true })
  monthlyDay?: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  monthlySpecialReference?: MonthlySpecialReference;

  @Column({ type: 'date', nullable: true })
  monthlySpecialBaseDate?: string;

  @Column({ type: 'int', nullable: true })
  monthlySpecialOffsetDays?: number;

  @Column({ type: 'int', nullable: true })
  alternateDaysInterval?: number;

  @Column({ type: 'int', nullable: true })
  treatmentDays?: number;

  @Column({ default: false })
  continuousUse: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  prnReason?: PrnReason;

  @Column({ type: 'varchar', length: 30, nullable: true })
  ocularLaterality?: OcularLaterality;

  @Column({ type: 'varchar', length: 30, nullable: true })
  oticLaterality?: OticLaterality;

  @Column({ type: 'simple-json', nullable: true })
  glycemiaScaleRanges?: PrescriptionPhaseGlycemiaScaleRange[];

  @Column({ default: false })
  manualAdjustmentEnabled: boolean;

  @Column({ type: 'simple-array', nullable: true })
  manualTimes?: string[];
}

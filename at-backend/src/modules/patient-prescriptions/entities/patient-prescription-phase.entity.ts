import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
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
import { PatientPrescriptionPhaseDose } from './patient-prescription-phase-dose.entity';

@Entity('patient_prescription_phases')
export class PatientPrescriptionPhase {
  private phaseDoseOverridesOverride?: PrescriptionPhaseDoseOverride[];

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

  @OneToMany(() => PatientPrescriptionPhaseDose, (doseOverride) => doseOverride.phase, {
    cascade: true,
    eager: true,
  })
  doseOverrides?: PatientPrescriptionPhaseDose[];

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

  get perDoseOverrides(): PrescriptionPhaseDoseOverride[] | undefined {
    if (this.phaseDoseOverridesOverride !== undefined) {
      return this.phaseDoseOverridesOverride;
    }

    if (!this.doseOverrides?.length) {
      return undefined;
    }

    return [...this.doseOverrides]
      .sort((left, right) => compareDoseLabels(left.doseLabel, right.doseLabel))
      .map((doseOverride) => ({
        doseLabel: doseOverride.doseLabel,
        doseValue: doseOverride.doseValue,
        doseUnit: doseOverride.doseUnit,
      }));
  }

  set perDoseOverrides(value: PrescriptionPhaseDoseOverride[] | undefined) {
    this.phaseDoseOverridesOverride = value;
  }

  toJSON(): Record<string, unknown> {
    const {
      doseOverrides,
      phaseDoseOverridesOverride,
      ...phase
    } = this as unknown as Record<string, unknown> & {
      doseOverrides?: PatientPrescriptionPhaseDose[];
      phaseDoseOverridesOverride?: PrescriptionPhaseDoseOverride[];
    };

    return {
      ...phase,
      perDoseOverrides: this.perDoseOverrides ?? undefined,
    };
  }
}

function compareDoseLabels(left: string, right: string): number {
  const leftIndex = Number(left.replace(/\D+/g, ''));
  const rightIndex = Number(right.replace(/\D+/g, ''));
  return leftIndex - rightIndex || left.localeCompare(right);
}

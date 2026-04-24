import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DoseUnit } from '../../../common/enums/dose-unit.enum';
import { PatientPrescriptionPhase } from './patient-prescription-phase.entity';

@Entity('patient_prescription_phase_doses')
@Index('IDX_phase_doses_unique_label_per_phase', ['phase', 'doseLabel'], { unique: true })
export class PatientPrescriptionPhaseDose {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PatientPrescriptionPhase, (phase) => phase.doseOverrides, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  phase: PatientPrescriptionPhase;

  @Column({ type: 'varchar', length: 20 })
  doseLabel: string;

  @Column({ type: 'varchar', length: 50 })
  doseValue: string;

  @Column({ type: 'varchar', length: 30 })
  doseUnit: DoseUnit;
}

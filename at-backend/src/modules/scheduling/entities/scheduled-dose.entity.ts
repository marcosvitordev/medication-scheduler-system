import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PrnReason } from '../../../common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';
import { Prescription } from '../../prescriptions/entities/prescription.entity';
import { PrescriptionItem } from '../../prescriptions/entities/prescription-item.entity';

@Entity('scheduled_doses')
export class ScheduledDose {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Prescription, { onDelete: 'CASCADE' })
  prescription: Prescription;

  @ManyToOne(() => PrescriptionItem, (item) => item.schedules, { eager: true, onDelete: 'CASCADE' })
  prescriptionItem: PrescriptionItem;

  @Column()
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

  @Column({ type: 'varchar', length: 150, nullable: true })
  clinicalInstructionLabel?: string;

  @Column({ type: 'int' })
  timeInMinutes: number;

  @Column({ type: 'time' })
  timeFormatted: string;

  @Column({ default: 'ACTIVE' })
  status: string;

  @Column({ type: 'text', nullable: true })
  note?: string;
}

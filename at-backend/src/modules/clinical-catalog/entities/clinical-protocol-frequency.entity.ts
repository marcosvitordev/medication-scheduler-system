import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';
import { ClinicalProtocol } from './clinical-protocol.entity';
import { ClinicalProtocolStep } from './clinical-protocol-step.entity';

@Entity('clinical_protocol_frequencies')
export class ClinicalProtocolFrequency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClinicalProtocol, (protocol) => protocol.frequencies, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  protocol: ClinicalProtocol;

  @Column({ type: 'int' })
  frequency: number;

  @Column({ nullable: true })
  label?: string;

  @Column({ type: 'simple-array', nullable: true })
  allowedRecurrenceTypes?: TreatmentRecurrence[];

  @Column({ default: false })
  allowsPrn: boolean;

  @Column({ default: false })
  allowsVariableDoseBySchedule: boolean;

  @OneToMany(() => ClinicalProtocolStep, (step) => step.frequencyConfig, {
    cascade: true,
    eager: true,
  })
  steps: ClinicalProtocolStep[];
}

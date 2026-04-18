import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Patient } from './patient.entity';

@Entity('patient_routines')
export class PatientRoutine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, (patient) => patient.routines, { onDelete: 'CASCADE' })
  patient: Patient;

  @Column({ type: 'time' })
  acordar: string;

  @Column({ type: 'time' })
  cafe: string;

  @Column({ type: 'time' })
  almoco: string;

  @Column({ type: 'time' })
  lanche: string;

  @Column({ type: 'time' })
  jantar: string;

  @Column({ type: 'time' })
  dormir: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}

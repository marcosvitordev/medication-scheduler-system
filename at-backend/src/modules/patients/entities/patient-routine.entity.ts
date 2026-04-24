import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Patient } from './patient.entity';

@Entity('patient_routines')
export class PatientRoutine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, (patient) => patient.routines, { onDelete: 'CASCADE' })
  patient: Patient;

  @Column({ type: 'varchar', length: 5 })
  acordar: string;

  @Column({ type: 'varchar', length: 5 })
  cafe: string;

  @Column({ type: 'varchar', length: 5 })
  almoco: string;

  @Column({ type: 'varchar', length: 5 })
  lanche: string;

  @Column({ type: 'varchar', length: 5 })
  jantar: string;

  @Column({ type: 'varchar', length: 5 })
  dormir: string;

  @Column({ type: 'varchar', length: 5, nullable: true })
  banho?: string | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;
}

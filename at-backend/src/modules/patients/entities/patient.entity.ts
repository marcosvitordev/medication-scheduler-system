import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { PatientRoutine } from './patient-routine.entity';
import { PatientPrescription } from '../../patient-prescriptions/entities/patient-prescription.entity';

@Entity('patients')
@Index('IDX_patients_cpf_unique', ['cpf'], {
  unique: true,
  where: `"cpf" IS NOT NULL AND "cpf" <> ''`,
})
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column({ type: 'date' })
  birthDate: string;

  @Column({ nullable: true })
  rg?: string;

  @Column({ nullable: true })
  cpf?: string;

  @Column({ nullable: true })
  phone?: string;

  @OneToMany(() => PatientRoutine, (routine) => routine.patient, { cascade: true })
  routines: PatientRoutine[];

  @OneToMany(() => PatientPrescription, (prescription) => prescription.patient)
  prescriptions: PatientPrescription[];
}

import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { PatientPrescriptionMedication } from './patient-prescription-medication.entity';

@Entity('patient_prescriptions')
export class PatientPrescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, (patient) => patient.prescriptions, {
    eager: true,
    onDelete: 'CASCADE',
  })
  patient: Patient;

  @Column({ type: 'date' })
  startedAt: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status: string;

  @OneToMany(() => PatientPrescriptionMedication, (medication) => medication.prescription, {
    cascade: true,
    eager: true,
  })
  medications: PatientPrescriptionMedication[];
}

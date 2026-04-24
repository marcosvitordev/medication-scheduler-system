import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalCatalogModule } from '../clinical-catalog/clinical-catalog.module';
import { PatientModule } from '../patients/patient.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { PatientPrescriptionController } from './patient-prescription.controller';
import { PatientPrescriptionService } from './patient-prescription.service';
import { PatientPrescriptionMedication } from './entities/patient-prescription-medication.entity';
import { PatientPrescriptionPhaseDose } from './entities/patient-prescription-phase-dose.entity';
import { PatientPrescriptionPhase } from './entities/patient-prescription-phase.entity';
import { PatientPrescription } from './entities/patient-prescription.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PatientPrescription,
      PatientPrescriptionMedication,
      PatientPrescriptionPhase,
      PatientPrescriptionPhaseDose,
    ]),
    PatientModule,
    ClinicalCatalogModule,
    forwardRef(() => SchedulingModule),
  ],
  controllers: [PatientPrescriptionController],
  providers: [PatientPrescriptionService],
  exports: [PatientPrescriptionService, TypeOrmModule],
})
export class PatientPrescriptionModule {}

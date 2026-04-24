import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientModule } from '../patients/patient.module';
import { PatientPrescription } from '../patient-prescriptions/entities/patient-prescription.entity';
import { PatientPrescriptionModule } from '../patient-prescriptions/patient-prescription.module';
import { ScheduledDose } from './entities/scheduled-dose.entity';
import { SchedulingService } from './scheduling.service';
import { ConflictResolutionService } from './services/conflict-resolution.service';
import { SchedulingRulesService } from './services/scheduling-rules.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduledDose, PatientPrescription]),
    forwardRef(() => PatientModule),
    forwardRef(() => PatientPrescriptionModule),
  ],
  providers: [SchedulingService, SchedulingRulesService, ConflictResolutionService],
  exports: [SchedulingService]
})
export class SchedulingModule {}

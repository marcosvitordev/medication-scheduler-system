import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { SchedulingService } from '../scheduling/scheduling.service';
import { CreatePatientPrescriptionDto } from './dto/create-patient-prescription.dto';
import {
  AppendPrescriptionMedicationPhasesDto,
  UpdatePatientPrescriptionDto,
} from './dto/update-patient-prescription.dto';
import { PatientPrescriptionService } from './patient-prescription.service';

@Controller('patient-prescriptions')
export class PatientPrescriptionController {
  constructor(
    private readonly patientPrescriptionService: PatientPrescriptionService,
    private readonly schedulingService: SchedulingService,
  ) {}

  @Post()
  create(@Body() dto: CreatePatientPrescriptionDto) {
    return this.patientPrescriptionService.create(dto);
  }

  @Post(':id/medications/:prescriptionMedicationId/phases')
  appendPhases(
    @Param('id') id: string,
    @Param('prescriptionMedicationId') prescriptionMedicationId: string,
    @Body() dto: AppendPrescriptionMedicationPhasesDto,
  ) {
    return this.patientPrescriptionService.appendPhases(id, prescriptionMedicationId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePatientPrescriptionDto) {
    return this.patientPrescriptionService.updatePrescription(id, dto);
  }

  @Get()
  list() {
    return this.patientPrescriptionService.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.patientPrescriptionService.findById(id);
  }

  @Get(':id/schedule')
  getSchedule(@Param('id') id: string) {
    return this.schedulingService.getScheduleByPrescription(id);
  }
}

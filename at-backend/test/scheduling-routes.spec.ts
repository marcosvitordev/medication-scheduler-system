import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PatientPrescriptionController } from '../src/modules/patient-prescriptions/patient-prescription.controller';
import { SchedulingModule } from '../src/modules/scheduling/scheduling.module';

describe('Scheduling routes', () => {
  it('keeps official route GET /patient-prescriptions/:id/schedule', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PatientPrescriptionController)).toBe(
      'patient-prescriptions',
    );
    expect(
      Reflect.getMetadata(PATH_METADATA, PatientPrescriptionController.prototype.getSchedule),
    ).toBe(':id/schedule');
    expect(
      Reflect.getMetadata(METHOD_METADATA, PatientPrescriptionController.prototype.getSchedule),
    ).toBe(RequestMethod.GET);
  });

  it('registers append phases route POST /patient-prescriptions/:id/medications/:prescriptionMedicationId/phases', () => {
    expect(
      Reflect.getMetadata(PATH_METADATA, PatientPrescriptionController.prototype.appendPhases),
    ).toBe(':id/medications/:prescriptionMedicationId/phases');
    expect(
      Reflect.getMetadata(METHOD_METADATA, PatientPrescriptionController.prototype.appendPhases),
    ).toBe(RequestMethod.POST);
  });

  it('registers update prescription route PATCH /patient-prescriptions/:id', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PatientPrescriptionController.prototype.update)).toBe(
      ':id',
    );
    expect(Reflect.getMetadata(METHOD_METADATA, PatientPrescriptionController.prototype.update)).toBe(
      RequestMethod.PATCH,
    );
  });

  it('does not register legacy schedules controller route', () => {
    const controllers: Array<new (...args: unknown[]) => unknown> =
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, SchedulingModule) ?? [];
    const controllerPaths = controllers.map((controller) =>
      Reflect.getMetadata(PATH_METADATA, controller),
    );
    expect(controllerPaths).not.toContain('schedules');
  });
});

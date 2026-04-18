import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { QueryFailedError, Repository, DataSource } from 'typeorm';
import { PatientService } from '../src/modules/patients/patient.service';
import { Patient } from '../src/modules/patients/entities/patient.entity';
import { PatientRoutine } from '../src/modules/patients/entities/patient-routine.entity';

describe('PatientService', () => {
  let service: PatientService;
  let patientRepository: Partial<Repository<Patient>>;
  let routineRepository: Partial<Repository<PatientRoutine>>;
  let dataSource: Partial<DataSource>;

  beforeEach(() => {
    patientRepository = {};
    routineRepository = {};
    dataSource = {
      transaction: jest.fn()
    };

    service = new PatientService(
      patientRepository as Repository<Patient>,
      routineRepository as Repository<PatientRoutine>,
      dataSource as DataSource
    );
  });

  it('translates single active routine unique violations into ConflictException', async () => {
    const driverError = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      constraint: 'IDX_patient_routines_single_active'
    });
    const uniqueViolation = new QueryFailedError('INSERT INTO patient_routines ...', [], driverError);

    (dataSource.transaction as jest.Mock).mockRejectedValue(uniqueViolation);

    await expect(
      service.addRoutine('patient-1', {
        acordar: '06:00',
        cafe: '07:00',
        almoco: '12:00',
        lanche: '15:00',
        jantar: '19:00',
        dormir: '22:00'
      })
    ).rejects.toThrow(ConflictException);
  });
});

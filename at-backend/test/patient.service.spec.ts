import 'reflect-metadata';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
    patientRepository = {
      create: jest.fn((entity) => entity as Patient),
      save: jest.fn(async (entity) => ({ id: 'patient-1', ...entity }) as Patient),
      findOne: jest.fn(),
    } as unknown as Partial<Repository<Patient>>;
    routineRepository = {
      find: jest.fn()
    };
    dataSource = {
      transaction: jest.fn()
    };

    service = new PatientService(
      patientRepository as Repository<Patient>,
      routineRepository as Repository<PatientRoutine>,
      dataSource as DataSource
    );
  });

  it('normalizes masked CPF before creating a patient', async () => {
    (patientRepository.findOne as jest.Mock).mockResolvedValue(null);

    await service.createPatient({
      fullName: 'Paciente Teste',
      birthDate: '1990-01-01',
      cpf: '123.456.789-01',
    });

    expect(patientRepository.findOne).toHaveBeenCalledWith({
      where: { cpf: '12345678901' },
    });
    expect(patientRepository.create).toHaveBeenCalledWith({
      fullName: 'Paciente Teste',
      birthDate: '1990-01-01',
      cpf: '12345678901',
    });
  });

  it('rejects duplicate patient CPF before saving', async () => {
    (patientRepository.findOne as jest.Mock).mockResolvedValue({
      id: 'patient-existing',
      cpf: '12345678901',
    });

    await expect(
      service.createPatient({
        fullName: 'Paciente Teste',
        birthDate: '1990-01-01',
        cpf: '123.456.789-01',
      }),
    ).rejects.toThrow(ConflictException);
    expect(patientRepository.save).not.toHaveBeenCalled();
  });

  it('allows creating a patient without CPF', async () => {
    await service.createPatient({
      fullName: 'Paciente Sem CPF',
      birthDate: '1990-01-01',
    });

    expect(patientRepository.findOne).not.toHaveBeenCalled();
    expect(patientRepository.create).toHaveBeenCalledWith({
      fullName: 'Paciente Sem CPF',
      birthDate: '1990-01-01',
      cpf: undefined,
    });
  });

  it('rejects CPF with a digit count different from 11', async () => {
    await expect(
      service.createPatient({
        fullName: 'Paciente Teste',
        birthDate: '1990-01-01',
        cpf: '123.456',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(patientRepository.save).not.toHaveBeenCalled();
  });

  it('translates patient CPF unique violations into ConflictException', async () => {
    (patientRepository.findOne as jest.Mock).mockResolvedValue(null);
    const driverError = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      constraint: 'IDX_patients_cpf_unique',
    });
    const uniqueViolation = new QueryFailedError('INSERT INTO patients ...', [], driverError);
    (patientRepository.save as jest.Mock).mockRejectedValue(uniqueViolation);

    await expect(
      service.createPatient({
        fullName: 'Paciente Teste',
        birthDate: '1990-01-01',
        cpf: '12345678901',
      }),
    ).rejects.toThrow(ConflictException);
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

  it('requests active routines ordered by createdAt descending and id descending', async () => {
    const routine = {
      id: 'routine-1',
      active: true,
      createdAt: new Date('2026-04-17T12:00:00Z')
    } as PatientRoutine;

    (routineRepository.find as jest.Mock).mockResolvedValue([routine]);

    await expect(service.getActiveRoutine('patient-1')).resolves.toBe(routine);

    expect(routineRepository.find).toHaveBeenCalledWith({
      where: { patient: { id: 'patient-1' }, active: true },
      relations: ['patient'],
      order: { createdAt: 'DESC', id: 'DESC' }
    });
  });

  it('throws not found when there is no active routine', async () => {
    (routineRepository.find as jest.Mock).mockResolvedValue([]);

    await expect(service.getActiveRoutine('patient-1')).rejects.toThrow(NotFoundException);
  });

  it('throws conflict when multiple active routines are returned', async () => {
    (routineRepository.find as jest.Mock).mockResolvedValue([
      { id: 'routine-2' },
      { id: 'routine-1' }
    ]);

    await expect(service.getActiveRoutine('patient-1')).rejects.toThrow(ConflictException);
  });
});

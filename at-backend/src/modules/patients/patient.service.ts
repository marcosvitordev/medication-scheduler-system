import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { validateRoutine } from '../../common/utils/routine.util';
import { CreatePatientDto } from './dto/create-patient.dto';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { Patient } from './entities/patient.entity';
import { PatientRoutine } from './entities/patient-routine.entity';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(Patient) private readonly patientRepository: Repository<Patient>,
    @InjectRepository(PatientRoutine) private readonly routineRepository: Repository<PatientRoutine>,
    private readonly dataSource: DataSource
  ) {}

  async createPatient(dto: CreatePatientDto): Promise<Patient> {
    return this.patientRepository.save(this.patientRepository.create(dto));
  }

  async addRoutine(patientId: string, dto: CreateRoutineDto): Promise<PatientRoutine> {
    validateRoutine(dto);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const patientRepository = manager.getRepository(Patient);
        const routineRepository = manager.getRepository(PatientRoutine);

        const patient = await patientRepository.findOne({ where: { id: patientId } });
        if (!patient) throw new NotFoundException('Paciente não encontrado.');

        await routineRepository.update(
          { patient: { id: patientId }, active: true },
          { active: false }
        );

        return routineRepository.save(
          routineRepository.create({
            ...dto,
            patient,
            active: true
          })
        );
      });
    } catch (error) {
      if (this.isSingleActiveRoutineUniqueViolation(error)) {
        throw new ConflictException('Já existe uma rotina ativa para este paciente. Tente novamente.');
      }

      throw error;
    }
  }

  async findById(id: string): Promise<Patient> {
    const patient = await this.patientRepository.findOne({ where: { id }, relations: ['routines'] });
    if (!patient) throw new NotFoundException('Paciente não encontrado.');
    return patient;
  }

  async getActiveRoutine(patientId: string): Promise<PatientRoutine> {
    const routines = await this.routineRepository.find({
      where: { patient: { id: patientId }, active: true },
      relations: ['patient'],
      order: { createdAt: 'DESC', id: 'DESC' }
    });

    if (routines.length === 0) {
      throw new NotFoundException('Rotina ativa do paciente não encontrada.');
    }

    if (routines.length > 1) {
      throw new ConflictException('Paciente com múltiplas rotinas ativas. Corrija a consistência da base.');
    }

    return routines[0];
  }

  async list(): Promise<Patient[]> {
    return this.patientRepository.find({ relations: ['routines'] });
  }

  private isSingleActiveRoutineUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: string; constraint?: string } | undefined;
    return (
      driverError?.code === '23505' &&
      driverError?.constraint === 'IDX_patient_routines_single_active'
    );
  }
}

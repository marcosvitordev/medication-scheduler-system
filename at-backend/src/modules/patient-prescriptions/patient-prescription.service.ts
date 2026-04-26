import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DoseUnit } from '../../common/enums/dose-unit.enum';
import { MonthlySpecialReference } from '../../common/enums/monthly-special-reference.enum';
import { OcularLaterality } from '../../common/enums/ocular-laterality.enum';
import { OticLaterality } from '../../common/enums/otic-laterality.enum';
import { PrnReason } from '../../common/enums/prn-reason.enum';
import { ClinicalCatalogService } from '../clinical-catalog/clinical-catalog.service';
import { PatientService } from '../patients/patient.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { TreatmentRecurrence } from '../../common/enums/treatment-recurrence.enum';
import { CreatePatientPrescriptionDto } from './dto/create-patient-prescription.dto';
import {
  AddPatientPrescriptionMedicationDto,
  AppendPrescriptionMedicationPhasesDto,
  UpdatePatientPrescriptionDto,
  UpdatePatientPrescriptionMedicationOperationDto,
  UpdatePatientPrescriptionPhaseDto,
  UpsertPatientPrescriptionPhaseDto,
} from './dto/update-patient-prescription.dto';
import {
  ClinicalInteractionRuleSnapshot,
  ClinicalMedicationSnapshot,
  ClinicalProtocolSnapshot,
  PrescriptionPhaseDoseOverride,
} from './entities/patient-prescription-snapshot.types';
import { PatientPrescriptionMedication } from './entities/patient-prescription-medication.entity';
import { PatientPrescriptionPhaseDose } from './entities/patient-prescription-phase-dose.entity';
import { PatientPrescriptionPhase } from './entities/patient-prescription-phase.entity';
import { PatientPrescription } from './entities/patient-prescription.entity';
import { getPhaseValidationError } from './validators/patient-prescription-phase.validator';

type PrescriptionMedicationPhaseDto = {
  phaseOrder: number;
  frequency: number;
  sameDosePerSchedule: boolean;
  recurrenceType: TreatmentRecurrence;
  treatmentDays?: number;
  continuousUse: boolean;
  weeklyDay?: string;
  monthlyRule?: string;
  monthlyDay?: number;
  monthlySpecialReference?: MonthlySpecialReference;
  monthlySpecialBaseDate?: string;
  monthlySpecialOffsetDays?: number;
  alternateDaysInterval?: number;
  prnReason?: PrnReason;
  ocularLaterality?: OcularLaterality;
  oticLaterality?: OticLaterality;
  glycemiaScaleRanges?: Array<{
    minimum: number;
    maximum: number;
    doseValue: string;
    doseUnit: DoseUnit;
  }>;
  manualAdjustmentEnabled: boolean;
  manualTimes?: string[];
  doseAmount?: string;
  doseValue?: string;
  doseUnit?: DoseUnit;
  perDoseOverrides?: Array<{
    doseLabel: string;
    doseValue: string;
    doseUnit: DoseUnit;
  }>;
  doseOverrides?: PatientPrescriptionPhaseDose[];
};

type MedicationDomainCapabilities = {
  id: string;
  isOphthalmic?: boolean;
  isOtic?: boolean;
  requiresGlycemiaScale?: boolean;
  isContraceptiveMonthly?: boolean;
  supportsManualAdjustment?: boolean;
};

type ClinicalMedicationCatalogEntry = Awaited<
  ReturnType<ClinicalCatalogService['findMedicationById']>
>;

@Injectable()
export class PatientPrescriptionService {
  constructor(
    @InjectRepository(PatientPrescription)
    private readonly prescriptionRepository: Repository<PatientPrescription>,
    private readonly dataSource: DataSource,
    private readonly patientService: PatientService,
    private readonly clinicalCatalogService: ClinicalCatalogService,
    private readonly schedulingService: SchedulingService,
  ) {}

  async create(dto: CreatePatientPrescriptionDto) {
    const patient = await this.patientService.findById(dto.patientId);

    return this.dataSource.transaction(async (manager) => {
      const prescriptionRepository = manager.getRepository(PatientPrescription);
      const prescriptionMedicationRepository = manager.getRepository(
        PatientPrescriptionMedication,
      );
      const phaseRepository = manager.getRepository(PatientPrescriptionPhase);
      const phaseDoseRepository = manager.getRepository(PatientPrescriptionPhaseDose);

      const medications = await Promise.all(
        dto.medications.map(async (medicationDto) => {
          const clinicalMedication = await this.clinicalCatalogService.findMedicationById(
            medicationDto.clinicalMedicationId,
          );
          const protocol = clinicalMedication.protocols.find(
            (item) => item.id === medicationDto.protocolId,
          );
          if (!protocol) {
            throw new NotFoundException(
              'Protocolo clínico não encontrado para o medicamento informado.',
            );
          }

          this.ensureSequentialPhaseOrders(medicationDto.phases);
          this.ensurePhaseStructureIsValid(medicationDto.phases);
          this.ensureMedicationSupportsPhaseDomainRules(
            this.toMedicationDomainCapabilitiesFromCatalog(clinicalMedication),
            medicationDto.phases,
          );
          this.ensureProtocolSupportsPhases(
            protocolSnapshotFromEntity(protocol),
            medicationDto.phases,
          );

          const medication = prescriptionMedicationRepository.create({
            sourceClinicalMedicationId: clinicalMedication.id,
            sourceProtocolId: protocol.id,
            medicationSnapshot: medicationSnapshotFromEntity(clinicalMedication),
            protocolSnapshot: protocolSnapshotFromEntity(protocol),
            interactionRulesSnapshot: interactionRulesSnapshotFromEntity(protocol),
            phases: medicationDto.phases.map((phaseDto) =>
              phaseRepository.create({
                ...phaseDto,
                doseAmount: phaseDto.doseAmount ?? phaseDto.doseValue ?? '1 unidade',
              }),
            ),
          });
          await this.syncPhaseDoseOverridesForPersistence(
            medication.phases,
            phaseDoseRepository,
          );

          return medication;
        }),
      );

      const prescription = await prescriptionRepository.save(
        prescriptionRepository.create({
          patient,
          startedAt: dto.startedAt,
          status: 'ACTIVE',
          medications,
        }),
      );

      const loaded = await prescriptionRepository.findOne({
        where: { id: prescription.id },
        relations: [
          'patient',
          'medications',
          'medications.phases',
        ],
      });

      if (!loaded) {
        throw new NotFoundException('Prescrição do paciente não encontrada.');
      }

      return this.schedulingService.buildAndPersistSchedule(loaded, manager);
    });
  }

  async appendPhases(
    prescriptionId: string,
    prescriptionMedicationId: string,
    dto: AppendPrescriptionMedicationPhasesDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const prescriptionRepository = manager.getRepository(PatientPrescription);
      const medicationRepository = manager.getRepository(PatientPrescriptionMedication);
      const phaseRepository = manager.getRepository(PatientPrescriptionPhase);
      const phaseDoseRepository = manager.getRepository(PatientPrescriptionPhaseDose);

      const prescription = await this.loadPrescriptionForMutation(
        prescriptionId,
        prescriptionRepository,
      );
      const medication = prescription.medications.find(
        (item) => item.id === prescriptionMedicationId,
      );
      if (!medication) {
        throw new UnprocessableEntityException(
          `Prescrição ${prescriptionId}: prescriptionMedicationId ${prescriptionMedicationId} não encontrado.`,
        );
      }

      const lastOrder = medication.phases.reduce(
        (highest, phase) => Math.max(highest, phase.phaseOrder),
        0,
      );
      const appendedPhases = dto.phases.map((phaseDto, index) =>
        phaseRepository.create({
          ...phaseDto,
          phaseOrder: lastOrder + index + 1,
          doseAmount: this.resolvePhaseDoseAmount(phaseDto),
        }),
      );

      const nextPhases = [...medication.phases, ...appendedPhases];
      this.ensurePhaseSetIsValidForMedication(medication, nextPhases);
      await this.syncPhaseDoseOverridesForPersistence(nextPhases, phaseDoseRepository);

      medication.phases = nextPhases;
      await medicationRepository.save(medication);

      const loaded = await this.reloadPrescriptionForScheduling(
        prescription.id,
        prescriptionRepository,
      );

      return this.schedulingService.buildAndPersistSchedule(loaded, manager);
    });
  }

  async updatePrescription(prescriptionId: string, dto: UpdatePatientPrescriptionDto) {
    return this.dataSource.transaction(async (manager) => {
      const prescriptionRepository = manager.getRepository(PatientPrescription);
      const medicationRepository = manager.getRepository(PatientPrescriptionMedication);
      const phaseRepository = manager.getRepository(PatientPrescriptionPhase);
      const phaseDoseRepository = manager.getRepository(PatientPrescriptionPhaseDose);

      const prescription = await this.loadPrescriptionForMutation(
        prescriptionId,
        prescriptionRepository,
      );
      this.ensureUpdatePayloadHasOperation(dto);
      if (dto.startedAt !== undefined) {
        prescription.startedAt = dto.startedAt;
      }

      const medicationById = new Map(
        prescription.medications.map((medication) => [medication.id, medication]),
      );
      const removeMedicationIds = new Set(dto.removeMedicationIds ?? []);

      this.ensureUniqueIds(
        dto.removeMedicationIds ?? [],
        `Prescrição ${prescriptionId}: removeMedicationIds contém valores duplicados.`,
      );
      this.ensureUniqueIds(
        (dto.updateMedications ?? []).map((item) => item.prescriptionMedicationId),
        `Prescrição ${prescriptionId}: updateMedications contém prescriptionMedicationId duplicado.`,
      );

      for (const removeMedicationId of removeMedicationIds) {
        if (!medicationById.has(removeMedicationId)) {
          throw new UnprocessableEntityException(
            `Prescrição ${prescriptionId}: prescriptionMedicationId ${removeMedicationId} não encontrado para remoção.`,
          );
        }
      }

      for (const medicationOperation of dto.updateMedications ?? []) {
        if (removeMedicationIds.has(medicationOperation.prescriptionMedicationId)) {
          throw new UnprocessableEntityException(
            `Prescrição ${prescriptionId}: prescriptionMedicationId ${medicationOperation.prescriptionMedicationId} não pode ser atualizado e removido na mesma operação.`,
          );
        }
        this.ensureMedicationUpdateOperationIsConsistent(medicationOperation, prescriptionId);
      }

      const medicationsToRemove = prescription.medications.filter((medication) =>
        removeMedicationIds.has(medication.id),
      );
      if (medicationsToRemove.length) {
        await medicationRepository.remove(medicationsToRemove);
      }

      prescription.medications = prescription.medications.filter(
        (medication) => !removeMedicationIds.has(medication.id),
      );
      for (const medication of medicationsToRemove) {
        medicationById.delete(medication.id);
      }

      for (const medicationOperation of dto.updateMedications ?? []) {
        const medication = medicationById.get(medicationOperation.prescriptionMedicationId);
        if (!medication) {
          throw new UnprocessableEntityException(
            `Prescrição ${prescriptionId}: prescriptionMedicationId ${medicationOperation.prescriptionMedicationId} não encontrado.`,
          );
        }

        await this.applyMedicationProtocolUpdateIfNeeded(medication, medicationOperation.protocolId);

        if (medicationOperation.replacePhases?.length) {
          if (medication.phases.length) {
            await phaseRepository.delete(medication.phases.map((phase) => phase.id));
          }

          const replacementPhases = this.buildPhaseEntitiesFromUpsert(
            medicationOperation.replacePhases,
            phaseRepository,
          );
          this.assignSequentialPhaseOrders(replacementPhases);
          this.applyDefaultDoseAmount(replacementPhases);
          this.ensurePhaseSetIsValidForMedication(medication, replacementPhases);
          await this.syncPhaseDoseOverridesForPersistence(
            replacementPhases,
            phaseDoseRepository,
          );
          medication.phases = replacementPhases;
          continue;
        }

        this.ensureUniqueIds(
          medicationOperation.removePhaseIds ?? [],
          `Prescrição ${prescriptionId}: removePhaseIds contém valores duplicados no medicamento ${medication.id}.`,
        );
        this.ensureUniqueIds(
          (medicationOperation.updatePhases ?? []).map((phase) => phase.phaseId),
          `Prescrição ${prescriptionId}: updatePhases contém phaseId duplicado no medicamento ${medication.id}.`,
        );

        let phases = [...medication.phases];
        const removePhaseIds = new Set(medicationOperation.removePhaseIds ?? []);
        for (const removePhaseId of removePhaseIds) {
          if (!phases.some((phase) => phase.id === removePhaseId)) {
            throw new UnprocessableEntityException(
              `Prescrição ${prescriptionId}: phaseId ${removePhaseId} não encontrado no medicamento ${medication.id}.`,
            );
          }
        }

        if (removePhaseIds.size) {
          await phaseRepository.delete([...removePhaseIds]);
          phases = phases.filter((phase) => !removePhaseIds.has(phase.id));
        }

        for (const phaseUpdate of medicationOperation.updatePhases ?? []) {
          const phase = phases.find((item) => item.id === phaseUpdate.phaseId);
          if (!phase) {
            throw new UnprocessableEntityException(
              `Prescrição ${prescriptionId}: phaseId ${phaseUpdate.phaseId} não encontrado no medicamento ${medication.id}.`,
            );
          }
          this.applyPhasePatch(phase, phaseUpdate);
        }

        if (!phases.length) {
          throw new UnprocessableEntityException(
            `Prescrição ${prescriptionId}: o medicamento ${medication.id} deve manter ao menos uma fase terapêutica.`,
          );
        }

        this.assignSequentialPhaseOrders(phases);
        this.applyDefaultDoseAmount(phases);
        this.ensurePhaseSetIsValidForMedication(medication, phases);
        await this.syncPhaseDoseOverridesForPersistence(phases, phaseDoseRepository);
        medication.phases = phases;
      }

      if (dto.addMedications?.length) {
        for (const addMedicationDto of dto.addMedications) {
          const newMedication = await this.buildMedicationFromAddDto(
            addMedicationDto,
            medicationRepository,
            phaseRepository,
            phaseDoseRepository,
          );
          prescription.medications.push(newMedication);
        }
      }

      this.ensureNoDuplicateMedicationProtocolPairs(prescription.medications, prescriptionId);

      await prescriptionRepository.save(prescription);
      const loaded = await this.reloadPrescriptionForScheduling(
        prescription.id,
        prescriptionRepository,
      );

      return this.schedulingService.buildAndPersistSchedule(loaded, manager);
    });
  }

  async list(): Promise<PatientPrescription[]> {
    const prescriptions = await this.prescriptionRepository.find({
      relations: ['patient', 'medications', 'medications.phases'],
    });
    return prescriptions.map((prescription) => this.hydratePrescriptionReadModel(prescription));
  }

  async findById(id: string): Promise<PatientPrescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
      relations: ['patient', 'medications', 'medications.phases'],
    });
    if (!prescription) {
      throw new NotFoundException('Prescrição do paciente não encontrada.');
    }
    return this.hydratePrescriptionReadModel(prescription);
  }

  private async loadPrescriptionForMutation(
    prescriptionId: string,
    prescriptionRepository: Repository<PatientPrescription>,
  ): Promise<PatientPrescription> {
    const prescription = await prescriptionRepository.findOne({
      where: { id: prescriptionId },
      relations: ['patient', 'medications', 'medications.phases'],
    });
    if (!prescription) {
      throw new NotFoundException('Prescrição do paciente não encontrada.');
    }
    return prescription;
  }

  private async reloadPrescriptionForScheduling(
    prescriptionId: string,
    prescriptionRepository: Repository<PatientPrescription>,
  ): Promise<PatientPrescription> {
    const loaded = await prescriptionRepository.findOne({
      where: { id: prescriptionId },
      relations: ['patient', 'medications', 'medications.phases'],
    });
    if (!loaded) {
      throw new NotFoundException('Prescrição do paciente não encontrada.');
    }
    return loaded;
  }

  private ensureUpdatePayloadHasOperation(dto: UpdatePatientPrescriptionDto): void {
    if (
      dto.startedAt === undefined &&
      !dto.addMedications?.length &&
      !dto.updateMedications?.length &&
      !dto.removeMedicationIds?.length
    ) {
      throw new UnprocessableEntityException(
        'Informe ao menos uma operação: startedAt, addMedications, updateMedications ou removeMedicationIds.',
      );
    }
  }

  private ensureMedicationUpdateOperationIsConsistent(
    medicationOperation: UpdatePatientPrescriptionMedicationOperationDto,
    prescriptionId: string,
  ): void {
    if (
      !medicationOperation.protocolId &&
      !medicationOperation.replacePhases?.length &&
      !medicationOperation.updatePhases?.length &&
      !medicationOperation.removePhaseIds?.length
    ) {
      throw new UnprocessableEntityException(
        `Prescrição ${prescriptionId}: o medicamento ${medicationOperation.prescriptionMedicationId} deve informar protocolId, replacePhases, updatePhases ou removePhaseIds.`,
      );
    }

    if (
      medicationOperation.replacePhases?.length &&
      (medicationOperation.updatePhases?.length || medicationOperation.removePhaseIds?.length)
    ) {
      throw new UnprocessableEntityException(
        `Prescrição ${prescriptionId}: o medicamento ${medicationOperation.prescriptionMedicationId} não pode combinar replacePhases com updatePhases/removePhaseIds.`,
      );
    }
  }

  private ensureUniqueIds(ids: string[], duplicatedMessage: string): void {
    if (new Set(ids).size !== ids.length) {
      throw new UnprocessableEntityException(duplicatedMessage);
    }
  }

  private buildPhaseEntitiesFromUpsert(
    phases: UpsertPatientPrescriptionPhaseDto[],
    phaseRepository: Repository<PatientPrescriptionPhase>,
  ): PatientPrescriptionPhase[] {
    return phases.map((phase) =>
      phaseRepository.create({
        ...phase,
        phaseOrder: 1,
        doseAmount: this.resolvePhaseDoseAmount(phase),
      }),
    );
  }

  private async syncPhaseDoseOverridesForPersistence(
    phases: PrescriptionMedicationPhaseDto[],
    phaseDoseRepository: Repository<PatientPrescriptionPhaseDose>,
  ): Promise<void> {
    for (const phase of phases) {
      const previousDoseOverrides = phase.doseOverrides ?? [];
      const requestedOverrides = phase.sameDosePerSchedule
        ? []
        : (phase.perDoseOverrides ?? []);
      const requestedLabels = new Set(requestedOverrides.map((override) => override.doseLabel));
      const removableIds = previousDoseOverrides
        .filter(
          (doseOverride) =>
            Boolean(doseOverride.id) && !requestedLabels.has(doseOverride.doseLabel),
        )
        .map((doseOverride) => doseOverride.id);

      if (removableIds.length > 0) {
        await phaseDoseRepository.delete(removableIds);
      }

      const previousDoseOverrideByLabel = new Map(
        previousDoseOverrides.map((doseOverride) => [doseOverride.doseLabel, doseOverride]),
      );

      phase.doseOverrides = requestedOverrides.map((override) =>
        phaseDoseRepository.create({
          id: previousDoseOverrideByLabel.get(override.doseLabel)?.id,
          phase: phase as PatientPrescriptionPhase,
          doseLabel: override.doseLabel,
          doseValue: override.doseValue,
          doseUnit: override.doseUnit,
        }),
      );
      phase.perDoseOverrides = requestedOverrides.length > 0 ? requestedOverrides : undefined;
    }
  }

  private applyDefaultDoseAmount(phases: PrescriptionMedicationPhaseDto[]): void {
    phases.forEach((phase) => {
      phase.doseAmount = this.resolvePhaseDoseAmount(phase);
    });
  }

  private resolvePhaseDoseAmount(
    phase:
      | Pick<PrescriptionMedicationPhaseDto, 'doseAmount' | 'doseValue'>
      | UpsertPatientPrescriptionPhaseDto,
  ): string {
    return phase.doseAmount ?? phase.doseValue ?? '1 unidade';
  }

  private applyPhasePatch(
    phase: PatientPrescriptionPhase,
    phaseUpdate: UpdatePatientPrescriptionPhaseDto,
  ): void {
    const patchEntries = Object.entries(phaseUpdate).filter(
      ([key, value]) => key !== 'phaseId' && value !== undefined,
    );

    patchEntries.forEach(([key, value]) => {
      (phase as unknown as Record<string, unknown>)[key] = value;
    });
  }

  private ensurePhaseStructureIsValid(phases: PrescriptionMedicationPhaseDto[]): void {
    phases.forEach((phase) => {
      const phaseValidationError = getPhaseValidationError(phase);
      if (phaseValidationError) {
        throw new UnprocessableEntityException(
          `Fase ${phase.phaseOrder}: ${phaseValidationError}`,
        );
      }
    });
  }

  private assignSequentialPhaseOrders(phases: PrescriptionMedicationPhaseDto[]): void {
    [...phases]
      .sort((left, right) => left.phaseOrder - right.phaseOrder)
      .forEach((phase, index) => {
        phase.phaseOrder = index + 1;
      });
  }

  private ensurePhaseSetIsValidForMedication(
    medication: Pick<
      PatientPrescriptionMedication,
      'sourceClinicalMedicationId' | 'medicationSnapshot' | 'protocolSnapshot'
    >,
    phases: PrescriptionMedicationPhaseDto[],
  ): void {
    this.ensureSequentialPhaseOrders(phases);
    this.ensurePhaseStructureIsValid(phases);
    this.ensureMedicationSupportsPhaseDomainRules(
      this.toMedicationDomainCapabilitiesFromSnapshot(
        medication.sourceClinicalMedicationId,
        medication.medicationSnapshot,
      ),
      phases,
    );
    this.ensureProtocolSupportsPhases(medication.protocolSnapshot, phases);
  }

  private toMedicationDomainCapabilitiesFromCatalog(
    medication: ClinicalMedicationCatalogEntry,
  ): MedicationDomainCapabilities {
    return {
      id: medication.id,
      isOphthalmic: medication.isOphthalmic,
      isOtic: medication.isOtic,
      requiresGlycemiaScale: medication.requiresGlycemiaScale,
      isContraceptiveMonthly: medication.isContraceptiveMonthly,
      supportsManualAdjustment: medication.supportsManualAdjustment,
    };
  }

  private toMedicationDomainCapabilitiesFromSnapshot(
    sourceClinicalMedicationId: string,
    snapshot: ClinicalMedicationSnapshot,
  ): MedicationDomainCapabilities {
    return {
      id: sourceClinicalMedicationId,
      isOphthalmic: snapshot.isOphthalmic,
      isOtic: snapshot.isOtic,
      requiresGlycemiaScale: snapshot.requiresGlycemiaScale,
      isContraceptiveMonthly: snapshot.isContraceptiveMonthly,
      supportsManualAdjustment: snapshot.supportsManualAdjustment,
    };
  }

  private async applyMedicationProtocolUpdateIfNeeded(
    medication: PatientPrescriptionMedication,
    protocolId?: string,
  ): Promise<void> {
    if (!protocolId || protocolId === medication.sourceProtocolId) {
      return;
    }

    const clinicalMedication = await this.clinicalCatalogService.findMedicationById(
      medication.sourceClinicalMedicationId,
    );
    const protocol = clinicalMedication.protocols.find((item) => item.id === protocolId);
    if (!protocol) {
      throw new NotFoundException(
        'Protocolo clínico não encontrado para o medicamento informado.',
      );
    }

    medication.sourceProtocolId = protocol.id;
    medication.protocolSnapshot = protocolSnapshotFromEntity(protocol);
    medication.interactionRulesSnapshot = interactionRulesSnapshotFromEntity(protocol);
  }

  private async buildMedicationFromAddDto(
    medicationDto: AddPatientPrescriptionMedicationDto,
    medicationRepository: Repository<PatientPrescriptionMedication>,
    phaseRepository: Repository<PatientPrescriptionPhase>,
    phaseDoseRepository: Repository<PatientPrescriptionPhaseDose>,
  ): Promise<PatientPrescriptionMedication> {
    const clinicalMedication = await this.clinicalCatalogService.findMedicationById(
      medicationDto.clinicalMedicationId,
    );
    const protocol = clinicalMedication.protocols.find(
      (item) => item.id === medicationDto.protocolId,
    );
    if (!protocol) {
      throw new NotFoundException(
        'Protocolo clínico não encontrado para o medicamento informado.',
      );
    }

    const phases = this.buildPhaseEntitiesFromUpsert(medicationDto.phases, phaseRepository);
    this.assignSequentialPhaseOrders(phases);
    this.applyDefaultDoseAmount(phases);
    this.ensurePhaseStructureIsValid(phases);
    this.ensureMedicationSupportsPhaseDomainRules(
      this.toMedicationDomainCapabilitiesFromCatalog(clinicalMedication),
      phases,
    );
    this.ensureProtocolSupportsPhases(protocolSnapshotFromEntity(protocol), phases);
    await this.syncPhaseDoseOverridesForPersistence(phases, phaseDoseRepository);

    return medicationRepository.create({
      sourceClinicalMedicationId: clinicalMedication.id,
      sourceProtocolId: protocol.id,
      medicationSnapshot: medicationSnapshotFromEntity(clinicalMedication),
      protocolSnapshot: protocolSnapshotFromEntity(protocol),
      interactionRulesSnapshot: interactionRulesSnapshotFromEntity(protocol),
      phases,
    });
  }

  private hydratePrescriptionReadModel(prescription: PatientPrescription): PatientPrescription {
    prescription.medications.forEach((medication) => {
      medication.phases.forEach((phase) => {
        phase.perDoseOverrides = phase.perDoseOverrides;
      });
    });
    return prescription;
  }

  private ensureNoDuplicateMedicationProtocolPairs(
    medications: Array<
      Pick<PatientPrescriptionMedication, 'sourceClinicalMedicationId' | 'sourceProtocolId'>
    >,
    prescriptionId: string,
  ): void {
    const seenPairs = new Set<string>();
    for (const medication of medications) {
      const pairKey = `${medication.sourceClinicalMedicationId}:${medication.sourceProtocolId}`;
      if (seenPairs.has(pairKey)) {
        throw new UnprocessableEntityException(
          `Prescrição ${prescriptionId}: combinação clinicalMedicationId + protocolId duplicada (${pairKey}).`,
        );
      }
      seenPairs.add(pairKey);
    }
  }

  private ensureProtocolSupportsPhases(
    protocolSnapshot: ClinicalProtocolSnapshot,
    phases: PrescriptionMedicationPhaseDto[],
  ): void {
    phases.forEach((phase) => {
      const supportedFrequency = protocolSnapshot.frequencies.find(
        (item) => item.frequency === phase.frequency,
      );
      if (!supportedFrequency) {
        throw new UnprocessableEntityException(
          `Fase ${phase.phaseOrder}: frequency=${phase.frequency} não é suportada pelo protocolo ${protocolSnapshot.code}.`,
        );
      }

      this.ensurePhaseMatchesFrequencyRules(protocolSnapshot, supportedFrequency, phase);
    });
  }

  private ensurePhaseMatchesFrequencyRules(
    protocolSnapshot: ClinicalProtocolSnapshot,
    frequencySnapshot: ClinicalProtocolSnapshot['frequencies'][number],
    phase: PrescriptionMedicationPhaseDto,
  ): void {
    const allowedRecurrenceTypes = frequencySnapshot.allowedRecurrenceTypes?.length
      ? frequencySnapshot.allowedRecurrenceTypes
      : [TreatmentRecurrence.DAILY];

    if (
      !allowedRecurrenceTypes.includes(phase.recurrenceType)
    ) {
      throw new UnprocessableEntityException(
        `Fase ${phase.phaseOrder}: recurrenceType=${phase.recurrenceType} não é permitido no protocolo ${protocolSnapshot.code} para frequency=${phase.frequency}.`,
      );
    }

    if (
      phase.recurrenceType === TreatmentRecurrence.PRN &&
      frequencySnapshot.allowsPrn !== true
    ) {
      throw new UnprocessableEntityException(
        `Fase ${phase.phaseOrder}: recurrenceType=PRN não é permitido no protocolo ${protocolSnapshot.code} para frequency=${phase.frequency}.`,
      );
    }

    if (
      phase.sameDosePerSchedule === false &&
      frequencySnapshot.allowsVariableDoseBySchedule === false
    ) {
      throw new UnprocessableEntityException(
        `Fase ${phase.phaseOrder}: sameDosePerSchedule=false não é permitido no protocolo ${protocolSnapshot.code} para frequency=${phase.frequency}.`,
      );
    }
  }

  private ensureSequentialPhaseOrders(
    phases: Array<Pick<PrescriptionMedicationPhaseDto, 'phaseOrder'>>,
  ): void {
    const sortedOrders = [...phases].map((phase) => phase.phaseOrder).sort((a, b) => a - b);
    const expectedOrders = Array.from({ length: sortedOrders.length }, (_, index) => index + 1);
    const isSequential = sortedOrders.every((order, index) => order === expectedOrders[index]);
    if (!isSequential) {
      throw new UnprocessableEntityException(
        'As fases terapêuticas devem usar phaseOrder sequencial, sem lacunas nem repetição.',
      );
    }
  }

  private ensureMedicationSupportsPhaseDomainRules(
    medication: MedicationDomainCapabilities,
    phases: PrescriptionMedicationPhaseDto[],
  ): void {
    const isOphthalmic = Boolean(medication.isOphthalmic);
    const isOtic = Boolean(medication.isOtic);
    const requiresGlycemiaScale = Boolean(medication.requiresGlycemiaScale);
    const isContraceptiveMonthly = Boolean(medication.isContraceptiveMonthly);

    if (isOphthalmic && isOtic) {
      this.throwMedicationDomainError(
        medication.id,
        'é ambíguo para lateralidade',
        'isOphthalmic=true e isOtic=true',
      );
    }

    phases.forEach((phase) => {
      this.ensureLateralityCompatibilityForPhase(medication.id, phase, isOphthalmic, isOtic);
      this.ensureGlycemiaScaleCompatibilityForPhase(medication.id, phase, requiresGlycemiaScale);
      this.ensureContraceptiveMonthlyCompatibilityForPhase(
        medication.id,
        phase,
        isContraceptiveMonthly,
      );
      this.ensureManualAdjustmentCompatibilityForPhase(medication.id, phase);
    });
  }

  private ensureLateralityCompatibilityForPhase(
    medicationId: string,
    phase: PrescriptionMedicationPhaseDto,
    isOphthalmic: boolean,
    isOtic: boolean,
  ): void {
    if (isOphthalmic) {
      if (!phase.ocularLaterality) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'ocularLaterality',
          'é obrigatório',
          'isOphthalmic=true',
        );
      }
      if (phase.oticLaterality) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'oticLaterality',
          'é inválido',
          'isOphthalmic=true',
        );
      }
      return;
    }

    if (isOtic) {
      if (!phase.oticLaterality) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'oticLaterality',
          'é obrigatório',
          'isOtic=true',
        );
      }
      if (phase.ocularLaterality) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'ocularLaterality',
          'é inválido',
          'isOtic=true',
        );
      }
      return;
    }

    if (phase.ocularLaterality || phase.oticLaterality) {
      this.throwPhaseDomainError(
        medicationId,
        phase.phaseOrder,
        'lateralidade',
        'é inválida',
        'isOphthalmic=false e isOtic=false',
      );
    }
  }

  private ensureGlycemiaScaleCompatibilityForPhase(
    medicationId: string,
    phase: PrescriptionMedicationPhaseDto,
    requiresGlycemiaScale: boolean,
  ): void {
    const ranges = phase.glycemiaScaleRanges;
    if (requiresGlycemiaScale) {
      if (!ranges?.length) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'glycemiaScaleRanges',
          'é obrigatório',
          'requiresGlycemiaScale=true',
        );
      }
      this.ensureValidGlycemiaScaleRanges(
        medicationId,
        phase.phaseOrder,
        ranges,
      );
      return;
    }

    if (ranges?.length) {
      this.throwPhaseDomainError(
        medicationId,
        phase.phaseOrder,
        'glycemiaScaleRanges',
        'é inválido',
        'requiresGlycemiaScale=false',
      );
    }
  }

  private ensureValidGlycemiaScaleRanges(
    medicationId: string,
    phaseOrder: number,
    ranges: NonNullable<PrescriptionMedicationPhaseDto['glycemiaScaleRanges']>,
  ): void {
    const sortedRanges = [...ranges].sort((a, b) => a.minimum - b.minimum);

    sortedRanges.forEach((range, index) => {
      if (range.maximum < range.minimum) {
        throw new UnprocessableEntityException(
          `Fase ${phaseOrder}: glycemiaScaleRanges é inválido para medicamento ${medicationId} (maximum < minimum).`,
        );
      }

      if (index === 0) {
        return;
      }

      const previousRange = sortedRanges[index - 1];
      if (range.minimum <= previousRange.maximum) {
        throw new UnprocessableEntityException(
          `Fase ${phaseOrder}: glycemiaScaleRanges é inválido para medicamento ${medicationId} (faixas com sobreposição).`,
        );
      }

      if (range.minimum !== previousRange.maximum + 1) {
        throw new UnprocessableEntityException(
          `Fase ${phaseOrder}: glycemiaScaleRanges é inválido para medicamento ${medicationId} (faixas com lacuna).`,
        );
      }
    });
  }

  private ensureContraceptiveMonthlyCompatibilityForPhase(
    medicationId: string,
    phase: PrescriptionMedicationPhaseDto,
    isContraceptiveMonthly: boolean,
  ): void {
    const hasMonthlySpecialFields =
      isPresent(phase.monthlySpecialReference) ||
      isPresent(phase.monthlySpecialBaseDate) ||
      isPresent(phase.monthlySpecialOffsetDays);

    if (isContraceptiveMonthly) {
      if (phase.recurrenceType !== TreatmentRecurrence.MONTHLY) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'recurrenceType',
          `=${phase.recurrenceType} é inválido`,
          'isContraceptiveMonthly=true exige MONTHLY',
        );
      }
      if (
        !isPresent(phase.monthlySpecialReference) ||
        !isPresent(phase.monthlySpecialBaseDate) ||
        !isPresent(phase.monthlySpecialOffsetDays)
      ) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'monthlySpecialReference/monthlySpecialBaseDate/monthlySpecialOffsetDays',
          'são obrigatórios',
          'isContraceptiveMonthly=true',
        );
      }
      if (phase.monthlySpecialReference !== MonthlySpecialReference.MENSTRUATION_START) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'monthlySpecialReference',
          `=${phase.monthlySpecialReference} é inválido`,
          'isContraceptiveMonthly=true exige MENSTRUATION_START',
        );
      }
      if (phase.monthlySpecialOffsetDays <= 0) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'monthlySpecialOffsetDays',
          `=${phase.monthlySpecialOffsetDays} é inválido`,
          'isContraceptiveMonthly=true exige valor > 0',
        );
      }
      if (isPresent(phase.monthlyDay)) {
        this.throwPhaseDomainError(
          medicationId,
          phase.phaseOrder,
          'monthlyDay',
          'é inválido',
          'isContraceptiveMonthly=true',
        );
      }
      return;
    }

    if (hasMonthlySpecialFields) {
      this.throwPhaseDomainError(
        medicationId,
        phase.phaseOrder,
        'monthlySpecial*',
        'é inválido',
        'isContraceptiveMonthly=false',
      );
    }
  }

  private ensureManualAdjustmentCompatibilityForPhase(
    medicationId: string,
    phase: PrescriptionMedicationPhaseDto,
  ): void {
    if (!phase.manualAdjustmentEnabled && phase.manualTimes !== undefined) {
      this.throwPhaseDomainError(
        medicationId,
        phase.phaseOrder,
        'manualTimes',
        'é inválido quando manualAdjustmentEnabled=false',
      );
    }
  }

  private throwMedicationDomainError(
    medicationId: string,
    message: string,
    capability?: string,
  ): never {
    const capabilitySuffix = capability ? ` (${capability}).` : '.';
    throw new UnprocessableEntityException(
      `Medicamento ${medicationId}: ${message}${capabilitySuffix}`,
    );
  }

  private throwPhaseDomainError(
    medicationId: string,
    phaseOrder: number,
    field: string,
    message: string,
    capability?: string,
  ): never {
    const capabilitySuffix = capability ? ` (${capability}).` : '.';
    throw new UnprocessableEntityException(
      `Fase ${phaseOrder}: ${field} ${message} para medicamento ${medicationId}${capabilitySuffix}`,
    );
  }
}

function isPresent<T>(value: T | null | undefined): value is NonNullable<T> {
  return value !== undefined && value !== null;
}

function medicationSnapshotFromEntity(
  medication: Awaited<ReturnType<ClinicalCatalogService['findMedicationById']>>,
): ClinicalMedicationSnapshot {
  return {
    id: medication.id,
    commercialName: medication.commercialName,
    activePrinciple: medication.activePrinciple,
    presentation: medication.presentation,
    pharmaceuticalForm: medication.pharmaceuticalForm,
    administrationRoute: medication.administrationRoute,
    usageInstructions: medication.usageInstructions,
    diluentType: medication.diluentType,
    defaultAdministrationUnit: medication.defaultAdministrationUnit,
    supportsManualAdjustment: medication.supportsManualAdjustment,
    isOphthalmic: medication.isOphthalmic,
    isOtic: medication.isOtic,
    isContraceptiveMonthly: medication.isContraceptiveMonthly,
    requiresGlycemiaScale: medication.requiresGlycemiaScale,
    notes: medication.notes,
  };
}

function protocolSnapshotFromEntity(
  protocol: Awaited<ReturnType<ClinicalCatalogService['findMedicationById']>>['protocols'][number],
): ClinicalProtocolSnapshot {
  return {
    id: protocol.id,
    code: protocol.code,
    name: protocol.name,
    description: protocol.description,
    groupCode: protocol.group.code,
    subgroupCode: protocol.subgroupCode,
    priority: protocol.priority,
    isDefault: protocol.isDefault,
    active: protocol.active,
    clinicalNotes: protocol.clinicalNotes,
    frequencies: protocol.frequencies.map((frequency) => ({
      frequency: frequency.frequency,
      label: frequency.label,
      allowedRecurrenceTypes: frequency.allowedRecurrenceTypes,
      allowsPrn: frequency.allowsPrn,
      allowsVariableDoseBySchedule: frequency.allowsVariableDoseBySchedule,
      steps: frequency.steps.map((step) => ({
        doseLabel: step.doseLabel,
        anchor: step.anchor,
        offsetMinutes: step.offsetMinutes,
        semanticTag: step.semanticTag,
      })),
    })),
  };
}

function interactionRulesSnapshotFromEntity(
  protocol: Awaited<ReturnType<ClinicalCatalogService['findMedicationById']>>['protocols'][number],
): ClinicalInteractionRuleSnapshot[] {
  return protocol.interactionRules.map((rule) => ({
    interactionType: rule.interactionType,
    targetGroupCode: rule.targetGroupCode,
    targetProtocolCode: rule.targetProtocolCode,
    resolutionType: rule.resolutionType,
    windowMinutes: rule.windowMinutes,
    windowBeforeMinutes: rule.windowBeforeMinutes ?? rule.windowMinutes,
    windowAfterMinutes: rule.windowAfterMinutes ?? rule.windowMinutes,
    applicableSemanticTags: rule.applicableSemanticTags,
    priority: rule.priority,
  }));
}

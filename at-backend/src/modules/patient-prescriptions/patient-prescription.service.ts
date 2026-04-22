import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ClinicalCatalogService } from '../clinical-catalog/clinical-catalog.service';
import { PatientService } from '../patients/patient.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { TreatmentRecurrence } from '../../common/enums/treatment-recurrence.enum';
import { CreatePatientPrescriptionDto } from './dto/create-patient-prescription.dto';
import {
  ClinicalInteractionRuleSnapshot,
  ClinicalMedicationSnapshot,
  ClinicalProtocolSnapshot,
} from './entities/patient-prescription-snapshot.types';
import { PatientPrescriptionMedication } from './entities/patient-prescription-medication.entity';
import { PatientPrescriptionPhase } from './entities/patient-prescription-phase.entity';
import { PatientPrescription } from './entities/patient-prescription.entity';

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
          this.ensureLateralityCompatibility(clinicalMedication, medicationDto.phases);
          this.ensureGlycemiaScaleCompatibility(clinicalMedication, medicationDto.phases);
          this.ensureContraceptiveMonthlyCompatibility(clinicalMedication, medicationDto.phases);
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

  async list(): Promise<PatientPrescription[]> {
    return this.prescriptionRepository.find({
      relations: ['patient', 'medications', 'medications.phases'],
    });
  }

  async findById(id: string): Promise<PatientPrescription> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
      relations: ['patient', 'medications', 'medications.phases'],
    });
    if (!prescription) {
      throw new NotFoundException('Prescrição do paciente não encontrada.');
    }
    return prescription;
  }

  private ensureProtocolSupportsPhases(
    protocolSnapshot: ClinicalProtocolSnapshot,
    phases: CreatePatientPrescriptionDto['medications'][number]['phases'],
  ): void {
    phases.forEach((phase) => {
      const supportedFrequency = protocolSnapshot.frequencies.find(
        (item) => item.frequency === phase.frequency,
      );
      if (!supportedFrequency) {
        throw new UnprocessableEntityException(
          `Protocolo ${protocolSnapshot.code} não suporta frequência ${phase.frequency}.`,
        );
      }

      this.ensurePhaseMatchesFrequencyRules(protocolSnapshot, supportedFrequency, phase);
    });
  }

  private ensurePhaseMatchesFrequencyRules(
    protocolSnapshot: ClinicalProtocolSnapshot,
    frequencySnapshot: ClinicalProtocolSnapshot['frequencies'][number],
    phase: CreatePatientPrescriptionDto['medications'][number]['phases'][number],
  ): void {
    if (
      frequencySnapshot.allowedRecurrenceTypes?.length &&
      !frequencySnapshot.allowedRecurrenceTypes.includes(phase.recurrenceType)
    ) {
      throw new UnprocessableEntityException(
        `Protocolo ${protocolSnapshot.code} na frequência ${phase.frequency} não permite recorrência ${phase.recurrenceType}.`,
      );
    }

    if (
      phase.recurrenceType === TreatmentRecurrence.PRN &&
      frequencySnapshot.allowsPrn === false
    ) {
      throw new UnprocessableEntityException(
        `Protocolo ${protocolSnapshot.code} na frequência ${phase.frequency} não permite prescrição sob demanda (PRN).`,
      );
    }

    if (
      phase.sameDosePerSchedule === false &&
      frequencySnapshot.allowsVariableDoseBySchedule === false
    ) {
      throw new UnprocessableEntityException(
        `Protocolo ${protocolSnapshot.code} na frequência ${phase.frequency} não permite dose variável por horário.`,
      );
    }
  }

  private ensureSequentialPhaseOrders(
    phases: CreatePatientPrescriptionDto['medications'][number]['phases'],
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

  private ensureLateralityCompatibility(
    medication: Awaited<ReturnType<ClinicalCatalogService['findMedicationById']>>,
    phases: CreatePatientPrescriptionDto['medications'][number]['phases'],
  ): void {
    const isOphthalmic = Boolean(medication.isOphthalmic);
    const isOtic = Boolean(medication.isOtic);

    if (isOphthalmic && isOtic) {
      throw new UnprocessableEntityException(
        `Medicamento ${medication.id} está ambíguo: não pode ser oftálmico e otológico ao mesmo tempo para prescrição com lateralidade.`,
      );
    }

    phases.forEach((phase) => {
      if (isOphthalmic) {
        if (!phase.ocularLaterality) {
          throw new UnprocessableEntityException(
            `Medicamento ${medication.id} exige ocularLaterality para fase ${phase.phaseOrder}.`,
          );
        }
        if (phase.oticLaterality) {
          throw new UnprocessableEntityException(
            `Medicamento ${medication.id} oftálmico não aceita oticLaterality na fase ${phase.phaseOrder}.`,
          );
        }
        return;
      }

      if (isOtic) {
        if (!phase.oticLaterality) {
          throw new UnprocessableEntityException(
            `Medicamento ${medication.id} exige oticLaterality para fase ${phase.phaseOrder}.`,
          );
        }
        if (phase.ocularLaterality) {
          throw new UnprocessableEntityException(
            `Medicamento ${medication.id} otológico não aceita ocularLaterality na fase ${phase.phaseOrder}.`,
          );
        }
        return;
      }

      if (phase.ocularLaterality || phase.oticLaterality) {
        throw new UnprocessableEntityException(
          `Medicamento ${medication.id} não é ocular/otológico e não aceita lateralidade na fase ${phase.phaseOrder}.`,
        );
      }
    });
  }

  private ensureGlycemiaScaleCompatibility(
    medication: Awaited<ReturnType<ClinicalCatalogService['findMedicationById']>>,
    phases: CreatePatientPrescriptionDto['medications'][number]['phases'],
  ): void {
    const requiresGlycemiaScale = Boolean(medication.requiresGlycemiaScale);

    phases.forEach((phase) => {
      const ranges = phase.glycemiaScaleRanges;
      if (requiresGlycemiaScale) {
        if (!ranges?.length) {
          throw new UnprocessableEntityException(
            `Medicamento ${medication.id} exige glycemiaScaleRanges na fase ${phase.phaseOrder}.`,
          );
        }
        this.ensureValidGlycemiaScaleRanges(
          medication.id,
          phase.phaseOrder,
          ranges,
        );
        return;
      }

      if (ranges?.length) {
        throw new UnprocessableEntityException(
          `Medicamento ${medication.id} não aceita glycemiaScaleRanges na fase ${phase.phaseOrder}.`,
        );
      }
    });
  }

  private ensureValidGlycemiaScaleRanges(
    medicationId: string,
    phaseOrder: number,
    ranges: NonNullable<
      CreatePatientPrescriptionDto['medications'][number]['phases'][number]['glycemiaScaleRanges']
    >,
  ): void {
    const sortedRanges = [...ranges].sort((a, b) => a.minimum - b.minimum);

    sortedRanges.forEach((range, index) => {
      if (range.maximum < range.minimum) {
        throw new UnprocessableEntityException(
          `glycemiaScaleRanges inválida no medicamento ${medicationId} fase ${phaseOrder}: maximum menor que minimum.`,
        );
      }

      if (index === 0) {
        return;
      }

      const previousRange = sortedRanges[index - 1];
      if (range.minimum <= previousRange.maximum) {
        throw new UnprocessableEntityException(
          `glycemiaScaleRanges inválida no medicamento ${medicationId} fase ${phaseOrder}: faixas com sobreposição.`,
        );
      }

      if (range.minimum !== previousRange.maximum + 1) {
        throw new UnprocessableEntityException(
          `glycemiaScaleRanges inválida no medicamento ${medicationId} fase ${phaseOrder}: faixas com lacuna.`,
        );
      }
    });
  }

  private ensureContraceptiveMonthlyCompatibility(
    medication: Awaited<ReturnType<ClinicalCatalogService['findMedicationById']>>,
    phases: CreatePatientPrescriptionDto['medications'][number]['phases'],
  ): void {
    const isContraceptiveMonthly = Boolean(medication.isContraceptiveMonthly);

    phases.forEach((phase) => {
      const hasMonthlySpecialFields =
        Boolean(phase.monthlySpecialReference) ||
        Boolean(phase.monthlySpecialBaseDate) ||
        phase.monthlySpecialOffsetDays !== undefined;

      if (isContraceptiveMonthly) {
        if (phase.recurrenceType !== TreatmentRecurrence.MONTHLY) {
          throw new UnprocessableEntityException(
            `Medicamento ${medication.id} exige recorrência MONTHLY na fase ${phase.phaseOrder}.`,
          );
        }
        if (
          !phase.monthlySpecialReference ||
          !phase.monthlySpecialBaseDate ||
          phase.monthlySpecialOffsetDays === undefined
        ) {
          throw new UnprocessableEntityException(
            `Medicamento ${medication.id} exige monthlySpecialReference, monthlySpecialBaseDate e monthlySpecialOffsetDays na fase ${phase.phaseOrder}.`,
          );
        }
        if (phase.monthlyDay !== undefined) {
          throw new UnprocessableEntityException(
            `Medicamento ${medication.id} contraceptivo mensal não aceita monthlyDay na fase ${phase.phaseOrder}.`,
          );
        }
        return;
      }

      if (hasMonthlySpecialFields) {
        throw new UnprocessableEntityException(
          `Medicamento ${medication.id} não aceita monthlySpecial* na fase ${phase.phaseOrder}.`,
        );
      }
    });
  }
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

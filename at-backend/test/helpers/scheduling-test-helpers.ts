import 'reflect-metadata';
import { Repository } from 'typeorm';
import { ClinicalAnchor } from '../../src/common/enums/clinical-anchor.enum';
import { ClinicalInteractionType } from '../../src/common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../../src/common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../../src/common/enums/clinical-semantic-tag.enum';
import { DoseUnit } from '../../src/common/enums/dose-unit.enum';
import { GroupCode } from '../../src/common/enums/group-code.enum';
import { ScheduleStatus } from '../../src/common/enums/schedule-status.enum';
import { TreatmentRecurrence } from '../../src/common/enums/treatment-recurrence.enum';
import {
  ClinicalInteractionRuleSnapshot,
  ClinicalMedicationSnapshot,
  ClinicalProtocolSnapshot,
  ProtocolStepSnapshot,
  PrescriptionPhaseDoseOverride,
} from '../../src/modules/patient-prescriptions/entities/patient-prescription-snapshot.types';
import { PatientPrescriptionMedication } from '../../src/modules/patient-prescriptions/entities/patient-prescription-medication.entity';
import { PatientPrescriptionPhase } from '../../src/modules/patient-prescriptions/entities/patient-prescription-phase.entity';
import { PatientPrescription } from '../../src/modules/patient-prescriptions/entities/patient-prescription.entity';
import {
  ScheduleEntryDto,
  ScheduledMedicationDto,
  ScheduledPhaseDto,
  SchedulingResultDto,
} from '../../src/modules/scheduling/dto/schedule-response.dto';
import { ScheduledDose } from '../../src/modules/scheduling/entities/scheduled-dose.entity';
import { SchedulingService } from '../../src/modules/scheduling/scheduling.service';
import { ConflictResolutionService } from '../../src/modules/scheduling/services/conflict-resolution.service';
import { SchedulingRulesService } from '../../src/modules/scheduling/services/scheduling-rules.service';

export interface RoutineFixture {
  acordar: string;
  cafe: string;
  almoco: string;
  lanche: string;
  jantar: string;
  dormir: string;
}

interface CreateServiceOptions {
  routine?: RoutineFixture;
}

const DEFAULT_ROUTINE: RoutineFixture = {
  acordar: '06:00',
  cafe: '07:00',
  almoco: '12:00',
  lanche: '15:00',
  jantar: '19:00',
  dormir: '22:00',
};

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function buildRoutine(overrides: Partial<RoutineFixture> = {}): RoutineFixture {
  return { ...DEFAULT_ROUTINE, ...overrides };
}

export function createSchedulingService(
  options: CreateServiceOptions = {},
): {
  service: SchedulingService;
  scheduledDoseRepository: jest.Mocked<Repository<ScheduledDose>>;
} {
  const scheduledDoseRepository = {
    create: jest.fn((entity) => entity as ScheduledDose),
    delete: jest.fn().mockResolvedValue({ affected: 0 } as never),
    find: jest.fn(),
    save: jest.fn(async (entities: ScheduledDose[]) =>
      entities.map((entity, index) => ({
        ...entity,
        id: `scheduled-dose-${index + 1}`,
      })),
    ),
  } as unknown as jest.Mocked<Repository<ScheduledDose>>;

  const prescriptionRepository = {
    findOne: jest.fn(),
  } as unknown as jest.Mocked<Repository<PatientPrescription>>;

  const patientService = {
    getActiveRoutine: jest.fn().mockResolvedValue(options.routine ?? buildRoutine()),
  };

  const service = new SchedulingService(
    scheduledDoseRepository,
    prescriptionRepository,
    patientService as never,
    new SchedulingRulesService(),
    new ConflictResolutionService(),
  );

  return { service, scheduledDoseRepository };
}

export function buildMedicationSnapshot(
  overrides: Partial<ClinicalMedicationSnapshot> = {},
): ClinicalMedicationSnapshot {
  return {
    id: nextId('clinical-medication'),
    commercialName: 'Medicamento Teste',
    activePrinciple: 'Princípio ativo',
    presentation: 'Caixa',
    administrationRoute: 'VO',
    usageInstructions: 'Conforme prescrição.',
    ...overrides,
  };
}

export function buildInteractionRule(
  overrides: Partial<ClinicalInteractionRuleSnapshot> = {},
): ClinicalInteractionRuleSnapshot {
  return {
    interactionType: ClinicalInteractionType.AFFECTED_BY_SALTS,
    resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
    priority: 0,
    ...overrides,
  };
}

export function buildProtocolSnapshot(
  groupCode: string,
  overrides: Partial<ClinicalProtocolSnapshot> = {},
): ClinicalProtocolSnapshot {
  return {
    id: nextId('protocol'),
    code: `${groupCode}_DEFAULT`,
    name: `${groupCode} default`,
    description: 'Protocolo de teste',
    groupCode,
    priority: 0,
    isDefault: true,
    frequencies: buildDefaultFrequencies(groupCode),
    ...overrides,
  };
}

function buildDefaultFrequencies(groupCode: string) {
  const step = (
    doseLabel: string,
    anchor: ClinicalAnchor,
    offsetMinutes: number,
    semanticTag: ClinicalSemanticTag = ClinicalSemanticTag.STANDARD,
  ): ProtocolStepSnapshot => ({
    doseLabel,
    anchor,
    offsetMinutes,
    semanticTag,
  });

  const recipes: Record<string, Array<{ frequency: number; steps: ProtocolStepSnapshot[] }>> = {
    [GroupCode.GROUP_I]: [
      { frequency: 1, steps: [step('D1', ClinicalAnchor.CAFE, 0)] },
      { frequency: 2, steps: [step('D1', ClinicalAnchor.CAFE, 0), step('D2', ClinicalAnchor.JANTAR, 0)] },
      { frequency: 3, steps: [step('D1', ClinicalAnchor.CAFE, 0), step('D2', ClinicalAnchor.LANCHE, 0), step('D3', ClinicalAnchor.DORMIR, 0)] },
      { frequency: 4, steps: [step('D1', ClinicalAnchor.ACORDAR, 0), step('D2', ClinicalAnchor.ACORDAR, 360), step('D3', ClinicalAnchor.ACORDAR, 720), step('D4', ClinicalAnchor.ACORDAR, 1080)] },
    ],
    [GroupCode.GROUP_II_BIFOS]: [
      { frequency: 1, steps: [step('D1', ClinicalAnchor.ACORDAR, -60)] },
    ],
    [GroupCode.GROUP_III_MET]: [
      { frequency: 1, steps: [step('D1', ClinicalAnchor.JANTAR, 0)] },
      { frequency: 2, steps: [step('D1', ClinicalAnchor.CAFE, 0), step('D2', ClinicalAnchor.JANTAR, 0)] },
      { frequency: 3, steps: [step('D1', ClinicalAnchor.CAFE, 0), step('D2', ClinicalAnchor.ALMOCO, 0), step('D3', ClinicalAnchor.JANTAR, 0)] },
    ],
    [GroupCode.GROUP_III_SAL]: [
      { frequency: 1, steps: [step('D1', ClinicalAnchor.ALMOCO, 120)] },
      { frequency: 2, steps: [step('D1', ClinicalAnchor.CAFE, 120), step('D2', ClinicalAnchor.DORMIR, 0)] },
    ],
    [GroupCode.GROUP_II_SUCRA]: [
      { frequency: 1, steps: [step('D1', ClinicalAnchor.ACORDAR, 120)] },
      { frequency: 2, steps: [step('D1', ClinicalAnchor.ACORDAR, 120), step('D2', ClinicalAnchor.DORMIR, 0, ClinicalSemanticTag.BEDTIME_SLOT)] },
    ],
    [GroupCode.GROUP_III_CALC]: [
      { frequency: 1, steps: [step('D1', ClinicalAnchor.CAFE, 180)] },
      { frequency: 2, steps: [step('D1', ClinicalAnchor.CAFE, 180), step('D2', ClinicalAnchor.DORMIR, 0)] },
    ],
    [GroupCode.GROUP_I_SED]: [
      { frequency: 1, steps: [step('D1', ClinicalAnchor.DORMIR, -20, ClinicalSemanticTag.BEDTIME_EQUIVALENT)] },
    ],
    [GroupCode.GROUP_III]: [
      { frequency: 1, steps: [step('D1', ClinicalAnchor.CAFE, 0)] },
      { frequency: 2, steps: [step('D1', ClinicalAnchor.CAFE, 0), step('D2', ClinicalAnchor.JANTAR, 0)] },
    ],
    [GroupCode.GROUP_DELTA]: [
      { frequency: 1, steps: [step('D1', ClinicalAnchor.ACORDAR, 0)] },
    ],
  };

  return recipes[groupCode] ?? [{ frequency: 1, steps: [step('D1', ClinicalAnchor.CAFE, 0)] }];
}

type PhaseOverrides = Omit<Partial<PatientPrescriptionPhase>, 'perDoseOverrides'> & {
  perDoseOverrides?: PrescriptionPhaseDoseOverride[];
};

export function buildPhase(overrides: PhaseOverrides = {}): PatientPrescriptionPhase {
  return {
    id: nextId('phase'),
    phaseOrder: 1,
    frequency: 1,
    sameDosePerSchedule: true,
    doseAmount: '1 COMP',
    doseValue: '1',
    doseUnit: DoseUnit.COMP,
    perDoseOverrides: undefined,
    recurrenceType: TreatmentRecurrence.DAILY,
    weeklyDay: undefined,
    monthlyRule: undefined,
    monthlyDay: undefined,
    alternateDaysInterval: undefined,
    treatmentDays: 10,
    continuousUse: false,
    prnReason: undefined,
    manualAdjustmentEnabled: false,
    manualTimes: undefined,
    ...overrides,
  } as PatientPrescriptionPhase;
}

type PrescriptionMedicationOverrides = Omit<
  Partial<PatientPrescriptionMedication>,
  'medicationSnapshot' | 'protocolSnapshot' | 'interactionRulesSnapshot' | 'phases'
> & {
  medicationSnapshot?: Partial<ClinicalMedicationSnapshot>;
  protocolSnapshot?: Partial<ClinicalProtocolSnapshot>;
  interactionRulesSnapshot?: ClinicalInteractionRuleSnapshot[];
  phases?: PatientPrescriptionPhase[];
};

export function buildPrescriptionMedication(
  overrides: PrescriptionMedicationOverrides = {},
): PatientPrescriptionMedication {
  const {
    medicationSnapshot: medicationSnapshotOverrides,
    protocolSnapshot: protocolSnapshotOverrides,
    interactionRulesSnapshot,
    phases,
    ...entityOverrides
  } = overrides;
  const medicationSnapshot = buildMedicationSnapshot(medicationSnapshotOverrides);
  const groupCode = protocolSnapshotOverrides?.groupCode ?? GroupCode.GROUP_I;
  const protocolSnapshot = buildProtocolSnapshot(groupCode, protocolSnapshotOverrides);
  return {
    id: nextId('prescription-medication'),
    sourceClinicalMedicationId: medicationSnapshot.id,
    sourceProtocolId: protocolSnapshot.id,
    medicationSnapshot,
    protocolSnapshot,
    interactionRulesSnapshot: interactionRulesSnapshot ?? [],
    phases: phases ?? [buildPhase()],
    ...entityOverrides,
  } as PatientPrescriptionMedication;
}

export function buildPatientPrescription(
  medications: PatientPrescriptionMedication[],
  overrides: Partial<PatientPrescription> = {},
): PatientPrescription {
  return {
    id: nextId('patient-prescription'),
    patient: {
      id: nextId('patient'),
      fullName: 'Paciente Teste',
      birthDate: '1970-01-01',
      rg: 'RG-TESTE',
      cpf: '000.000.000-00',
      phone: '(68)99999-9999',
      routines: [],
      prescriptions: [],
    },
    startedAt: '2026-04-17',
    status: 'ACTIVE',
    medications: medications.map((medication) => ({
      ...medication,
      prescription: undefined as unknown as PatientPrescription,
      phases: medication.phases.map((phase) => ({
        ...phase,
        prescriptionMedication: undefined as unknown as PatientPrescriptionMedication,
      })),
    })),
    ...overrides,
  } as PatientPrescription;
}

export async function buildScheduleResult(
  service: SchedulingService,
  medications: PatientPrescriptionMedication[],
  overrides: Partial<PatientPrescription> = {},
): Promise<SchedulingResultDto> {
  return service.buildAndPersistSchedule(buildPatientPrescription(medications, overrides));
}

type LegacyScheduleEntry = Record<string, unknown>;
type LegacyScheduledPhase = Record<string, unknown>;
type LegacyScheduledMedication = Record<string, unknown>;

function toIsoDateOrUndefined(ptBrDate: string | null | undefined): string | undefined {
  if (!ptBrDate) return undefined;
  const [day, month, year] = ptBrDate.split('/');
  if (!day || !month || !year) return undefined;
  return `${year}-${month}-${day}`;
}

function toLegacyConflict(conflito: ScheduleEntryDto['conflito']): Record<string, unknown> | undefined {
  if (!conflito) return undefined;
  return {
    interactionType: conflito.tipo_interacao_codigo ?? undefined,
    interactionLabel: conflito.tipo_interacao_label ?? undefined,
    resolutionType: conflito.tipo_resolucao_codigo ?? undefined,
    resolutionLabel: conflito.tipo_resolucao_label ?? undefined,
    triggerMedicationName: conflito.medicamento_disparador_nome ?? undefined,
    triggerGroupCode: conflito.grupo_disparador_codigo ?? undefined,
    triggerProtocolCode: conflito.protocolo_disparador_codigo ?? undefined,
    rulePriority: conflito.prioridade_regra ?? undefined,
    windowBeforeMinutes: conflito.janela_antes_minutos ?? undefined,
    windowAfterMinutes: conflito.janela_depois_minutos ?? undefined,
  };
}

function toLegacyRecurrenceLabel(label: string): string {
  return label
    .replace('Diário', 'Diario')
    .replace('Uso contínuo', 'Uso continuo')
    .replace('Se necessário: febre', 'Se necessario: fever')
    .replace('Se necessário: dor', 'Se necessario: pain')
    .replace('Se necessário: crise', 'Se necessario: crisis')
    .replace('Se necessário: náusea e vômito', 'Se necessario: nausea_and_vomiting')
    .replace('Se necessário: falta de ar', 'Se necessario: shortness_of_breath')
    .replace('Se necessário', 'Se necessario');
}

function toLegacyEntry(entry: ScheduleEntryDto, phase: ScheduledPhaseDto): LegacyScheduleEntry {
  return {
    ...entry,
    doseLabel: entry.dose_horario_label,
    administrationValue: entry.dose_valor ?? undefined,
    administrationUnit: entry.dose_unidade ?? undefined,
    administrationLabel: entry.dose_exibicao,
    timeFormatted: entry.horario,
    recurrenceType: entry.recorrencia_codigo ?? undefined,
    recurrenceLabel: toLegacyRecurrenceLabel(entry.recorrencia_label),
    weeklyDay: entry.dia_semanal ?? undefined,
    monthlyRule: entry.regra_mensal ?? undefined,
    monthlyDay: entry.dia_mensal ?? undefined,
    alternateDaysInterval: entry.intervalo_dias_alternados ?? undefined,
    continuousUse: entry.uso_continuo,
    isPrn: entry.uso_se_necessario,
    prnReason: entry.motivo_se_necessario ?? undefined,
    status: entry.status_codigo,
    statusLabel: entry.status_label,
    note: entry.observacao ?? undefined,
    clinicalInstructionLabel: entry.orientacao_clinica ?? undefined,
    timeContext: {
      anchor: entry.contexto_horario.ancora ?? undefined,
      anchorTimeInMinutes: entry.contexto_horario.ancora_horario_minutos ?? undefined,
      offsetMinutes: entry.contexto_horario.deslocamento_minutos ?? undefined,
      semanticTag: entry.contexto_horario.tag_semantica ?? undefined,
      originalTimeInMinutes: entry.contexto_horario.horario_original_minutos,
      originalTimeFormatted: entry.contexto_horario.horario_original,
      resolvedTimeInMinutes: entry.contexto_horario.horario_resolvido_minutos,
      resolvedTimeFormatted: entry.contexto_horario.horario_resolvido,
    },
    conflict: toLegacyConflict(entry.conflito),
    startDate: toIsoDateOrUndefined(phase.data_inicio),
    endDate: toIsoDateOrUndefined(phase.data_fim),
  };
}

function toLegacyPhase(phase: ScheduledPhaseDto): LegacyScheduledPhase {
  const entries = phase.entradas.map((entry) => toLegacyEntry(entry, phase));
  return {
    ...phase,
    phaseOrder: phase.fase_ordem,
    phaseLabel: phase.fase_label,
    startDate: toIsoDateOrUndefined(phase.data_inicio),
    endDate: toIsoDateOrUndefined(phase.data_fim),
    continuousUse: phase.uso_continuo,
    entries,
  };
}

function toLegacyMedication(medication: ScheduledMedicationDto): LegacyScheduledMedication {
  const phases = medication.fases.map(toLegacyPhase);
  return {
    ...medication,
    medicationName: medication.nome_medicamento,
    activePrinciple: medication.principio_ativo,
    presentation: medication.apresentacao,
    pharmaceuticalForm: medication.forma_farmaceutica ?? undefined,
    administrationRoute: medication.via_administracao,
    usageInstructions: medication.orientacoes_uso,
    groupCode: medication.grupo_codigo,
    groupLabel: medication.grupo_label,
    protocolCode: medication.protocolo_codigo,
    protocolName: medication.protocolo_nome ?? undefined,
    protocolDescription: medication.protocolo_descricao ?? undefined,
    phases,
  };
}

function toLegacyResult(result: SchedulingResultDto): {
  patientId: string;
  prescriptionId: string;
  medications: LegacyScheduledMedication[];
} {
  return {
    patientId: result.paciente_id,
    prescriptionId: result.prescricao_id,
    medications: result.medicamentos.map(toLegacyMedication),
  };
}

export function flattenEntries(result: SchedulingResultDto): any[] {
  const legacy = toLegacyResult(result);
  return legacy.medications.flatMap((medication) =>
    (medication.phases as LegacyScheduledPhase[]).flatMap(
      (phase) => phase.entries as any[],
    ),
  );
}

export function findEntryByTime(
  result: SchedulingResultDto,
  medicationName: string,
  timeFormatted: string,
): any | undefined {
  const medication = findMedication(result, medicationName);
  if (!medication) return undefined;
  return (medication.phases as LegacyScheduledPhase[])
    .flatMap((phase) => phase.entries as any[])
    .find((entry) => (entry as LegacyScheduleEntry).timeFormatted === timeFormatted);
}

export function findEntriesByMedication(
  result: SchedulingResultDto,
  medicationName: string,
): any[] {
  const medication = findMedication(result, medicationName);
  if (!medication) return [];
  return (medication.phases as LegacyScheduledPhase[]).flatMap(
    (phase) => phase.entries as any[],
  );
}

export function findEntriesByMedicationAndTime(
  result: SchedulingResultDto,
  medicationName: string,
  timeFormatted: string,
): any[] {
  return findEntriesByMedication(result, medicationName).filter(
    (entry) => (entry as unknown as LegacyScheduleEntry).timeFormatted === timeFormatted,
  );
}

export function findMedication(
  result: SchedulingResultDto,
  medicationName: string,
): any | undefined {
  return toLegacyResult(result).medications.find(
    (medication) => medication.medicationName === medicationName,
  ) as unknown as any | undefined;
}

export function findPhase(
  result: SchedulingResultDto,
  medicationName: string,
  phaseOrder: number,
): any | undefined {
  return (findMedication(result, medicationName)?.phases as LegacyScheduledPhase[] | undefined)
    ?.find((phase) => phase.phaseOrder === phaseOrder) as unknown as any | undefined;
}

export function expectEntry(
  entry: any | undefined,
  expectation: Record<string, unknown>,
): void {
  expect(entry).toBeDefined();
  expect(entry).toMatchObject({
    status: ScheduleStatus.ACTIVE,
    ...expectation,
  });
}

export function expectInactiveEntry(
  entry: any | undefined,
  expectation: Record<string, unknown>,
): void {
  expect(entry).toBeDefined();
  expect(entry).toMatchObject({
    status: ScheduleStatus.INACTIVE,
    ...expectation,
  });
}

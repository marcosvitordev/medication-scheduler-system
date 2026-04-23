import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import { ClinicalAnchor } from "../../src/common/enums/clinical-anchor.enum";
import { ClinicalInteractionType } from "../../src/common/enums/clinical-interaction-type.enum";
import { ClinicalResolutionType } from "../../src/common/enums/clinical-resolution-type.enum";
import { ClinicalSemanticTag } from "../../src/common/enums/clinical-semantic-tag.enum";
import { DoseUnit } from "../../src/common/enums/dose-unit.enum";
import { GroupCode } from "../../src/common/enums/group-code.enum";
import { ScheduleStatus } from "../../src/common/enums/schedule-status.enum";
import { TreatmentRecurrence } from "../../src/common/enums/treatment-recurrence.enum";
import {
  ClinicalInteractionRuleSnapshot,
  ClinicalMedicationSnapshot,
  ClinicalProtocolSnapshot,
  ProtocolStepSnapshot,
  PrescriptionPhaseDoseOverride,
} from "../../src/modules/patient-prescriptions/entities/patient-prescription-snapshot.types";
import { PatientPrescriptionMedication } from "../../src/modules/patient-prescriptions/entities/patient-prescription-medication.entity";
import { PatientPrescriptionPhase } from "../../src/modules/patient-prescriptions/entities/patient-prescription-phase.entity";
import { PatientPrescription } from "../../src/modules/patient-prescriptions/entities/patient-prescription.entity";
import {
  CalendarScheduleDoseDto,
  CalendarScheduleItemDto,
  CalendarScheduleResponseDto,
} from "../../src/modules/scheduling/dto/calendar-schedule-response.dto";
import { ScheduledDose } from "../../src/modules/scheduling/entities/scheduled-dose.entity";
import { SchedulingService } from "../../src/modules/scheduling/scheduling.service";
import { ConflictResolutionService } from "../../src/modules/scheduling/services/conflict-resolution.service";
import { SchedulingRulesService } from "../../src/modules/scheduling/services/scheduling-rules.service";

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
  acordar: "06:00",
  cafe: "07:00",
  almoco: "12:00",
  lanche: "15:00",
  jantar: "19:00",
  dormir: "22:00",
};

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function buildRoutine(
  overrides: Partial<RoutineFixture> = {},
): RoutineFixture {
  return { ...DEFAULT_ROUTINE, ...overrides };
}

export function createSchedulingService(options: CreateServiceOptions = {}): {
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
    getActiveRoutine: jest
      .fn()
      .mockResolvedValue(options.routine ?? buildRoutine()),
  };

  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        CALENDAR_COMPANY_NAME: "AT Farma",
        CALENDAR_COMPANY_CNPJ: "12.345.678/0001-90",
        CALENDAR_COMPANY_PHONE: "(68)3333-4444",
        CALENDAR_COMPANY_EMAIL: "contato@atfarma.com.br",
        CALENDAR_PHARMACIST_NAME: "Farmacêutica Teste",
        CALENDAR_PHARMACIST_CRF: "CRF-AC 1234",
      };
      return values[key];
    }),
  } as unknown as ConfigService;

  const service = new SchedulingService(
    scheduledDoseRepository,
    prescriptionRepository,
    patientService as never,
    new SchedulingRulesService(),
    new ConflictResolutionService(),
    configService,
  );

  return { service, scheduledDoseRepository };
}

export function buildMedicationSnapshot(
  overrides: Partial<ClinicalMedicationSnapshot> = {},
): ClinicalMedicationSnapshot {
  return {
    id: nextId("clinical-medication"),
    commercialName: "Medicamento Teste",
    activePrinciple: "Princípio ativo",
    presentation: "Caixa",
    administrationRoute: "VO",
    usageInstructions: "Conforme prescrição.",
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
    id: nextId("protocol"),
    code: `${groupCode}_DEFAULT`,
    name: `${groupCode} default`,
    description: "Protocolo de teste",
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

  const recipes: Record<
    string,
    Array<{ frequency: number; steps: ProtocolStepSnapshot[] }>
  > = {
    [GroupCode.GROUP_I]: [
      { frequency: 1, steps: [step("D1", ClinicalAnchor.CAFE, 0)] },
      {
        frequency: 2,
        steps: [
          step("D1", ClinicalAnchor.CAFE, 0),
          step("D2", ClinicalAnchor.JANTAR, 0),
        ],
      },
      {
        frequency: 3,
        steps: [
          step("D1", ClinicalAnchor.CAFE, 0),
          step("D2", ClinicalAnchor.LANCHE, 0),
          step("D3", ClinicalAnchor.DORMIR, 0),
        ],
      },
      {
        frequency: 4,
        steps: [
          step("D1", ClinicalAnchor.ACORDAR, 0),
          step("D2", ClinicalAnchor.ACORDAR, 360),
          step("D3", ClinicalAnchor.ACORDAR, 720),
          step("D4", ClinicalAnchor.ACORDAR, 1080),
        ],
      },
    ],
    [GroupCode.GROUP_II_BIFOS]: [
      { frequency: 1, steps: [step("D1", ClinicalAnchor.ACORDAR, -60)] },
    ],
    [GroupCode.GROUP_III_MET]: [
      { frequency: 1, steps: [step("D1", ClinicalAnchor.JANTAR, 0)] },
      {
        frequency: 2,
        steps: [
          step("D1", ClinicalAnchor.CAFE, 0),
          step("D2", ClinicalAnchor.JANTAR, 0),
        ],
      },
      {
        frequency: 3,
        steps: [
          step("D1", ClinicalAnchor.CAFE, 0),
          step("D2", ClinicalAnchor.ALMOCO, 0),
          step("D3", ClinicalAnchor.JANTAR, 0),
        ],
      },
    ],
    [GroupCode.GROUP_III_SAL]: [
      { frequency: 1, steps: [step("D1", ClinicalAnchor.ALMOCO, 120)] },
      {
        frequency: 2,
        steps: [
          step("D1", ClinicalAnchor.CAFE, 120),
          step("D2", ClinicalAnchor.DORMIR, 0),
        ],
      },
      {
        frequency: 3,
        steps: [
          step("D1", ClinicalAnchor.CAFE, 120),
          step("D2", ClinicalAnchor.ALMOCO, 120),
          step("D3", ClinicalAnchor.DORMIR, 0),
        ],
      },
    ],
    [GroupCode.GROUP_II_SUCRA]: [
      { frequency: 1, steps: [step("D1", ClinicalAnchor.ACORDAR, 120)] },
      {
        frequency: 2,
        steps: [
          step("D1", ClinicalAnchor.ACORDAR, 120),
          step(
            "D2",
            ClinicalAnchor.DORMIR,
            0,
            ClinicalSemanticTag.BEDTIME_SLOT,
          ),
        ],
      },
    ],
    [GroupCode.GROUP_III_CALC]: [
      { frequency: 1, steps: [step("D1", ClinicalAnchor.CAFE, 180)] },
      {
        frequency: 2,
        steps: [
          step("D1", ClinicalAnchor.CAFE, 180),
          step("D2", ClinicalAnchor.DORMIR, 0),
        ],
      },
    ],
    [GroupCode.GROUP_I_SED]: [
      {
        frequency: 1,
        steps: [
          step(
            "D1",
            ClinicalAnchor.DORMIR,
            -20,
            ClinicalSemanticTag.BEDTIME_EQUIVALENT,
          ),
        ],
      },
    ],
    [GroupCode.GROUP_III]: [
      { frequency: 1, steps: [step("D1", ClinicalAnchor.CAFE, 0)] },
      {
        frequency: 2,
        steps: [
          step("D1", ClinicalAnchor.CAFE, 0),
          step("D2", ClinicalAnchor.JANTAR, 0),
        ],
      },
    ],
    [GroupCode.GROUP_DELTA]: [
      { frequency: 1, steps: [step("D1", ClinicalAnchor.ACORDAR, 0)] },
    ],
  };

  return (
    recipes[groupCode] ?? [
      { frequency: 1, steps: [step("D1", ClinicalAnchor.CAFE, 0)] },
    ]
  );
}

type PhaseOverrides = Omit<
  Partial<PatientPrescriptionPhase>,
  "perDoseOverrides"
> & {
  perDoseOverrides?: PrescriptionPhaseDoseOverride[];
};

export function buildPhase(
  overrides: PhaseOverrides = {},
): PatientPrescriptionPhase {
  return {
    id: nextId("phase"),
    phaseOrder: 1,
    frequency: 1,
    sameDosePerSchedule: true,
    doseAmount: "1 COMP",
    doseValue: "1",
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
  | "medicationSnapshot"
  | "protocolSnapshot"
  | "interactionRulesSnapshot"
  | "phases"
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
  const medicationSnapshot = buildMedicationSnapshot(
    medicationSnapshotOverrides,
  );
  const groupCode = protocolSnapshotOverrides?.groupCode ?? GroupCode.GROUP_I;
  const protocolSnapshot = buildProtocolSnapshot(
    groupCode,
    protocolSnapshotOverrides,
  );
  return {
    id: nextId("prescription-medication"),
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
    id: nextId("patient-prescription"),
    patient: {
      id: nextId("patient"),
      fullName: "Paciente Teste",
      birthDate: "1970-01-01",
      rg: "RG-TESTE",
      cpf: "000.000.000-00",
      phone: "(68)99999-9999",
      routines: [],
      prescriptions: [],
    },
    startedAt: "2026-04-17",
    status: "ACTIVE",
    medications: medications.map((medication) => ({
      ...medication,
      prescription: undefined as unknown as PatientPrescription,
      phases: medication.phases.map((phase) => ({
        ...phase,
        prescriptionMedication:
          undefined as unknown as PatientPrescriptionMedication,
      })),
    })),
    ...overrides,
  } as PatientPrescription;
}

export async function buildScheduleResult(
  service: SchedulingService,
  medications: PatientPrescriptionMedication[],
  overrides: Partial<PatientPrescription> = {},
): Promise<CalendarScheduleResponseDto> {
  return service.buildAndPersistSchedule(
    buildPatientPrescription(medications, overrides),
  );
}

type LegacyScheduleEntry = Record<string, unknown>;
type LegacyScheduledPhase = Record<string, unknown>;
type LegacyScheduledMedication = Record<string, unknown>;

function toIsoDateOrUndefined(
  ptBrDate: string | null | undefined,
): string | undefined {
  if (!ptBrDate) return undefined;
  const [day, month, year] = ptBrDate.split("/");
  if (!day || !month || !year) return undefined;
  return `${year}-${month}-${day}`;
}

function toLegacyConflict(
  conflito: CalendarScheduleDoseDto["conflito"],
): Record<string, unknown> | undefined {
  if (!conflito) return undefined;
  return {
    interactionType: conflito.tipo_interacao_codigo ?? undefined,
    interactionLabel: conflito.tipo_interacao_label ?? undefined,
    resolutionType: conflito.tipo_resolucao_codigo ?? undefined,
    resolutionLabel: conflito.tipo_resolucao_label ?? undefined,
    matchKind: conflito.tipo_match_codigo ?? undefined,
    matchKindLabel: conflito.tipo_match_label ?? undefined,
    triggerMedicationName: conflito.medicamento_disparador_nome ?? undefined,
    triggerGroupCode: conflito.grupo_disparador_codigo ?? undefined,
    triggerProtocolCode: conflito.protocolo_disparador_codigo ?? undefined,
    rulePriority: conflito.prioridade_regra ?? undefined,
    windowBeforeMinutes: conflito.janela_antes_minutos ?? undefined,
    windowAfterMinutes: conflito.janela_depois_minutos ?? undefined,
  };
}

function toLegacyRecurrenceLabel(recorrenciaTexto: string): string {
  if (recorrenciaTexto === "Diário") return "Diario";
  if (recorrenciaTexto === "Uso contínuo") return "Uso continuo";
  if (/^Semanal: /i.test(recorrenciaTexto)) {
    return `Semanal em ${toLegacyWeeklyDay(recorrenciaTexto.replace(/^Semanal:\s*/i, ""))}`;
  }
  if (/^Mensal: dia /i.test(recorrenciaTexto)) {
    return `Mensal no dia ${Number(recorrenciaTexto.replace(/^Mensal:\s*dia\s*/i, ""))}`;
  }
  if (/^Em caso de /i.test(recorrenciaTexto)) {
    return `Se necessario: ${toLegacyPrnReasonLabel(recorrenciaTexto.replace(/^Em caso de\s*/i, ""))}`;
  }
  return recorrenciaTexto;
}

function toLegacyWeeklyDay(displayWeekday: string): string {
  const normalized = displayWeekday.trim().toLowerCase();
  switch (normalized) {
    case "segunda-feira":
      return "SEGUNDA";
    case "terça-feira":
      return "TERCA";
    case "quarta-feira":
      return "QUARTA";
    case "quinta-feira":
      return "QUINTA";
    case "sexta-feira":
      return "SEXTA";
    case "sábado":
      return "SABADO";
    case "domingo":
      return "DOMINGO";
    default:
      return displayWeekday.trim().toUpperCase();
  }
}

function toLegacyPrnReasonLabel(reason: string): string {
  switch (reason.trim().toLowerCase()) {
    case "febre":
      return "fever";
    case "dor":
      return "pain";
    case "crise":
      return "crisis";
    case "náusea e vômito":
      return "nausea_and_vomiting";
    case "falta de ar":
      return "shortness_of_breath";
    default:
      return reason.trim().toLowerCase().replaceAll(" ", "_");
  }
}

function toLegacyPrnReasonEnum(reason: string): string {
  switch (reason.trim().toLowerCase()) {
    case "febre":
      return "FEVER";
    case "dor":
      return "PAIN";
    case "crise":
      return "CRISIS";
    case "náusea e vômito":
      return "NAUSEA_VOMITING";
    case "falta de ar":
      return "SHORTNESS_OF_BREATH";
    default:
      return reason.trim().toUpperCase().replaceAll(" ", "_");
  }
}

function parseLegacyAlternateDaysInterval(
  recorrenciaTexto: string,
): number | undefined {
  const match = recorrenciaTexto.match(/^A cada (\d+) dias$/i);
  return match ? Number(match[1]) : undefined;
}

function parseLegacyMonthlyDay(recorrenciaTexto: string): number | undefined {
  const match = recorrenciaTexto.match(/^Mensal:\s*dia\s*(\d{1,2})$/i);
  return match ? Number(match[1]) : undefined;
}

function parseLegacyWeeklyDay(recorrenciaTexto: string): string | undefined {
  const match = recorrenciaTexto.match(/^Semanal:\s*(.+)$/i);
  return match ? toLegacyWeeklyDay(match[1]) : undefined;
}

function parseLegacyPrnReason(recorrenciaTexto: string): string | undefined {
  const match = recorrenciaTexto.match(/^Em caso de\s+(.+)$/i);
  return match ? toLegacyPrnReasonEnum(match[1]) : undefined;
}

function parseLegacyRecurrenceType(
  recorrenciaTexto: string,
): TreatmentRecurrence | undefined {
  if (recorrenciaTexto === "Diário" || recorrenciaTexto === "Uso contínuo") {
    return TreatmentRecurrence.DAILY;
  }
  if (/^Semanal: /i.test(recorrenciaTexto)) return TreatmentRecurrence.WEEKLY;
  if (
    /^Mensal: /i.test(recorrenciaTexto) ||
    /^Primeira aplicação:/i.test(recorrenciaTexto)
  ) {
    return TreatmentRecurrence.MONTHLY;
  }
  if (/^A cada \d+ dias$/i.test(recorrenciaTexto))
    return TreatmentRecurrence.ALTERNATE_DAYS;
  if (
    /^Em caso de /i.test(recorrenciaTexto) ||
    recorrenciaTexto === "Sob demanda"
  ) {
    return TreatmentRecurrence.PRN;
  }
  return undefined;
}

function parseLegacyClinicalInstructionLabel(
  recorrenciaTexto: string,
): string | undefined {
  const match = recorrenciaTexto.match(/^Em caso de\s+(.+)$/i);
  return match ? `Uso se necessario em caso de ${match[1].trim()}.` : undefined;
}

function toLegacyEntry(
  item: CalendarScheduleItemDto,
  entry: CalendarScheduleDoseDto,
): LegacyScheduleEntry {
  return {
    doseLabel: entry.label,
    administrationValue: entry.doseValor ?? undefined,
    administrationUnit: entry.doseUnidade ?? undefined,
    administrationLabel: entry.doseExibicao,
    timeFormatted: entry.horario,
    recurrenceType: parseLegacyRecurrenceType(item.recorrenciaTexto),
    recurrenceLabel: toLegacyRecurrenceLabel(item.recorrenciaTexto),
    weeklyDay: parseLegacyWeeklyDay(item.recorrenciaTexto),
    monthlyDay: parseLegacyMonthlyDay(item.recorrenciaTexto),
    alternateDaysInterval: parseLegacyAlternateDaysInterval(
      item.recorrenciaTexto,
    ),
    continuousUse: item.recorrenciaTexto === "Uso contínuo",
    isPrn: /^Em caso de /i.test(item.recorrenciaTexto),
    prnReason: parseLegacyPrnReason(item.recorrenciaTexto),
    status: entry.status,
    statusLabel: entry.statusLabel,
    note: entry.observacao ?? undefined,
    reasonCode: entry.reasonCode ?? undefined,
    reasonText: entry.reasonText ?? undefined,
    clinicalInstructionLabel: parseLegacyClinicalInstructionLabel(
      item.recorrenciaTexto,
    ),
    timeContext: {
      anchor: entry.contextoHorario.ancora ?? undefined,
      anchorTimeInMinutes:
        entry.contextoHorario.ancora_horario_minutos ?? undefined,
      offsetMinutes: entry.contextoHorario.deslocamento_minutos ?? undefined,
      semanticTag: entry.contextoHorario.tag_semantica ?? undefined,
      originalTimeInMinutes: entry.contextoHorario.horario_original_minutos,
      originalTimeFormatted: entry.contextoHorario.horario_original,
      resolvedTimeInMinutes: entry.contextoHorario.horario_resolvido_minutos,
      resolvedTimeFormatted: entry.contextoHorario.horario_resolvido,
    },
    conflict: toLegacyConflict(entry.conflito),
    startDate: toIsoDateOrUndefined(item.inicio),
    endDate: toIsoDateOrUndefined(item.termino),
  };
}

function toLegacyPhase(item: CalendarScheduleItemDto): LegacyScheduledPhase {
  const entries = item.doses.map((entry) => toLegacyEntry(item, entry));
  return {
    phaseOrder: item.phaseOrder,
    phaseLabel: `Posologia ${item.phaseOrder}`,
    startDate: toIsoDateOrUndefined(item.inicio),
    endDate: toIsoDateOrUndefined(item.termino),
    continuousUse: item.recorrenciaTexto === "Uso contínuo",
    entries,
  };
}

function toLegacyMedication(
  items: CalendarScheduleItemDto[],
): LegacyScheduledMedication {
  const [firstItem] = items;
  const phases = [...items]
    .sort((left, right) => left.phaseOrder - right.phaseOrder)
    .map((item) => toLegacyPhase(item));
  return {
    prescriptionMedicationId: firstItem.prescriptionMedicationId,
    medicationName: firstItem.medicamento,
    activePrinciple: firstItem.principioAtivo,
    presentation: firstItem.apresentacao,
    pharmaceuticalForm: firstItem.formaFarmaceutica ?? undefined,
    administrationRoute: firstItem.via,
    usageInstructions: firstItem.modoUso,
    phases,
  };
}

function toLegacyResult(result: CalendarScheduleResponseDto): {
  medications: LegacyScheduledMedication[];
} {
  const itemsByMedication = new Map<string, CalendarScheduleItemDto[]>();
  result.scheduleItems.forEach((item) => {
    const items = itemsByMedication.get(item.prescriptionMedicationId) ?? [];
    items.push(item);
    itemsByMedication.set(item.prescriptionMedicationId, items);
  });

  return {
    medications: [...itemsByMedication.values()].map(toLegacyMedication),
  };
}

export function flattenEntries(result: CalendarScheduleResponseDto): any[] {
  const legacy = toLegacyResult(result);
  return legacy.medications.flatMap((medication) =>
    (medication.phases as LegacyScheduledPhase[]).flatMap(
      (phase) => phase.entries as any[],
    ),
  );
}

export function findEntryByTime(
  result: CalendarScheduleResponseDto,
  medicationName: string,
  timeFormatted: string,
): any | undefined {
  const medication = findMedication(result, medicationName);
  if (!medication) return undefined;
  return (medication.phases as LegacyScheduledPhase[])
    .flatMap((phase) => phase.entries as any[])
    .find(
      (entry) => (entry as LegacyScheduleEntry).timeFormatted === timeFormatted,
    );
}

export function findEntriesByMedication(
  result: CalendarScheduleResponseDto,
  medicationName: string,
): any[] {
  const medication = findMedication(result, medicationName);
  if (!medication) return [];
  return (medication.phases as LegacyScheduledPhase[]).flatMap(
    (phase) => phase.entries as any[],
  );
}

export function findEntriesByMedicationAndTime(
  result: CalendarScheduleResponseDto,
  medicationName: string,
  timeFormatted: string,
): any[] {
  return findEntriesByMedication(result, medicationName).filter(
    (entry) =>
      (entry as unknown as LegacyScheduleEntry).timeFormatted === timeFormatted,
  );
}

export function findMedication(
  result: CalendarScheduleResponseDto,
  medicationName: string,
): any | undefined {
  return toLegacyResult(result).medications.find(
    (medication) => medication.medicationName === medicationName,
  ) as unknown as any | undefined;
}

export function findPhase(
  result: CalendarScheduleResponseDto,
  medicationName: string,
  phaseOrder: number,
): any | undefined {
  return (
    findMedication(result, medicationName)?.phases as
      | LegacyScheduledPhase[]
      | undefined
  )?.find((phase) => phase.phaseOrder === phaseOrder) as unknown as
    | any
    | undefined;
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

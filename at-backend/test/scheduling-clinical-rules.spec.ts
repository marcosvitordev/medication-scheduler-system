import 'reflect-metadata';
import { Repository } from 'typeorm';
import { DoseUnit } from '../src/common/enums/dose-unit.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import { PrnReason } from '../src/common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../src/common/enums/treatment-recurrence.enum';
import { MedicationCatalog } from '../src/modules/medications/entities/medication-catalog.entity';
import { MedicationGroup } from '../src/modules/medications/entities/medication-group.entity';
import {
  PrescriptionItem,
  PrescriptionItemDoseOverride,
} from '../src/modules/prescriptions/entities/prescription-item.entity';
import { Prescription } from '../src/modules/prescriptions/entities/prescription.entity';
import { SchedulingResultDto } from '../src/modules/scheduling/dto/schedule-response.dto';
import { ScheduledDose } from '../src/modules/scheduling/entities/scheduled-dose.entity';
import { SchedulingService } from '../src/modules/scheduling/scheduling.service';
import { SchedulingRulesService } from '../src/modules/scheduling/services/scheduling-rules.service';

describe('SchedulingService clinical rules', () => {
  let service: SchedulingService;
  let repository: jest.Mocked<Repository<ScheduledDose>>;

  beforeEach(() => {
    repository = {
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

    const patientService = {
      getActiveRoutine: jest.fn().mockResolvedValue({
        acordar: '06:00',
        cafe: '07:00',
        almoco: '12:00',
        lanche: '15:00',
        jantar: '19:00',
        dormir: '22:00',
      }),
    };

    service = new SchedulingService(
      repository,
      patientService as never,
      new SchedulingRulesService(),
    );
  });

  it('builds a daily treatment for 10 days with treatment window metadata', async () => {
    const result = await buildScheduleResult([
      buildItem({
        recurrenceType: TreatmentRecurrence.DAILY,
        frequency: 1,
        treatmentDays: 10,
      }),
    ]);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      recurrenceType: TreatmentRecurrence.DAILY,
      recurrenceLabel: 'Diario',
      startDate: '2026-04-17',
      endDate: '2026-04-26',
    });
  });

  it('builds continuous-use metadata without endDate', async () => {
    const result = await buildScheduleResult([
      buildItem({
        continuousUse: true,
        treatmentDays: undefined,
      }),
    ]);

    expect(result.entries[0].continuousUse).toBe(true);
    expect(result.entries[0].endDate).toBeUndefined();
    expect(result.entries[0].recurrenceLabel).toBe('Uso continuo');
  });

  it('builds weekly recurrence metadata', async () => {
    const result = await buildScheduleResult([
      buildItem({
        recurrenceType: TreatmentRecurrence.WEEKLY,
        weeklyDay: 'segunda',
      }),
    ]);

    expect(result.entries[0]).toMatchObject({
      recurrenceType: TreatmentRecurrence.WEEKLY,
      weeklyDay: 'SEGUNDA',
      recurrenceLabel: 'Semanal em SEGUNDA',
    });
  });

  it('builds monthly recurrence metadata', async () => {
    const result = await buildScheduleResult([
      buildItem({
        recurrenceType: TreatmentRecurrence.MONTHLY,
        monthlyDay: 8,
      }),
    ]);

    expect(result.entries[0]).toMatchObject({
      recurrenceType: TreatmentRecurrence.MONTHLY,
      monthlyDay: 8,
      recurrenceLabel: 'Mensal no dia 8',
    });
  });

  it('builds alternate-days recurrence metadata', async () => {
    const result = await buildScheduleResult([
      buildItem({
        recurrenceType: TreatmentRecurrence.ALTERNATE_DAYS,
        alternateDaysInterval: 2,
      }),
    ]);

    expect(result.entries[0]).toMatchObject({
      recurrenceType: TreatmentRecurrence.ALTERNATE_DAYS,
      alternateDaysInterval: 2,
      recurrenceLabel: 'A cada 2 dias',
    });
  });

  it('marks PRN treatments with explicit clinical instruction', async () => {
    const result = await buildScheduleResult([
      buildItem({
        recurrenceType: TreatmentRecurrence.PRN,
        prnReason: PrnReason.FEVER,
        treatmentDays: undefined,
      }),
    ]);

    expect(result.entries[0]).toMatchObject({
      isPrn: true,
      prnReason: PrnReason.FEVER,
      recurrenceLabel: 'Se necessario: febre',
      clinicalInstructionLabel: 'Uso se necessario em caso de febre.',
      note: 'Dose sob demanda; administrar apenas se houver indicacao clinica.',
    });
  });

  it('keeps the same clinical dose across all schedules when sameDosePerSchedule is true', async () => {
    const result = await buildScheduleResult([
      buildItem({
        frequency: 2,
        sameDosePerSchedule: true,
        doseValue: '1',
        doseUnit: DoseUnit.COMP,
      }),
    ]);

    expect(result.entries).toHaveLength(2);
    expect(result.entries.map((entry) => entry.administrationLabel)).toEqual([
      '1 COMP',
      '1 COMP',
    ]);
  });

  it('uses per-dose overrides when the dose varies by schedule', async () => {
    const result = await buildScheduleResult([
      buildItem({
        frequency: 2,
        sameDosePerSchedule: false,
        perDoseOverrides: [
          { doseLabel: 'D1', doseValue: '1', doseUnit: DoseUnit.COMP },
          { doseLabel: 'D2', doseValue: '2', doseUnit: DoseUnit.COMP },
        ],
      }),
    ]);

    expect(result.entries.map((entry) => entry.administrationLabel)).toEqual([
      '1 COMP',
      '2 COMP',
    ]);
  });

  it('respects coherent manual schedule times', async () => {
    const result = await buildScheduleResult([
      buildItem({
        frequency: 2,
        manualAdjustmentEnabled: true,
        manualTimes: ['08:15', '20:45'],
      }),
    ]);

    expect(result.entries).toHaveLength(2);
    expect(result.entries.map((entry) => entry.timeFormatted)).toEqual([
      '08:15',
      '20:45',
    ]);
    expect(result.entries.map((entry) => entry.note)).toEqual([
      'Horário definido manualmente.',
      'Horário definido manualmente.',
    ]);
  });

  async function buildScheduleResult(
    items: PrescriptionItem[],
  ): Promise<SchedulingResultDto> {
    const prescription = buildPrescription(items);
    return service.buildAndPersistSchedule(prescription);
  }
});

function buildPrescription(items: PrescriptionItem[]): Prescription {
  return {
    id: 'prescription-1',
    startedAt: '2026-04-17',
    patient: {
      id: 'patient-1',
      fullName: 'Paciente Teste',
      birthDate: '1970-01-01',
      routines: [],
      prescriptions: [],
    },
    status: 'ACTIVE',
    items: items.map((item) => ({
      ...item,
      prescription: undefined as unknown as Prescription,
    })),
  } as Prescription;
}

function buildItem(
  overrides: Partial<PrescriptionItem> = {},
): PrescriptionItem {
  const group = buildGroup();
  const { medication: medicationOverride, ...itemOverrides } = overrides;
  const medication = buildMedication(group, medicationOverride);

  return {
    id: `item-${Math.random().toString(16).slice(2)}`,
    frequency: 1,
    doseAmount: '1 COMP',
    recurrenceType: TreatmentRecurrence.DAILY,
    doseValue: '1',
    doseUnit: DoseUnit.COMP,
    sameDosePerSchedule: true,
    perDoseOverrides: undefined,
    dailyTreatment: true,
    alternateDaysInterval: undefined,
    weeklyDay: undefined,
    monthlyRule: undefined,
    monthlyDay: undefined,
    treatmentDays: 10,
    continuousUse: false,
    prnReason: undefined,
    crisisOnly: false,
    feverOnly: false,
    painOnly: false,
    manualAdjustmentEnabled: false,
    manualTimes: undefined,
    schedules: [],
    ...itemOverrides,
    medication,
  } as PrescriptionItem;
}

function buildGroup(): MedicationGroup {
  return {
    id: 'group-1',
    code: GroupCode.GROUP_I,
    name: 'Grupo I',
    description: 'Grupo de teste',
    medications: [],
  };
}

function buildMedication(
  group: MedicationGroup,
  overrides: Partial<MedicationCatalog> = {},
): MedicationCatalog {
  return {
    id: 'medication-1',
    commercialName: 'Medicamento Teste',
    activePrinciple: 'Principio ativo',
    presentation: 'Caixa',
    administrationRoute: 'ORAL',
    usageInstructions: 'Conforme prescricao',
    interferesWithSalts: false,
    group,
    ...overrides,
  };
}

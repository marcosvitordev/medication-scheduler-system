import { ClinicalAnchor } from '../src/common/enums/clinical-anchor.enum';
import { ClinicalSemanticTag } from '../src/common/enums/clinical-semantic-tag.enum';
import { DoseUnit } from '../src/common/enums/dose-unit.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import {
  buildPhase,
  buildPrescriptionMedication,
  buildProtocolSnapshot,
  buildRoutine,
  buildScheduleResult,
  createSchedulingService,
  expectEntry,
  findEntriesByMedication,
  findEntriesByMedicationAndTime,
  findEntryByTime,
  findPhase,
} from './helpers/scheduling-test-helpers';

describe('SchedulingService non-oral PDF protocols', () => {
  const routine = buildRoutine({
    acordar: '06:00',
    cafe: '07:00',
    almoco: '13:00',
    lanche: '16:00',
    jantar: '19:00',
    dormir: '21:00',
  });

  it('schedules Metronidazol gel vaginal at 20:40 with an explicit vaginal protocol snapshot', async () => {
    const { service } = createSchedulingService({ routine });

    const metronidazol = buildPrescriptionMedication({
      medicationSnapshot: {
        commercialName: 'METRONIDAZOL',
        activePrinciple: 'Metronidazol 100mg/g',
        presentation: 'Gel vaginal 50 g',
        administrationRoute: 'VIA VAGINAL',
        usageInstructions:
          'Introduzir o aplicador profundamente na cavidade vaginal antes de dormir.',
      },
      protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_DELTA, {
        code: 'DELTA_METRONIDAZOL_VAGINAL',
        name: 'Metronidazol vaginal',
        frequencies: [
          {
            frequency: 1,
            steps: [
              {
                doseLabel: 'D1',
                anchor: ClinicalAnchor.DORMIR,
                offsetMinutes: -20,
                semanticTag: ClinicalSemanticTag.BEDTIME_EQUIVALENT,
              },
            ],
          },
        ],
      }),
      phases: [
        buildPhase({
          frequency: 1,
          doseAmount: '1 APLICADOR',
          doseValue: '1',
          doseUnit: DoseUnit.APLICADOR,
          treatmentDays: 5,
        }),
      ],
    });

    const result = await buildScheduleResult(service, [metronidazol], {
      startedAt: '2026-02-20',
    });

    expect(findEntryByTime(result, 'METRONIDAZOL', '06:00')).toBeUndefined();
    expectEntry(findEntryByTime(result, 'METRONIDAZOL', '20:40'), {
      administrationLabel: '1 APLICADOR',
      recurrenceLabel: 'Diario',
      startDate: '2026-02-20',
      endDate: '2026-02-24',
    });
    expect(findEntriesByMedication(result, 'METRONIDAZOL')).toHaveLength(1);
    expect(findEntriesByMedicationAndTime(result, 'METRONIDAZOL', '20:40')).toHaveLength(1);
  });

  it('schedules Cetoconazol creme at 13:00 with an explicit topical protocol snapshot', async () => {
    const { service } = createSchedulingService({ routine });

    const cetoconazol = buildPrescriptionMedication({
      medicationSnapshot: {
        commercialName: 'CETOCONAZOL',
        activePrinciple: 'Cetoconazol 20mg/g',
        presentation: 'Creme 30 g',
        administrationRoute: 'USO TOPICO',
        usageInstructions:
          'Cetoconazol creme deve ser aplicado nas areas infectadas uma vez ao dia.',
      },
      protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_DELTA, {
        code: 'DELTA_CETOCONAZOL_TOPICO',
        name: 'Cetoconazol topico',
        frequencies: [
          {
            frequency: 1,
            steps: [
              {
                doseLabel: 'D1',
                anchor: ClinicalAnchor.ALMOCO,
                offsetMinutes: 0,
                semanticTag: ClinicalSemanticTag.STANDARD,
              },
            ],
          },
        ],
      }),
      phases: [
        buildPhase({
          frequency: 1,
          doseAmount: 'AREA AFETADA',
          doseValue: undefined,
          doseUnit: undefined,
          treatmentDays: 30,
        }),
      ],
    });

    const result = await buildScheduleResult(service, [cetoconazol], {
      startedAt: '2026-02-20',
    });

    expect(findEntryByTime(result, 'CETOCONAZOL', '06:00')).toBeUndefined();
    expectEntry(findEntryByTime(result, 'CETOCONAZOL', '13:00'), {
      administrationLabel: 'AREA AFETADA',
      recurrenceLabel: 'Diario',
      startDate: '2026-02-20',
      endDate: '2026-03-21',
    });
    expect(findEntriesByMedication(result, 'CETOCONAZOL')).toHaveLength(1);
    expect(findEntriesByMedicationAndTime(result, 'CETOCONAZOL', '13:00')).toHaveLength(1);
  });

  it('allows two GROUP_DELTA medications with frequency 1 to resolve to different times because their protocol snapshots differ', async () => {
    const { service } = createSchedulingService({ routine });

    const metronidazol = buildPrescriptionMedication({
      medicationSnapshot: {
        commercialName: 'METRONIDAZOL',
        activePrinciple: 'Metronidazol 100mg/g',
        presentation: 'Gel vaginal 50 g',
        administrationRoute: 'VIA VAGINAL',
        usageInstructions: 'Uso vaginal.',
      },
      protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_DELTA, {
        code: 'DELTA_METRONIDAZOL_VAGINAL',
        frequencies: [
          {
            frequency: 1,
            steps: [
              {
                doseLabel: 'D1',
                anchor: ClinicalAnchor.DORMIR,
                offsetMinutes: -20,
                semanticTag: ClinicalSemanticTag.BEDTIME_EQUIVALENT,
              },
            ],
          },
        ],
      }),
      phases: [
        buildPhase({
          frequency: 1,
          doseAmount: '1 APLICADOR',
          doseValue: '1',
          doseUnit: DoseUnit.APLICADOR,
          treatmentDays: 5,
        }),
      ],
    });

    const cetoconazol = buildPrescriptionMedication({
      medicationSnapshot: {
        commercialName: 'CETOCONAZOL',
        activePrinciple: 'Cetoconazol 20mg/g',
        presentation: 'Creme 30 g',
        administrationRoute: 'USO TOPICO',
        usageInstructions: 'Uso topico.',
      },
      protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_DELTA, {
        code: 'DELTA_CETOCONAZOL_TOPICO',
        frequencies: [
          {
            frequency: 1,
            steps: [
              {
                doseLabel: 'D1',
                anchor: ClinicalAnchor.ALMOCO,
                offsetMinutes: 0,
                semanticTag: ClinicalSemanticTag.STANDARD,
              },
            ],
          },
        ],
      }),
      phases: [
        buildPhase({
          frequency: 1,
          doseAmount: 'AREA AFETADA',
          doseValue: undefined,
          doseUnit: undefined,
          treatmentDays: 30,
        }),
      ],
    });

    const result = await buildScheduleResult(service, [metronidazol, cetoconazol]);

    expectEntry(findEntryByTime(result, 'METRONIDAZOL', '20:40'), {
      administrationLabel: '1 APLICADOR',
    });
    expectEntry(findEntryByTime(result, 'CETOCONAZOL', '13:00'), {
      administrationLabel: 'AREA AFETADA',
    });
    expect(findEntryByTime(result, 'METRONIDAZOL', '06:00')).toBeUndefined();
    expect(findEntryByTime(result, 'CETOCONAZOL', '06:00')).toBeUndefined();
    expect(findEntriesByMedication(result, 'METRONIDAZOL')).toHaveLength(1);
    expect(findEntriesByMedication(result, 'CETOCONAZOL')).toHaveLength(1);
  });

  it('does not behave as if every GROUP_DELTA frequency-1 medication belongs at wake-up anymore', async () => {
    const { service } = createSchedulingService({ routine });

    const metronidazol = buildPrescriptionMedication({
      medicationSnapshot: {
        commercialName: 'METRONIDAZOL',
        activePrinciple: 'Metronidazol 100mg/g',
        presentation: 'Gel vaginal 50 g',
        administrationRoute: 'VIA VAGINAL',
        usageInstructions: 'Uso vaginal.',
      },
      protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_DELTA, {
        code: 'DELTA_METRONIDAZOL_VAGINAL',
        frequencies: [
          {
            frequency: 1,
            steps: [
              {
                doseLabel: 'D1',
                anchor: ClinicalAnchor.DORMIR,
                offsetMinutes: -20,
                semanticTag: ClinicalSemanticTag.BEDTIME_EQUIVALENT,
              },
            ],
          },
        ],
      }),
      phases: [
        buildPhase({
          frequency: 1,
          doseAmount: '1 APLICADOR',
          doseValue: '1',
          doseUnit: DoseUnit.APLICADOR,
          treatmentDays: 5,
        }),
      ],
    });

    const result = await buildScheduleResult(service, [metronidazol]);

    expect(findEntryByTime(result, 'METRONIDAZOL', '06:00')).toBeUndefined();
    expectEntry(findEntryByTime(result, 'METRONIDAZOL', '20:40'), {
      administrationLabel: '1 APLICADOR',
    });
    expect(findEntriesByMedication(result, 'METRONIDAZOL')).toHaveLength(1);
  });

  it('supports non-oral phased protocol changes with chained dates and distinct per-phase formulas', async () => {
    const { service } = createSchedulingService({ routine });

    const metronidazol = buildPrescriptionMedication({
      medicationSnapshot: {
        commercialName: 'METRONIDAZOL',
        activePrinciple: 'Metronidazol 100mg/g',
        presentation: 'Gel vaginal 50 g',
        administrationRoute: 'VIA VAGINAL',
        usageInstructions: 'Conforme fase.',
      },
      protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_DELTA, {
        code: 'DELTA_METRONIDAZOL_FASES',
        frequencies: [
          {
            frequency: 1,
            steps: [
              {
                doseLabel: 'D1',
                anchor: ClinicalAnchor.DORMIR,
                offsetMinutes: -20,
                semanticTag: ClinicalSemanticTag.BEDTIME_EQUIVALENT,
              },
            ],
          },
          {
            frequency: 2,
            steps: [
              {
                doseLabel: 'D1',
                anchor: ClinicalAnchor.ALMOCO,
                offsetMinutes: 0,
                semanticTag: ClinicalSemanticTag.STANDARD,
              },
              {
                doseLabel: 'D2',
                anchor: ClinicalAnchor.DORMIR,
                offsetMinutes: -20,
                semanticTag: ClinicalSemanticTag.BEDTIME_EQUIVALENT,
              },
            ],
          },
        ],
      }),
      phases: [
        buildPhase({
          phaseOrder: 1,
          frequency: 1,
          doseAmount: '1 APLICADOR',
          doseValue: '1',
          doseUnit: DoseUnit.APLICADOR,
          treatmentDays: 5,
        }),
        buildPhase({
          phaseOrder: 2,
          frequency: 2,
          doseAmount: '1 APLICADOR',
          doseValue: '1',
          doseUnit: DoseUnit.APLICADOR,
          treatmentDays: 5,
        }),
      ],
    });

    const result = await buildScheduleResult(service, [metronidazol], {
      startedAt: '2026-02-20',
    });

    const phase1 = findPhase(result, 'METRONIDAZOL', 1);
    const phase2 = findPhase(result, 'METRONIDAZOL', 2);

    expect(phase1).toMatchObject({
      startDate: '2026-02-20',
      endDate: '2026-02-24',
    });
    expect(phase1?.entries.map((entry) => entry.timeFormatted)).toEqual(['20:40']);

    expect(phase2).toMatchObject({
      startDate: '2026-02-25',
      endDate: '2026-03-01',
    });
    expect(phase2?.entries.map((entry) => entry.timeFormatted)).toEqual(['13:00', '20:40']);
  });
});

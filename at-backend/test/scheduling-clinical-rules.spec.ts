import 'reflect-metadata';
import { UnprocessableEntityException } from '@nestjs/common';
import { ClinicalAnchor } from '../src/common/enums/clinical-anchor.enum';
import { ClinicalSemanticTag } from '../src/common/enums/clinical-semantic-tag.enum';
import { DoseUnit } from '../src/common/enums/dose-unit.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import { PrnReason } from '../src/common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../src/common/enums/treatment-recurrence.enum';
import {
  buildPhase,
  buildPrescriptionMedication,
  buildProtocolSnapshot,
  buildRoutine,
  buildScheduleResult,
  createSchedulingService,
  findEntryByTime,
  flattenEntries,
} from './helpers/scheduling-test-helpers';

describe('SchedulingService clinical rules', () => {
  let service: ReturnType<typeof createSchedulingService>['service'];

  beforeEach(() => {
    ({ service } = createSchedulingService());
  });

  it('builds a daily treatment for 10 days with treatment window metadata', async () => {
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        phases: [buildPhase({ treatmentDays: 10 })],
      }),
    ]);

    const entry = flattenEntries(result)[0];
    expect(entry).toMatchObject({
      recurrenceType: TreatmentRecurrence.DAILY,
      recurrenceLabel: 'Diario',
      startDate: '2026-04-17',
      endDate: '2026-04-26',
    });
  });

  it('builds continuous-use metadata without endDate', async () => {
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        phases: [buildPhase({ continuousUse: true, treatmentDays: undefined })],
      }),
    ]);

    const entry = flattenEntries(result)[0];
    expect(entry.continuousUse).toBe(true);
    expect(entry.endDate).toBeUndefined();
    expect(entry.recurrenceLabel).toBe('Uso continuo');
  });

  it('builds weekly recurrence metadata', async () => {
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        phases: [
          buildPhase({
            recurrenceType: TreatmentRecurrence.WEEKLY,
            weeklyDay: 'SEGUNDA',
          }),
        ],
      }),
    ]);

    expect(flattenEntries(result)[0]).toMatchObject({
      recurrenceType: TreatmentRecurrence.WEEKLY,
      weeklyDay: 'SEGUNDA',
      recurrenceLabel: 'Semanal em SEGUNDA',
    });
  });

  it('builds monthly recurrence metadata', async () => {
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        phases: [
          buildPhase({
            recurrenceType: TreatmentRecurrence.MONTHLY,
            monthlyDay: 8,
          }),
        ],
      }),
    ]);

    expect(flattenEntries(result)[0]).toMatchObject({
      recurrenceType: TreatmentRecurrence.MONTHLY,
      monthlyDay: 8,
      recurrenceLabel: 'Mensal no dia 8',
    });
  });

  it('builds alternate-days recurrence metadata', async () => {
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        phases: [
          buildPhase({
            recurrenceType: TreatmentRecurrence.ALTERNATE_DAYS,
            alternateDaysInterval: 2,
          }),
        ],
      }),
    ]);

    expect(flattenEntries(result)[0]).toMatchObject({
      recurrenceType: TreatmentRecurrence.ALTERNATE_DAYS,
      alternateDaysInterval: 2,
      recurrenceLabel: 'A cada 2 dias',
    });
  });

  it('marks PRN treatments with explicit clinical instruction', async () => {
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        phases: [
          buildPhase({
            recurrenceType: TreatmentRecurrence.PRN,
            prnReason: PrnReason.FEVER,
            treatmentDays: undefined,
          }),
        ],
      }),
    ]);

    expect(flattenEntries(result)[0]).toMatchObject({
      isPrn: true,
      prnReason: PrnReason.FEVER,
      recurrenceLabel: 'Se necessario: fever',
      clinicalInstructionLabel: 'Uso se necessario em caso de febre.',
    });
  });

  it('builds PRN labels for nausea and vomiting reason', async () => {
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        phases: [
          buildPhase({
            recurrenceType: TreatmentRecurrence.PRN,
            prnReason: PrnReason.NAUSEA_VOMITING,
            treatmentDays: undefined,
          }),
        ],
      }),
    ]);

    expect(flattenEntries(result)[0]).toMatchObject({
      isPrn: true,
      prnReason: PrnReason.NAUSEA_VOMITING,
      recurrenceLabel: 'Se necessario: nausea_and_vomiting',
      clinicalInstructionLabel: 'Uso se necessario em caso de náusea e vômito.',
    });
  });

  it('exposes structured time metadata for frontend rendering without inferring anchors', async () => {
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I, {
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: ClinicalAnchor.CAFE,
                  offsetMinutes: 0,
                  semanticTag: ClinicalSemanticTag.STANDARD,
                },
              ],
            },
          ],
        }),
      }),
    ]);

    expect(flattenEntries(result)[0]).toMatchObject({
      timeContext: {
        anchor: ClinicalAnchor.CAFE,
        anchorTimeInMinutes: 420,
        offsetMinutes: 0,
        semanticTag: ClinicalSemanticTag.STANDARD,
        originalTimeInMinutes: 420,
        originalTimeFormatted: '07:00',
        resolvedTimeInMinutes: 420,
        resolvedTimeFormatted: '07:00',
      },
    });
  });

  it('keeps the same clinical dose across all schedules when sameDosePerSchedule is true', async () => {
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I, {
          frequencies: [
            {
              frequency: 2,
              steps: [
                { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0, semanticTag: ClinicalSemanticTag.STANDARD },
                { doseLabel: 'D2', anchor: ClinicalAnchor.JANTAR, offsetMinutes: 0, semanticTag: ClinicalSemanticTag.STANDARD },
              ],
            },
          ],
        }),
        phases: [
          buildPhase({
            frequency: 2,
            sameDosePerSchedule: true,
            doseValue: '1',
            doseUnit: DoseUnit.COMP,
          }),
        ],
      }),
    ]);

    expect(flattenEntries(result).map((entry) => entry.administrationLabel)).toEqual([
      '1 COMP',
      '1 COMP',
    ]);
  });

  it('uses per-dose overrides when the dose varies by phase schedule', async () => {
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I, {
          frequencies: [
            {
              frequency: 2,
              steps: [
                { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0, semanticTag: ClinicalSemanticTag.STANDARD },
                { doseLabel: 'D2', anchor: ClinicalAnchor.JANTAR, offsetMinutes: 0, semanticTag: ClinicalSemanticTag.STANDARD },
              ],
            },
          ],
        }),
        phases: [
          buildPhase({
            frequency: 2,
            sameDosePerSchedule: false,
            perDoseOverrides: [
              { doseLabel: 'D1', doseValue: '1', doseUnit: DoseUnit.COMP },
              { doseLabel: 'D2', doseValue: '2', doseUnit: DoseUnit.COMP },
            ],
          }),
        ],
      }),
    ]);

    expect(flattenEntries(result).map((entry) => entry.administrationLabel)).toEqual([
      '1 COMP',
      '2 COMP',
    ]);
  });

  it('respects coherent manual schedule times', async () => {
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        phases: [
          buildPhase({
            frequency: 2,
            manualAdjustmentEnabled: true,
            manualTimes: ['08:15', '20:45'],
          }),
        ],
      }),
    ]);

    expect(flattenEntries(result).map((entry) => entry.timeFormatted)).toEqual([
      '08:15',
      '20:45',
    ]);
    expect(flattenEntries(result).map((entry) => entry.timeContext.anchor)).toEqual([
      ClinicalAnchor.MANUAL,
      ClinicalAnchor.MANUAL,
    ]);
    expect(flattenEntries(result).map((entry) => entry.timeContext.offsetMinutes)).toEqual([
      0,
      0,
    ]);
    expect(result.scheduleItems[0].modoUso).toContain('Horários definidos manualmente.');
  });

  it('normalizes coherent manual times across midnight without collapsing 24:00', async () => {
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        phases: [
          buildPhase({
            frequency: 4,
            manualAdjustmentEnabled: true,
            manualTimes: ['06:00', '12:00', '18:00', '24:00'],
          }),
        ],
      }),
    ]);

    expect(flattenEntries(result).map((entry) => entry.timeFormatted)).toEqual([
      '06:00',
      '12:00',
      '18:00',
      '24:00',
    ]);
    expect(flattenEntries(result).map((entry) => entry.timeContext.resolvedTimeInMinutes)).toEqual([
      360,
      720,
      1080,
      1440,
    ]);
  });

  it('keeps clinical ordering when dormir belongs to the next day', async () => {
    const { service: midnightService } = createSchedulingService({
      routine: buildRoutine({
        acordar: '05:00',
        cafe: '07:00',
        almoco: '12:00',
        lanche: '16:00',
        jantar: '19:00',
        dormir: '01:00',
      }),
    });

    const result = await buildScheduleResult(midnightService, [
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: 'LOSARTANA' },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
        phases: [buildPhase({ frequency: 3 })],
      }),
    ]);

    expect(flattenEntries(result).map((entry) => entry.timeFormatted)).toEqual([
      '07:00',
      '16:00',
      '01:00',
    ]);
    expect(flattenEntries(result).map((entry) => entry.timeContext.resolvedTimeInMinutes)).toEqual([
      420,
      960,
      1500,
    ]);
  });

  it('keeps D4 at 24:00 for the canonical 6/6h scheme', async () => {
    const { service: midnightBoundaryService } = createSchedulingService({
      routine: buildRoutine({
        acordar: '06:00',
        cafe: '07:00',
        almoco: '12:00',
        lanche: '16:00',
        jantar: '21:00',
        dormir: '24:00',
      }),
    });

    const result = await buildScheduleResult(midnightBoundaryService, [
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: 'DORALGINA' },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
        phases: [buildPhase({ frequency: 4, treatmentDays: 6 })],
      }),
    ]);

    expect(flattenEntries(result).map((entry) => entry.timeFormatted)).toEqual([
      '06:00',
      '12:00',
      '18:00',
      '24:00',
    ]);
    expect(findEntryByTime(result, 'DORALGINA', '24:00')).toBeDefined();
  });

  it('fails with a domain exception when no formula exists for the requested frequency', async () => {
    await expect(
      buildScheduleResult(service, [
        buildPrescriptionMedication({
          phases: [buildPhase({ frequency: 99 })],
        }),
      ]),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('keeps green references for GROUP_I, GROUP_II_BIFOS and GROUP_III_MET in the new snapshot model', async () => {
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: 'LOSARTANA' },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
      }),
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: 'ALENDRONATO' },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_II_BIFOS),
      }),
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: 'GLIFAGE' },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III_MET),
        phases: [buildPhase({ frequency: 3 })],
      }),
    ]);

    expect(findEntryByTime(result, 'LOSARTANA', '07:00')).toBeDefined();
    expect(findEntryByTime(result, 'ALENDRONATO', '05:00')).toBeDefined();
    expect(findEntryByTime(result, 'GLIFAGE', '12:00')).toBeDefined();
  });
});

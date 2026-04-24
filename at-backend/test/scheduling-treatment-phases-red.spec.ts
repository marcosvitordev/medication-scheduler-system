import { ClinicalAnchor } from '../src/common/enums/clinical-anchor.enum';
import { ClinicalSemanticTag } from '../src/common/enums/clinical-semantic-tag.enum';
import { DoseUnit } from '../src/common/enums/dose-unit.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import { TreatmentRecurrence } from '../src/common/enums/treatment-recurrence.enum';
import {
  buildPhase,
  buildPrescriptionMedication,
  buildProtocolSnapshot,
  buildRoutine,
  buildScheduleResult,
  createSchedulingService,
  findEntriesByMedication,
  findEntriesByMedicationAndTime,
  findMedication,
  findPhase,
} from './helpers/scheduling-test-helpers';

describe('SchedulingService phased treatments from PDF', () => {
  it('exposes four CONTRAVE phases with chained dates, frequencies and per-dose values', async () => {
    const { service } = createSchedulingService({
      routine: buildRoutine({
        acordar: '06:00',
        cafe: '07:00',
        almoco: '13:00',
        lanche: '16:00',
        jantar: '19:00',
        dormir: '21:00',
      }),
    });

    const contrave = buildPrescriptionMedication({
      medicationSnapshot: {
        commercialName: 'CONTRAVE',
        activePrinciple: 'Naltrexona 8 mg + Bupropiona 90 mg',
        presentation: 'Comprimido revestido de liberacao prolongada',
        administrationRoute: 'VO',
        usageInstructions:
          'Utilizar junto com as refeicoes e ajustar a posologia ao longo das semanas.',
      },
      protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III, {
        code: 'GROUP_III_CONTRAVE',
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
          {
            frequency: 2,
            steps: [
              {
                doseLabel: 'D1',
                anchor: ClinicalAnchor.CAFE,
                offsetMinutes: 0,
                semanticTag: ClinicalSemanticTag.STANDARD,
              },
              {
                doseLabel: 'D2',
                anchor: ClinicalAnchor.JANTAR,
                offsetMinutes: 0,
                semanticTag: ClinicalSemanticTag.STANDARD,
              },
            ],
          },
        ],
      }),
      phases: [
        buildPhase({
          phaseOrder: 1,
          frequency: 1,
          sameDosePerSchedule: true,
          doseAmount: '1 COMP',
          doseValue: '1',
          doseUnit: DoseUnit.COMP,
          recurrenceType: TreatmentRecurrence.DAILY,
          treatmentDays: 7,
        }),
        buildPhase({
          phaseOrder: 2,
          frequency: 2,
          sameDosePerSchedule: true,
          doseAmount: '1 COMP',
          doseValue: '1',
          doseUnit: DoseUnit.COMP,
          recurrenceType: TreatmentRecurrence.DAILY,
          treatmentDays: 7,
        }),
        buildPhase({
          phaseOrder: 3,
          frequency: 2,
          sameDosePerSchedule: false,
          perDoseOverrides: [
            { doseLabel: 'D1', doseValue: '2', doseUnit: DoseUnit.COMP },
            { doseLabel: 'D2', doseValue: '1', doseUnit: DoseUnit.COMP },
          ],
          recurrenceType: TreatmentRecurrence.DAILY,
          treatmentDays: 7,
        }),
        buildPhase({
          phaseOrder: 4,
          frequency: 2,
          sameDosePerSchedule: true,
          doseAmount: '2 COMP',
          doseValue: '2',
          doseUnit: DoseUnit.COMP,
          recurrenceType: TreatmentRecurrence.DAILY,
          continuousUse: true,
          treatmentDays: undefined,
        }),
      ],
    });

    const result = await buildScheduleResult(service, [contrave], {
      startedAt: '2026-02-20',
    });

    const medication = findMedication(result, 'CONTRAVE');
    expect(medication?.phases).toHaveLength(4);
    expect(medication?.phases.map((phase) => phase.phaseOrder)).toEqual([1, 2, 3, 4]);

    expect(findPhase(result, 'CONTRAVE', 1)).toMatchObject({
      phaseOrder: 1,
      startDate: '2026-02-20',
      endDate: '2026-02-26',
      entries: [{ timeFormatted: '07:00', administrationLabel: '1 COMP' }],
    });
    expect(findPhase(result, 'CONTRAVE', 1)?.entries).toHaveLength(1);
    expect(findPhase(result, 'CONTRAVE', 2)).toMatchObject({
      phaseOrder: 2,
      startDate: '2026-02-27',
      endDate: '2026-03-05',
      entries: [
        { timeFormatted: '07:00', administrationLabel: '1 COMP' },
        { timeFormatted: '19:00', administrationLabel: '1 COMP' },
      ],
    });
    expect(findPhase(result, 'CONTRAVE', 2)?.entries).toHaveLength(2);
    expect(findPhase(result, 'CONTRAVE', 3)).toMatchObject({
      phaseOrder: 3,
      startDate: '2026-03-06',
      endDate: '2026-03-12',
      entries: [
        { doseLabel: 'D1', timeFormatted: '07:00', administrationLabel: '2 COMP' },
        { doseLabel: 'D2', timeFormatted: '19:00', administrationLabel: '1 COMP' },
      ],
    });
    expect(findPhase(result, 'CONTRAVE', 3)?.entries).toHaveLength(2);
    expect(findPhase(result, 'CONTRAVE', 4)).toMatchObject({
      phaseOrder: 4,
      startDate: '2026-03-13',
      endDate: undefined,
      entries: [
        { timeFormatted: '07:00', administrationLabel: '2 COMP' },
        { timeFormatted: '19:00', administrationLabel: '2 COMP' },
      ],
    });
    expect(findPhase(result, 'CONTRAVE', 4)?.entries).toHaveLength(2);
    expect(findEntriesByMedication(result, 'CONTRAVE')).toHaveLength(7);
  });

  it('keeps the last phase open-ended when it becomes continuous use', async () => {
    const { service } = createSchedulingService();

    const result = await buildScheduleResult(
      service,
      [
        buildPrescriptionMedication({
          medicationSnapshot: {
            commercialName: 'CONTRAVE',
            activePrinciple: 'Naltrexona 8 mg + Bupropiona 90 mg',
            presentation: 'Comprimido',
            administrationRoute: 'VO',
            usageInstructions: 'Conforme protocolo.',
          },
          protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III),
          phases: [
            buildPhase({
              phaseOrder: 4,
              frequency: 2,
              sameDosePerSchedule: true,
              doseAmount: '2 COMP',
              doseValue: '2',
              doseUnit: DoseUnit.COMP,
              continuousUse: true,
              treatmentDays: undefined,
            }),
          ],
        }),
      ],
      { startedAt: '2026-03-15' },
    );

    expect(findPhase(result, 'CONTRAVE', 4)).toMatchObject({
      phaseOrder: 4,
      startDate: '2026-03-15',
      endDate: undefined,
    });
  });

  it('starts each next phase on the day immediately after the previous phase ends', async () => {
    const { service } = createSchedulingService();

    const result = await buildScheduleResult(
      service,
      [
        buildPrescriptionMedication({
          medicationSnapshot: {
            commercialName: 'CONTRAVE',
            activePrinciple: 'Naltrexona 8 mg + Bupropiona 90 mg',
            presentation: 'Comprimido',
            administrationRoute: 'VO',
            usageInstructions: 'Conforme protocolo.',
          },
          protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III),
          phases: [
            buildPhase({
              phaseOrder: 1,
              frequency: 1,
              doseAmount: '1 COMP',
              doseValue: '1',
              doseUnit: DoseUnit.COMP,
              treatmentDays: 7,
            }),
            buildPhase({
              phaseOrder: 2,
              frequency: 2,
              doseAmount: '1 COMP',
              doseValue: '1',
              doseUnit: DoseUnit.COMP,
              treatmentDays: 7,
            }),
          ],
        }),
      ],
      { startedAt: '2026-02-20' },
    );

    expect(findPhase(result, 'CONTRAVE', 1)?.endDate).toBe('2026-02-26');
    expect(findPhase(result, 'CONTRAVE', 2)?.startDate).toBe('2026-02-27');
  });

  it('requires D1 and D2 administration labels inside a phase when sameDosePerSchedule is false', async () => {
    const { service } = createSchedulingService();

    const result = await buildScheduleResult(
      service,
      [
        buildPrescriptionMedication({
          medicationSnapshot: {
            commercialName: 'CONTRAVE',
            activePrinciple: 'Naltrexona 8 mg + Bupropiona 90 mg',
            presentation: 'Comprimido',
            administrationRoute: 'VO',
            usageInstructions: 'Conforme protocolo.',
          },
          protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III),
          phases: [
            buildPhase({
              phaseOrder: 3,
              frequency: 2,
              sameDosePerSchedule: false,
              perDoseOverrides: [
                { doseLabel: 'D1', doseValue: '2', doseUnit: DoseUnit.COMP },
                { doseLabel: 'D2', doseValue: '1', doseUnit: DoseUnit.COMP },
              ],
              treatmentDays: 7,
            }),
          ],
        }),
      ],
      { startedAt: '2026-03-07' },
    );

    expect(findPhase(result, 'CONTRAVE', 3)).toMatchObject({
      entries: [
        { doseLabel: 'D1', administrationLabel: '2 COMP' },
        { doseLabel: 'D2', administrationLabel: '1 COMP' },
      ],
    });
    expect(findPhase(result, 'CONTRAVE', 3)?.entries).toHaveLength(2);
    expect(findPhase(result, 'CONTRAVE', 3)?.entries.map((entry) => entry.doseLabel)).toEqual([
      'D1',
      'D2',
    ]);
  });

  it('keeps deterministic ordering for equal times by medication name in schedule output', async () => {
    const { service } = createSchedulingService();

    const medA = buildPrescriptionMedication({
      medicationSnapshot: {
        commercialName: 'AAA',
        activePrinciple: 'AAA',
        presentation: 'Comprimido',
        administrationRoute: 'VO',
        usageInstructions: 'Teste.',
      },
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
      phases: [buildPhase({ frequency: 1 })],
    });

    const medZ = buildPrescriptionMedication({
      medicationSnapshot: {
        commercialName: 'ZZZ',
        activePrinciple: 'ZZZ',
        presentation: 'Comprimido',
        administrationRoute: 'VO',
        usageInstructions: 'Teste.',
      },
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
      phases: [buildPhase({ frequency: 1 })],
    });

    const result = await buildScheduleResult(service, [medZ, medA], {
      startedAt: '2026-02-20',
    });

    const namesAt0700 = ['AAA', 'ZZZ'].filter(
      (name) => findEntriesByMedicationAndTime(result, name, '07:00').length > 0,
    );

    expect(namesAt0700).toEqual(['AAA', 'ZZZ']);
  });

  it('fails when an intermediate phase requests a frequency not present in protocol formulas', async () => {
    const { service } = createSchedulingService();

    await expect(
      buildScheduleResult(
        service,
        [
          buildPrescriptionMedication({
            medicationSnapshot: {
              commercialName: 'CONTRAVE',
              activePrinciple: 'Naltrexona + Bupropiona',
              presentation: 'Comprimido',
              administrationRoute: 'VO',
              usageInstructions: 'Conforme protocolo.',
            },
            protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III, {
              code: 'GROUP_III_GAP',
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
                {
                  frequency: 2,
                  steps: [
                    {
                      doseLabel: 'D1',
                      anchor: ClinicalAnchor.CAFE,
                      offsetMinutes: 0,
                      semanticTag: ClinicalSemanticTag.STANDARD,
                    },
                    {
                      doseLabel: 'D2',
                      anchor: ClinicalAnchor.JANTAR,
                      offsetMinutes: 0,
                      semanticTag: ClinicalSemanticTag.STANDARD,
                    },
                  ],
                },
              ],
            }),
            phases: [
              buildPhase({ phaseOrder: 1, frequency: 1, treatmentDays: 7 }),
              buildPhase({ phaseOrder: 2, frequency: 3, treatmentDays: 7 }),
            ],
          }),
        ],
        { startedAt: '2026-02-20' },
      ),
    ).rejects.toBeDefined();
  });
});

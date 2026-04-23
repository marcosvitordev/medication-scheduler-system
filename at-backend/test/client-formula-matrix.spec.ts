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
  findEntriesByMedication,
} from './helpers/scheduling-test-helpers';

describe('Client requirement formula matrix', () => {
  const routine = buildRoutine({
    acordar: '06:00',
    cafe: '07:00',
    almoco: '13:00',
    lanche: '16:00',
    jantar: '19:00',
    dormir: '21:00',
  });

  async function expectFormula(
    groupCode: GroupCode,
    frequency: number,
    expected: Array<{
      doseLabel: string;
      timeFormatted: string;
      anchor: ClinicalAnchor;
      offsetMinutes: number;
    }>,
  ) {
    const { service } = createSchedulingService({ routine });
    const medicationName = `${groupCode} F${frequency}`;

    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: medicationName },
        protocolSnapshot: buildProtocolSnapshot(groupCode),
        phases: [
          buildPhase({
            frequency,
            doseAmount: '1 COMP',
            doseValue: '1',
            doseUnit: DoseUnit.COMP,
          }),
        ],
      }),
    ]);

    expect(
      findEntriesByMedication(result, medicationName).map((entry) => ({
        doseLabel: entry.doseLabel,
        timeFormatted: entry.timeFormatted,
        anchor: entry.timeContext.anchor,
        offsetMinutes: entry.timeContext.offsetMinutes,
      })),
    ).toEqual(expected);
  }

  async function expectProtocolFormula(
    medicationName: string,
    groupCode: GroupCode,
    protocolCode: string,
    frequencies: Array<{
      frequency: number;
      steps: Array<{
        doseLabel: string;
        anchor: ClinicalAnchor;
        offsetMinutes: number;
        semanticTag?: ClinicalSemanticTag;
      }>;
    }>,
    frequency: number,
    expected: Array<{
      doseLabel: string;
      timeFormatted: string;
      anchor: ClinicalAnchor;
      offsetMinutes: number;
    }>,
  ) {
    const { service } = createSchedulingService({ routine });
    const normalizedFrequencies = frequencies.map((protocolFrequency) => ({
      ...protocolFrequency,
      steps: protocolFrequency.steps.map((step) => ({
        ...step,
        semanticTag: step.semanticTag ?? ClinicalSemanticTag.STANDARD,
      })),
    }));

    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: medicationName },
        protocolSnapshot: buildProtocolSnapshot(groupCode, {
          code: protocolCode,
          frequencies: normalizedFrequencies,
        }),
        phases: [buildPhase({ frequency, doseValue: '1', doseUnit: DoseUnit.COMP })],
      }),
    ]);

    expect(
      findEntriesByMedication(result, medicationName).map((entry) => ({
        doseLabel: entry.doseLabel,
        timeFormatted: entry.timeFormatted,
        anchor: entry.timeContext.anchor,
        offsetMinutes: entry.timeContext.offsetMinutes,
      })),
    ).toEqual(expected);
  }

  it('matches GROUP_I formulas from the client document for frequencies 1..4', async () => {
    await expectFormula(GroupCode.GROUP_I, 1, [
      { doseLabel: 'D1', timeFormatted: '07:00', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
    ]);
    await expectFormula(GroupCode.GROUP_I, 2, [
      { doseLabel: 'D1', timeFormatted: '07:00', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
      { doseLabel: 'D2', timeFormatted: '19:00', anchor: ClinicalAnchor.JANTAR, offsetMinutes: 0 },
    ]);
    await expectFormula(GroupCode.GROUP_I, 3, [
      { doseLabel: 'D1', timeFormatted: '07:00', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
      { doseLabel: 'D2', timeFormatted: '16:00', anchor: ClinicalAnchor.LANCHE, offsetMinutes: 0 },
      { doseLabel: 'D3', timeFormatted: '21:00', anchor: ClinicalAnchor.DORMIR, offsetMinutes: 0 },
    ]);
    await expectFormula(GroupCode.GROUP_I, 4, [
      { doseLabel: 'D1', timeFormatted: '06:00', anchor: ClinicalAnchor.ACORDAR, offsetMinutes: 0 },
      { doseLabel: 'D2', timeFormatted: '12:00', anchor: ClinicalAnchor.ACORDAR, offsetMinutes: 360 },
      { doseLabel: 'D3', timeFormatted: '18:00', anchor: ClinicalAnchor.ACORDAR, offsetMinutes: 720 },
      { doseLabel: 'D4', timeFormatted: '24:00', anchor: ClinicalAnchor.ACORDAR, offsetMinutes: 1080 },
    ]);
  });

  it('matches fasting, metformin, salts, sucralfate, calcium and sedative formulas', async () => {
    await expectFormula(GroupCode.GROUP_II_BIFOS, 1, [
      { doseLabel: 'D1', timeFormatted: '05:00', anchor: ClinicalAnchor.ACORDAR, offsetMinutes: -60 },
    ]);
    await expectFormula(GroupCode.GROUP_III_MET, 3, [
      { doseLabel: 'D1', timeFormatted: '07:00', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
      { doseLabel: 'D2', timeFormatted: '13:00', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: 0 },
      { doseLabel: 'D3', timeFormatted: '19:00', anchor: ClinicalAnchor.JANTAR, offsetMinutes: 0 },
    ]);
    await expectFormula(GroupCode.GROUP_III_SAL, 3, [
      { doseLabel: 'D1', timeFormatted: '09:00', anchor: ClinicalAnchor.CAFE, offsetMinutes: 120 },
      { doseLabel: 'D2', timeFormatted: '15:00', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: 120 },
      { doseLabel: 'D3', timeFormatted: '21:00', anchor: ClinicalAnchor.DORMIR, offsetMinutes: 0 },
    ]);
    await expectFormula(GroupCode.GROUP_II_SUCRA, 2, [
      { doseLabel: 'D1', timeFormatted: '08:00', anchor: ClinicalAnchor.ACORDAR, offsetMinutes: 120 },
      { doseLabel: 'D2', timeFormatted: '21:00', anchor: ClinicalAnchor.DORMIR, offsetMinutes: 0 },
    ]);
    await expectFormula(GroupCode.GROUP_III_CALC, 2, [
      { doseLabel: 'D1', timeFormatted: '10:00', anchor: ClinicalAnchor.CAFE, offsetMinutes: 180 },
      { doseLabel: 'D2', timeFormatted: '21:00', anchor: ClinicalAnchor.DORMIR, offsetMinutes: 0 },
    ]);
    await expectFormula(GroupCode.GROUP_I_SED, 1, [
      { doseLabel: 'D1', timeFormatted: '20:40', anchor: ClinicalAnchor.DORMIR, offsetMinutes: -20 },
    ]);
  });

  it('matches the documented GROUP_II default protocol families', async () => {
    await expectProtocolFormula(
      'GROUP_II_WAKE',
      GroupCode.GROUP_II,
      'GROUP_II_WAKE',
      [
        { frequency: 1, steps: [{ doseLabel: 'D1', anchor: ClinicalAnchor.ACORDAR, offsetMinutes: 0 }] },
        {
          frequency: 2,
          steps: [
            { doseLabel: 'D1', anchor: ClinicalAnchor.ACORDAR, offsetMinutes: 0 },
            { doseLabel: 'D2', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -60 },
          ],
        },
        {
          frequency: 3,
          steps: [
            { doseLabel: 'D1', anchor: ClinicalAnchor.ACORDAR, offsetMinutes: 0 },
            { doseLabel: 'D2', anchor: ClinicalAnchor.LANCHE, offsetMinutes: -60 },
            { doseLabel: 'D3', anchor: ClinicalAnchor.DORMIR, offsetMinutes: 0 },
          ],
        },
      ],
      3,
      [
        { doseLabel: 'D1', timeFormatted: '06:00', anchor: ClinicalAnchor.ACORDAR, offsetMinutes: 0 },
        { doseLabel: 'D2', timeFormatted: '15:00', anchor: ClinicalAnchor.LANCHE, offsetMinutes: -60 },
        { doseLabel: 'D3', timeFormatted: '21:00', anchor: ClinicalAnchor.DORMIR, offsetMinutes: 0 },
      ],
    );
    await expectProtocolFormula(
      'GROUP_II_BEDTIME',
      GroupCode.GROUP_II,
      'GROUP_II_BEDTIME',
      [
        { frequency: 1, steps: [{ doseLabel: 'D1', anchor: ClinicalAnchor.DORMIR, offsetMinutes: 0 }] },
      ],
      1,
      [
        { doseLabel: 'D1', timeFormatted: '21:00', anchor: ClinicalAnchor.DORMIR, offsetMinutes: 0 },
      ],
    );
    await expectProtocolFormula(
      'GROUP_II_LUNCH_BEFORE',
      GroupCode.GROUP_II,
      'GROUP_II_LUNCH_BEFORE',
      [
        { frequency: 1, steps: [{ doseLabel: 'D1', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: -60 }] },
      ],
      1,
      [
        { doseLabel: 'D1', timeFormatted: '12:00', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: -60 },
      ],
    );
    await expectProtocolFormula(
      'GROUP_II_LUNCH_AFTER',
      GroupCode.GROUP_II,
      'GROUP_II_LUNCH_AFTER',
      [
        { frequency: 1, steps: [{ doseLabel: 'D1', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: 120 }] },
      ],
      1,
      [
        { doseLabel: 'D1', timeFormatted: '15:00', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: 120 },
      ],
    );
  });

  it('matches laxative, diuretic, sulfonylurea, procinetic, iron and insulin default formulas added from the document', async () => {
    await expectFormula(GroupCode.GROUP_III_LAX, 2, [
      { doseLabel: 'D1', timeFormatted: '09:00', anchor: ClinicalAnchor.CAFE, offsetMinutes: 120 },
      { doseLabel: 'D2', timeFormatted: '21:00', anchor: ClinicalAnchor.DORMIR, offsetMinutes: 0 },
    ]);
    await expectFormula(GroupCode.GROUP_III_ESTAT, 1, [
      { doseLabel: 'D1', timeFormatted: '19:00', anchor: ClinicalAnchor.JANTAR, offsetMinutes: 0 },
    ]);
    await expectFormula(GroupCode.GROUP_III_DIU, 2, [
      { doseLabel: 'D1', timeFormatted: '07:00', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
      { doseLabel: 'D2', timeFormatted: '16:00', anchor: ClinicalAnchor.LANCHE, offsetMinutes: 0 },
    ]);
    await expectFormula(GroupCode.GROUP_III_SUL, 3, [
      { doseLabel: 'D1', timeFormatted: '07:00', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
      { doseLabel: 'D2', timeFormatted: '13:00', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: 0 },
      { doseLabel: 'D3', timeFormatted: '19:00', anchor: ClinicalAnchor.JANTAR, offsetMinutes: 0 },
    ]);
    await expectFormula(GroupCode.GROUP_III_SUL2, 3, [
      { doseLabel: 'D1', timeFormatted: '06:30', anchor: ClinicalAnchor.CAFE, offsetMinutes: -30 },
      { doseLabel: 'D2', timeFormatted: '12:30', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: -30 },
      { doseLabel: 'D3', timeFormatted: '18:30', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -30 },
    ]);
    await expectFormula(GroupCode.GROUP_III_PROC, 3, [
      { doseLabel: 'D1', timeFormatted: '06:40', anchor: ClinicalAnchor.CAFE, offsetMinutes: -20 },
      { doseLabel: 'D2', timeFormatted: '12:40', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: -20 },
      { doseLabel: 'D3', timeFormatted: '18:40', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -20 },
    ]);
    await expectFormula(GroupCode.GROUP_III_FER, 1, [
      { doseLabel: 'D1', timeFormatted: '12:30', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: -30 },
    ]);
    await expectFormula(GroupCode.GROUP_INSUL_ULTRA, 4, [
      { doseLabel: 'D1', timeFormatted: '06:50', anchor: ClinicalAnchor.CAFE, offsetMinutes: -10 },
      { doseLabel: 'D2', timeFormatted: '12:50', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: -10 },
      { doseLabel: 'D3', timeFormatted: '15:50', anchor: ClinicalAnchor.LANCHE, offsetMinutes: -10 },
      { doseLabel: 'D4', timeFormatted: '18:50', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -10 },
    ]);
    await expectFormula(GroupCode.GROUP_INSUL_INTER, 2, [
      { doseLabel: 'D1', timeFormatted: '07:00', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
      { doseLabel: 'D2', timeFormatted: '19:00', anchor: ClinicalAnchor.JANTAR, offsetMinutes: 0 },
    ]);
    await expectFormula(GroupCode.GROUP_INSUL_LONGA, 1, [
      { doseLabel: 'D1', timeFormatted: '07:00', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
    ]);
  });

  it('matches rapid insulin formulas before meals', async () => {
    await expectFormula(GroupCode.GROUP_INSUL_RAPIDA, 4, [
      { doseLabel: 'D1', timeFormatted: '06:30', anchor: ClinicalAnchor.CAFE, offsetMinutes: -30 },
      { doseLabel: 'D2', timeFormatted: '12:30', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: -30 },
      { doseLabel: 'D3', timeFormatted: '15:30', anchor: ClinicalAnchor.LANCHE, offsetMinutes: -30 },
      { doseLabel: 'D4', timeFormatted: '18:30', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -30 },
    ]);
  });
});

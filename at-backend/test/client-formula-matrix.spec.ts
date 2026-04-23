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

  it('matches rapid insulin formulas before meals', async () => {
    const { service } = createSchedulingService({ routine });
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: 'GANSULIN R' },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_INSUL_RAPIDA, {
          frequencies: [
            {
              frequency: 4,
              steps: [
                { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: -30, semanticTag: ClinicalSemanticTag.STANDARD },
                { doseLabel: 'D2', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: -30, semanticTag: ClinicalSemanticTag.STANDARD },
                { doseLabel: 'D3', anchor: ClinicalAnchor.LANCHE, offsetMinutes: -30, semanticTag: ClinicalSemanticTag.STANDARD },
                { doseLabel: 'D4', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -30, semanticTag: ClinicalSemanticTag.STANDARD },
              ],
            },
          ],
        }),
        phases: [buildPhase({ frequency: 4, doseAmount: 'Conforme glicemia' })],
      }),
    ]);

    expect(findEntriesByMedication(result, 'GANSULIN R').map((entry) => entry.timeFormatted)).toEqual([
      '06:30',
      '12:30',
      '15:30',
      '18:30',
    ]);
  });
});

import 'reflect-metadata';
import { ClinicalAnchor } from '../src/common/enums/clinical-anchor.enum';
import { ClinicalSemanticTag } from '../src/common/enums/clinical-semantic-tag.enum';
import { ConflictMatchKind } from '../src/common/enums/conflict-match-kind.enum';
import { ConflictReasonCode } from '../src/common/enums/conflict-reason-code.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import { OcularLaterality } from '../src/common/enums/ocular-laterality.enum';
import { ScheduleStatus } from '../src/common/enums/schedule-status.enum';
import { ConflictResolutionService, ConflictEntryLike } from '../src/modules/scheduling/services/conflict-resolution.service';

describe('ConflictResolutionService', () => {
  function buildEntry(
    medicationName: string,
    groupCode: string,
    timeInMinutes: number,
    overrides: Partial<ConflictEntryLike> = {},
  ): ConflictEntryLike {
    return {
      stableKey: `${medicationName}:${groupCode}:${timeInMinutes}`,
      medicationName,
      groupCode,
      protocolCode: `${groupCode}_PROTO`,
      protocolPriority: 0,
      timeInMinutes,
      status: ScheduleStatus.ACTIVE,
      semanticTag: ClinicalSemanticTag.STANDARD,
      interactionRulesSnapshot: [],
      phaseDoseLabel: 'D1',
      timeContext: {
        anchor: ClinicalAnchor.MANUAL,
        anchorTimeInMinutes: timeInMinutes,
        offsetMinutes: 0,
        semanticTag: ClinicalSemanticTag.STANDARD,
        originalTimeInMinutes: timeInMinutes,
        originalTimeFormatted: '07:00',
        resolvedTimeInMinutes: timeInMinutes,
        resolvedTimeFormatted: '07:00',
      },
      shiftCount: 0,
      ...overrides,
    };
  }

  function buildOphthalmicEntry(
    medicationName: string,
    timeInMinutes: number,
    laterality = OcularLaterality.BOTH_EYES,
  ): ConflictEntryLike {
    return buildEntry(medicationName, GroupCode.GROUP_DELTA, timeInMinutes, {
      stableKey: `${medicationName}:ophthalmic:${timeInMinutes}`,
      isOphthalmic: true,
      ocularLaterality: laterality,
    });
  }

  it('marks the remaining unresolved entry with iteration-limit reason when the global pass limit is reached', () => {
    const service = new ConflictResolutionService();
    (service as unknown as { maxPassesMultiplier: number }).maxPassesMultiplier = 0;

    const entries = Array.from({ length: 9 }, (_, index) => {
      const timeInMinutes = 420 + index;
      return [
        buildEntry(`BLOCKER-${index}`, GroupCode.GROUP_II_BIFOS, timeInMinutes),
        buildEntry(`MOVABLE-${index}`, GroupCode.GROUP_I, timeInMinutes),
      ];
    }).flat();

    service.apply(entries);

    const movableEntries = entries.filter((entry) => entry.medicationName.startsWith('MOVABLE-'));
    expect(
      movableEntries.filter((entry) => entry.status === ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED),
    ).toHaveLength(9);

    const iterationLimitEntry = movableEntries.find(
      (entry) => entry.resolutionReasonCode === ConflictReasonCode.MANUAL_REQUIRED_ITERATION_LIMIT,
    );

    expect(iterationLimitEntry).toBeDefined();
    expect(iterationLimitEntry?.conflict).toMatchObject({
      matchKind: ConflictMatchKind.PRIORITY_BLOCK,
    });
  });

  it('shifts the second ophthalmic dose by five minutes on exact collision', () => {
    const service = new ConflictResolutionService();
    const entries = [
      buildOphthalmicEntry('XALACOM', 1260),
      buildOphthalmicEntry('OUTRO COLIRIO', 1260),
    ];

    service.apply(entries);

    expect(entries.map((entry) => [entry.medicationName, entry.timeInMinutes])).toEqual([
      ['XALACOM', 1260],
      ['OUTRO COLIRIO', 1265],
    ]);
    expect(entries[1]).toMatchObject({
      status: ScheduleStatus.ACTIVE,
      resolutionReasonCode: ConflictReasonCode.SHIFTED_BY_OPHTHALMIC_INTERVAL,
      conflict: expect.objectContaining({
        matchKind: ConflictMatchKind.EXACT_MINUTE,
        windowBeforeMinutes: 4,
        windowAfterMinutes: 4,
      }),
    });
  });

  it('shifts an ophthalmic clinical-window conflict to complete five minutes', () => {
    const service = new ConflictResolutionService();
    const entries = [
      buildOphthalmicEntry('XALACOM', 1260),
      buildOphthalmicEntry('OUTRO COLIRIO', 1264),
    ];

    service.apply(entries);

    expect(entries[1]).toMatchObject({
      timeInMinutes: 1265,
      resolutionReasonCode: ConflictReasonCode.SHIFTED_BY_OPHTHALMIC_INTERVAL,
      conflict: expect.objectContaining({
        matchKind: ConflictMatchKind.CLINICAL_WINDOW,
      }),
    });
  });

  it('keeps ophthalmic doses exactly five minutes apart unchanged', () => {
    const service = new ConflictResolutionService();
    const entries = [
      buildOphthalmicEntry('XALACOM', 1260),
      buildOphthalmicEntry('OUTRO COLIRIO', 1265),
    ];

    service.apply(entries);

    expect(entries.map((entry) => entry.timeInMinutes)).toEqual([1260, 1265]);
    expect(entries.every((entry) => entry.resolutionReasonCode === undefined)).toBe(true);
  });

  it('manualizes persistent ophthalmic conflict after revalidation', () => {
    const service = new ConflictResolutionService();
    const entries = [
      buildOphthalmicEntry('COLIRIO A', 1260),
      buildOphthalmicEntry('COLIRIO B', 1264),
      buildOphthalmicEntry('COLIRIO C', 1265),
    ];

    service.apply(entries);

    expect(entries[1]).toMatchObject({
      timeInMinutes: 1265,
      status: ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED,
      resolutionReasonCode: ConflictReasonCode.MANUAL_REQUIRED_OPHTHALMIC_INTERVAL,
      conflict: expect.objectContaining({
        matchKind: ConflictMatchKind.EXACT_MINUTE,
      }),
    });
  });

  it('applies ophthalmic interval even when eye lateralities differ', () => {
    const service = new ConflictResolutionService();
    const entries = [
      buildOphthalmicEntry('COLIRIO DIREITO', 1260, OcularLaterality.RIGHT_EYE),
      buildOphthalmicEntry('COLIRIO ESQUERDO', 1260, OcularLaterality.LEFT_EYE),
    ];

    service.apply(entries);

    expect(entries.map((entry) => entry.timeInMinutes)).toEqual([1260, 1265]);
    expect(entries[1].resolutionReasonCode).toBe(
      ConflictReasonCode.SHIFTED_BY_OPHTHALMIC_INTERVAL,
    );
  });
});

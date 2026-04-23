import 'reflect-metadata';
import { ClinicalAnchor } from '../src/common/enums/clinical-anchor.enum';
import { ClinicalSemanticTag } from '../src/common/enums/clinical-semantic-tag.enum';
import { ConflictMatchKind } from '../src/common/enums/conflict-match-kind.enum';
import { ConflictReasonCode } from '../src/common/enums/conflict-reason-code.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import { ScheduleStatus } from '../src/common/enums/schedule-status.enum';
import { ConflictResolutionService, ConflictEntryLike } from '../src/modules/scheduling/services/conflict-resolution.service';

describe('ConflictResolutionService', () => {
  function buildEntry(
    medicationName: string,
    groupCode: string,
    timeInMinutes: number,
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
    };
  }

  it('marks the remaining unresolved entry with iteration-limit reason when the global pass limit is reached', () => {
    const service = new ConflictResolutionService();
    (service as unknown as { maxPassesMultiplier: number }).maxPassesMultiplier = 0;

    const entries = Array.from({ length: 9 }, (_, index) => {
      const timeInMinutes = 420 + index;
      return [
        buildEntry(`BLOCKER-${index}`, GroupCode.GROUP_II_SUCRA, timeInMinutes),
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
});

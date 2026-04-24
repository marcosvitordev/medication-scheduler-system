import { Injectable } from '@nestjs/common';
import { ClinicalAnchor } from '../../../common/enums/clinical-anchor.enum';
import { GroupCode } from '../../../common/enums/group-code.enum';
import { ClinicalInteractionType } from '../../../common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../../../common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../../../common/enums/clinical-semantic-tag.enum';
import { ConflictMatchKind } from '../../../common/enums/conflict-match-kind.enum';
import { ConflictReasonCode } from '../../../common/enums/conflict-reason-code.enum';
import { OcularLaterality } from '../../../common/enums/ocular-laterality.enum';
import { ScheduleStatus } from '../../../common/enums/schedule-status.enum';
import { ClinicalInteractionRuleSnapshot } from '../../patient-prescriptions/entities/patient-prescription-snapshot.types';
import { ScheduleConflictDto, ResolvedScheduleTimeContextDto } from '../dto/schedule-response.dto';

const NON_MOVABLE_GROUPS = new Set<string>([
  GroupCode.GROUP_II,
  GroupCode.GROUP_II_BIFOS,
  GroupCode.GROUP_INSUL_ULTRA,
  GroupCode.GROUP_INSUL_RAPIDA,
  GroupCode.GROUP_INSUL_INTER,
  GroupCode.GROUP_INSUL_LONGA,
]);

const OPHTHALMIC_MIN_INTERVAL_MINUTES = 5;

type ConflictAnchors = Partial<Record<ClinicalAnchor, number>>;

export interface ConflictResolutionOptions {
  anchors?: ConflictAnchors;
}

interface ConflictPairSelection {
  adjustedEntry: ConflictEntryLike;
  blockerEntry: ConflictEntryLike;
  bothNonMovable: boolean;
}

interface RuleImpact {
  adjustedEntry: ConflictEntryLike;
  blockerEntry: ConflictEntryLike;
  ruleOwnerEntry?: ConflictEntryLike;
  rule?: ClinicalInteractionRuleSnapshot;
  resolutionType: ClinicalResolutionType;
  matchKind: ConflictMatchKind;
  rulePriority: number;
  policy?: 'OPHTHALMIC_MIN_INTERVAL';
}

export interface ConflictEntryLike {
  stableKey: string;
  medicationName: string;
  groupCode: string;
  protocolCode: string;
  protocolPriority: number;
  prescriptionMedicationId?: string;
  isOphthalmic?: boolean;
  ocularLaterality?: OcularLaterality;
  timeInMinutes: number;
  status: string;
  note?: string;
  semanticTag: ClinicalSemanticTag;
  interactionRulesSnapshot: ClinicalInteractionRuleSnapshot[];
  phaseDoseLabel: string;
  timeContext: ResolvedScheduleTimeContextDto;
  conflict?: ScheduleConflictDto;
  resolutionReasonCode?: ConflictReasonCode;
  resolutionReasonText?: string;
  shiftCount?: number;
  resolvedSucralfateBlockerKeys?: string[];
}

@Injectable()
export class ConflictResolutionService {
  private maxPassesMultiplier = 8;

  apply(entries: ConflictEntryLike[], options: ConflictResolutionOptions = {}): void {
    const maxPasses = Math.max(entries.length * this.maxPassesMultiplier, 8);

    for (let pass = 0; pass < maxPasses; pass += 1) {
      const impacts = this.detectConflicts(entries);
      if (impacts.length === 0) {
        return;
      }

      const changed = this.applyImpact(impacts[0], options);
      if (!changed) {
        return;
      }
    }

    this.applyIterationLimit(entries);
  }

  private detectConflicts(entries: ConflictEntryLike[]): RuleImpact[] {
    const activeEntries = entries.filter((entry) => entry.status === ScheduleStatus.ACTIVE);

    const ruleImpacts = activeEntries
      .flatMap((sourceEntry) => this.collectRuleImpactsForSource(sourceEntry, activeEntries));

    const priorityImpacts = this.collectPriorityPolicyImpacts(activeEntries);
    const ophthalmicImpacts = this.collectOphthalmicPolicyImpacts(activeEntries);

    return [...ruleImpacts, ...priorityImpacts, ...ophthalmicImpacts].sort((left, right) => this.compareImpacts(left, right));
  }

  private collectRuleImpactsForSource(
    sourceEntry: ConflictEntryLike,
    entries: ConflictEntryLike[],
  ): RuleImpact[] {
    return entries
      .filter(
        (targetEntry) =>
          targetEntry !== sourceEntry &&
          !this.shouldSkipResolvedSucralfateBlocker(sourceEntry, targetEntry),
      )
      .flatMap((targetEntry) =>
        targetEntry.interactionRulesSnapshot
          .filter((rule) => this.isSupportedResolution(rule))
          .filter((rule) => this.matchesRule(targetEntry, sourceEntry, rule))
          .map((rule) => this.buildRuleImpact(sourceEntry, targetEntry, rule)),
      )
      .filter((impact): impact is RuleImpact => !!impact);
  }

  private collectPriorityPolicyImpacts(entries: ConflictEntryLike[]): RuleImpact[] {
    const impacts: RuleImpact[] = [];

    for (let index = 0; index < entries.length; index += 1) {
      for (let targetIndex = index + 1; targetIndex < entries.length; targetIndex += 1) {
        const left = entries[index];
        const right = entries[targetIndex];

        if (left.timeInMinutes !== right.timeInMinutes) {
          continue;
        }
        if (!this.isNonMovable(left) && !this.isNonMovable(right)) {
          continue;
        }
        if (this.hasMatchingRuleBetween(left, right)) {
          continue;
        }

        const selection = this.selectAdjustedEntry(left, right);
        impacts.push({
          adjustedEntry: selection.adjustedEntry,
          blockerEntry: selection.blockerEntry,
          ruleOwnerEntry: undefined,
          resolutionType: ClinicalResolutionType.REQUIRE_MANUAL_ADJUSTMENT,
          matchKind: ConflictMatchKind.PRIORITY_BLOCK,
          rulePriority: 10_000,
        });
      }
    }

    return impacts;
  }

  private collectOphthalmicPolicyImpacts(entries: ConflictEntryLike[]): RuleImpact[] {
    const impacts: RuleImpact[] = [];
    const ophthalmicEntries = entries.filter((entry) => entry.isOphthalmic);

    for (let index = 0; index < ophthalmicEntries.length; index += 1) {
      for (let targetIndex = index + 1; targetIndex < ophthalmicEntries.length; targetIndex += 1) {
        const left = ophthalmicEntries[index];
        const right = ophthalmicEntries[targetIndex];
        const delta = Math.abs(left.timeInMinutes - right.timeInMinutes);
        if (delta >= OPHTHALMIC_MIN_INTERVAL_MINUTES) {
          continue;
        }

        const [blockerEntry, adjustedEntry] = this.selectOphthalmicBlockerAndAdjusted(left, right);
        impacts.push({
          adjustedEntry,
          blockerEntry,
          resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
          matchKind: delta === 0 ? ConflictMatchKind.EXACT_MINUTE : ConflictMatchKind.CLINICAL_WINDOW,
          rulePriority: 9_000,
          policy: 'OPHTHALMIC_MIN_INTERVAL',
        });
      }
    }

    return impacts;
  }

  private selectOphthalmicBlockerAndAdjusted(
    left: ConflictEntryLike,
    right: ConflictEntryLike,
  ): [ConflictEntryLike, ConflictEntryLike] {
    if (left.timeInMinutes !== right.timeInMinutes) {
      return left.timeInMinutes < right.timeInMinutes ? [left, right] : [right, left];
    }
    if ((left.shiftCount ?? 0) > 0 && (right.shiftCount ?? 0) === 0) {
      return [right, left];
    }
    if ((right.shiftCount ?? 0) > 0 && (left.shiftCount ?? 0) === 0) {
      return [left, right];
    }
    return [left, right];
  }

  private buildRuleImpact(
    sourceEntry: ConflictEntryLike,
    targetEntry: ConflictEntryLike,
    rule: ClinicalInteractionRuleSnapshot,
  ): RuleImpact | null {
    const selection = this.selectAdjustedEntry(sourceEntry, targetEntry);

    if (selection.bothNonMovable) {
      return {
        adjustedEntry: selection.adjustedEntry,
        blockerEntry: selection.blockerEntry,
        ruleOwnerEntry: targetEntry,
        rule,
        resolutionType: ClinicalResolutionType.REQUIRE_MANUAL_ADJUSTMENT,
        matchKind: ConflictMatchKind.PRIORITY_BLOCK,
        rulePriority: rule.priority ?? 0,
      };
    }

    return {
      adjustedEntry: selection.adjustedEntry,
      blockerEntry: selection.blockerEntry,
      ruleOwnerEntry: targetEntry,
      rule,
      resolutionType: rule.resolutionType,
      matchKind: this.resolveMatchKind(sourceEntry, targetEntry, rule),
      rulePriority: rule.priority ?? 0,
    };
  }

  private selectAdjustedEntry(
    sourceEntry: ConflictEntryLike,
    targetEntry: ConflictEntryLike,
  ): ConflictPairSelection {
    const sourceNonMovable = this.isNonMovable(sourceEntry);
    const targetNonMovable = this.isNonMovable(targetEntry);

    if (sourceNonMovable && targetNonMovable) {
      const comparison = this.compareBlockerStrength(sourceEntry, targetEntry);
      if (comparison <= 0) {
        return {
          adjustedEntry: sourceEntry,
          blockerEntry: targetEntry,
          bothNonMovable: true,
        };
      }
      return {
        adjustedEntry: targetEntry,
        blockerEntry: sourceEntry,
        bothNonMovable: true,
      };
    }

    if (sourceNonMovable && !targetNonMovable) {
      return {
        adjustedEntry: targetEntry,
        blockerEntry: sourceEntry,
        bothNonMovable: false,
      };
    }

    return {
      adjustedEntry: sourceEntry,
      blockerEntry: targetEntry,
      bothNonMovable: false,
    };
  }

  private applyImpact(impact: RuleImpact, options: ConflictResolutionOptions): boolean {
    const entry = impact.adjustedEntry;
    entry.conflict = this.buildConflict(impact);

    if (impact.matchKind === ConflictMatchKind.PRIORITY_BLOCK) {
      this.applyManualResolution(
        entry,
        impact,
        ConflictReasonCode.MANUAL_REQUIRED_NON_MOVABLE_COLLISION,
        `ajuste manual exigido por choque com dose não deslocável de ${impact.blockerEntry.medicationName}.`,
      );
      return true;
    }

    if (impact.resolutionType === ClinicalResolutionType.INACTIVATE_SOURCE) {
      this.applyInactiveResolution(entry, impact);
      return true;
    }

    if (impact.resolutionType === ClinicalResolutionType.REQUIRE_MANUAL_ADJUSTMENT) {
      this.applyManualResolution(
        entry,
        impact,
        ConflictReasonCode.MANUAL_REQUIRED_PERSISTENT_CONFLICT,
        `ajuste manual exigido por conflito clínico com ${impact.blockerEntry.medicationName}.`,
      );
      return true;
    }

    if ((entry.shiftCount ?? 0) > 0 && this.isShiftedSucralfateDose(entry, impact)) {
      this.applyInactiveResolution(entry, this.asMandatoryInactivationImpact(impact));
      return true;
    }

    if ((entry.shiftCount ?? 0) > 0 && impact.policy === 'OPHTHALMIC_MIN_INTERVAL') {
      this.applyManualResolution(
        entry,
        impact,
        ConflictReasonCode.MANUAL_REQUIRED_OPHTHALMIC_INTERVAL,
        `ajuste manual exigido após revalidação do intervalo mínimo de ${OPHTHALMIC_MIN_INTERVAL_MINUTES} minutos entre colírios com ${impact.blockerEntry.medicationName}.`,
      );
      return true;
    }

    if ((entry.shiftCount ?? 0) > 0) {
      this.applyManualResolution(
        entry,
        impact,
        ConflictReasonCode.MANUAL_REQUIRED_PERSISTENT_CONFLICT,
        `ajuste manual exigido após revalidação de conflito clínico com ${impact.blockerEntry.medicationName}.`,
      );
      return true;
    }

    const shift = this.resolveShift(entry, impact, options);
    entry.timeInMinutes = shift.timeInMinutes;
    entry.shiftCount = (entry.shiftCount ?? 0) + 1;
    if (this.isMorningSucralfateShift(entry, impact)) {
      entry.resolvedSucralfateBlockerKeys = [
        ...(entry.resolvedSucralfateBlockerKeys ?? []),
        impact.blockerEntry.stableKey,
      ];
    }
    entry.timeContext.resolvedTimeInMinutes = entry.timeInMinutes;
    entry.resolutionReasonCode =
      impact.policy === 'OPHTHALMIC_MIN_INTERVAL'
        ? ConflictReasonCode.SHIFTED_BY_OPHTHALMIC_INTERVAL
        : ConflictReasonCode.SHIFTED_BY_WINDOW_CONFLICT;
    entry.resolutionReasonText = shift.reasonText;
    entry.note = entry.resolutionReasonText;
    return true;
  }

  private resolveShift(
    entry: ConflictEntryLike,
    impact: RuleImpact,
    options: ConflictResolutionOptions,
  ): { timeInMinutes: number; reasonText: string } {
    const lunchAnchor = options.anchors?.[ClinicalAnchor.ALMOCO];
    if (this.isMorningSucralfateShift(entry, impact) && lunchAnchor !== undefined) {
      return {
        timeInMinutes: lunchAnchor + 120,
        reasonText: `Dose deslocada para ALMOÇO + 2H por conflito clínico com ${impact.blockerEntry.medicationName}.`,
      };
    }

    if (impact.policy === 'OPHTHALMIC_MIN_INTERVAL') {
      return {
        timeInMinutes: impact.blockerEntry.timeInMinutes + OPHTHALMIC_MIN_INTERVAL_MINUTES,
        reasonText: `Dose deslocada para respeitar intervalo mínimo de ${OPHTHALMIC_MIN_INTERVAL_MINUTES} minutos entre colírios com ${impact.blockerEntry.medicationName}.`,
      };
    }

    const shiftWindow = this.resolveShiftWindow(impact.rule);
    return {
      timeInMinutes: entry.timeInMinutes + shiftWindow,
      reasonText: `Dose deslocada ${shiftWindow} minuto(s) por conflito clínico com ${impact.blockerEntry.medicationName}.`,
    };
  }

  private applyIterationLimit(entries: ConflictEntryLike[]): void {
    const impacts = this.detectConflicts(entries);
    const impactedEntries = new Map<string, RuleImpact>();

    impacts.forEach((impact) => {
      if (!impactedEntries.has(impact.adjustedEntry.stableKey)) {
        impactedEntries.set(impact.adjustedEntry.stableKey, impact);
      }
    });

    impactedEntries.forEach((impact) => {
      const entry = impact.adjustedEntry;
      entry.conflict = this.buildConflict(impact);
      entry.status = ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED;
      entry.resolutionReasonCode = ConflictReasonCode.MANUAL_REQUIRED_ITERATION_LIMIT;
      entry.resolutionReasonText =
        'ajuste manual exigido após atingir o limite de reavaliações do motor de conflitos.';
      entry.note = entry.resolutionReasonText;
    });
  }

  private applyInactiveResolution(entry: ConflictEntryLike, impact: RuleImpact): void {
    entry.status = ScheduleStatus.INACTIVE;
    entry.conflict = this.buildConflict(impact);
    entry.resolutionReasonCode = ConflictReasonCode.INACTIVATED_BY_MANDATORY_RULE;
    entry.resolutionReasonText = `Dose inativada por regra clínica obrigatória associada a ${impact.blockerEntry.medicationName}.`;
    entry.note = entry.resolutionReasonText;
  }

  private applyManualResolution(
    entry: ConflictEntryLike,
    impact: RuleImpact,
    reasonCode: ConflictReasonCode,
    reasonText: string,
  ): void {
    entry.status = ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED;
    entry.conflict = this.buildConflict(impact);
    entry.resolutionReasonCode = reasonCode;
    entry.resolutionReasonText = reasonText;
    entry.note = reasonText;
  }

  private buildConflict(impact: RuleImpact): ScheduleConflictDto {
    const [windowBefore, windowAfter] =
      impact.policy === 'OPHTHALMIC_MIN_INTERVAL'
        ? [OPHTHALMIC_MIN_INTERVAL_MINUTES - 1, OPHTHALMIC_MIN_INTERVAL_MINUTES - 1]
        : impact.rule
          ? this.resolveConflictWindows(impact.ruleOwnerEntry ?? impact.blockerEntry, impact.rule)
          : [0, 0];

    return {
      interactionType:
        impact.policy === 'OPHTHALMIC_MIN_INTERVAL'
          ? ClinicalInteractionType.OPHTHALMIC_MIN_INTERVAL
          : impact.rule?.interactionType,
      resolutionType: impact.resolutionType,
      matchKind: impact.matchKind,
      triggerMedicationName: impact.blockerEntry.medicationName,
      triggerGroupCode: impact.blockerEntry.groupCode,
      triggerProtocolCode: impact.blockerEntry.protocolCode,
      rulePriority: impact.rulePriority,
      windowBeforeMinutes: windowBefore,
      windowAfterMinutes: windowAfter,
    };
  }

  private hasMatchingRuleBetween(left: ConflictEntryLike, right: ConflictEntryLike): boolean {
    return (
      left.interactionRulesSnapshot
        .filter((rule) => this.isSupportedResolution(rule))
        .some((rule) => this.matchesRule(left, right, rule)) ||
      right.interactionRulesSnapshot
        .filter((rule) => this.isSupportedResolution(rule))
        .some((rule) => this.matchesRule(right, left, rule))
    );
  }

  private matchesRule(
    targetEntry: ConflictEntryLike,
    sourceEntry: ConflictEntryLike,
    rule: ClinicalInteractionRuleSnapshot,
  ): boolean {
    if (rule.targetGroupCode !== undefined && rule.targetGroupCode !== sourceEntry.groupCode) {
      return false;
    }

    if (rule.targetProtocolCode !== undefined && rule.targetProtocolCode !== sourceEntry.protocolCode) {
      return false;
    }

    if (
      rule.applicableSemanticTags?.length &&
      !rule.applicableSemanticTags.includes(targetEntry.semanticTag)
    ) {
      return false;
    }

    if (
      rule.interactionType === ClinicalInteractionType.AFFECTED_BY_SALTS &&
      sourceEntry.groupCode !== GroupCode.GROUP_III_SAL
    ) {
      return false;
    }

    if (
      rule.interactionType === ClinicalInteractionType.AFFECTED_BY_CALCIUM &&
      sourceEntry.groupCode !== GroupCode.GROUP_III_CALC
    ) {
      return false;
    }

    if (
      rule.interactionType === ClinicalInteractionType.AFFECTED_BY_SUCRALFATE &&
      sourceEntry.groupCode !== GroupCode.GROUP_II_SUCRA
    ) {
      return false;
    }

    return this.timesConflict(targetEntry, sourceEntry, rule);
  }

  private timesConflict(
    targetEntry: ConflictEntryLike,
    sourceEntry: ConflictEntryLike,
    rule: ClinicalInteractionRuleSnapshot,
  ): boolean {
    if (sourceEntry.timeInMinutes === targetEntry.timeInMinutes) {
      return true;
    }

    const [windowBefore, windowAfter] = this.resolveConflictWindows(targetEntry, rule);

    if (windowBefore === 0 && windowAfter === 0) {
      return false;
    }

    const delta = sourceEntry.timeInMinutes - targetEntry.timeInMinutes;
    if (delta >= 0) {
      return delta <= windowAfter;
    }
    return Math.abs(delta) <= windowBefore;
  }

  private resolveConflictWindows(
    targetEntry: ConflictEntryLike,
    rule: ClinicalInteractionRuleSnapshot,
  ): [number, number] {
    const defaultSucralfateWindow =
      rule.interactionType === ClinicalInteractionType.AFFECTED_BY_SUCRALFATE &&
      targetEntry.semanticTag === ClinicalSemanticTag.BEDTIME_EQUIVALENT
        ? 20
        : 0;

    const sharedWindow = rule.windowMinutes ?? defaultSucralfateWindow;
    const windowBefore = rule.windowBeforeMinutes ?? sharedWindow ?? 0;
    const windowAfter = rule.windowAfterMinutes ?? sharedWindow ?? 0;
    return [windowBefore, windowAfter];
  }

  private resolveShiftWindow(rule?: ClinicalInteractionRuleSnapshot): number {
    return (
      rule?.windowAfterMinutes ??
      rule?.windowMinutes ??
      rule?.windowBeforeMinutes ??
      60
    );
  }

  private isMorningSucralfateShift(entry: ConflictEntryLike, impact: RuleImpact): boolean {
    return (
      entry.groupCode === GroupCode.GROUP_II_SUCRA &&
      entry.phaseDoseLabel === 'D1' &&
      impact.rule?.interactionType === ClinicalInteractionType.AFFECTED_BY_SUCRALFATE &&
      impact.resolutionType === ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW
    );
  }

  private isShiftedSucralfateDose(entry: ConflictEntryLike, impact: RuleImpact): boolean {
    return (
      entry.groupCode === GroupCode.GROUP_II_SUCRA &&
      entry.phaseDoseLabel === 'D1' &&
      impact.rule?.interactionType === ClinicalInteractionType.AFFECTED_BY_SUCRALFATE
    );
  }

  private shouldSkipResolvedSucralfateBlocker(
    sourceEntry: ConflictEntryLike,
    targetEntry: ConflictEntryLike,
  ): boolean {
    return (
      sourceEntry.groupCode === GroupCode.GROUP_II_SUCRA &&
      sourceEntry.phaseDoseLabel === 'D1' &&
      !!sourceEntry.resolvedSucralfateBlockerKeys?.includes(targetEntry.stableKey)
    );
  }

  private asMandatoryInactivationImpact(impact: RuleImpact): RuleImpact {
    return {
      ...impact,
      resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
      matchKind: ConflictMatchKind.MANDATORY_INACTIVATION,
    };
  }

  private resolveMatchKind(
    sourceEntry: ConflictEntryLike,
    targetEntry: ConflictEntryLike,
    rule: ClinicalInteractionRuleSnapshot,
  ): ConflictMatchKind {
    if (rule.resolutionType === ClinicalResolutionType.INACTIVATE_SOURCE) {
      return ConflictMatchKind.MANDATORY_INACTIVATION;
    }
    if (sourceEntry.timeInMinutes === targetEntry.timeInMinutes) {
      return ConflictMatchKind.EXACT_MINUTE;
    }
    return ConflictMatchKind.CLINICAL_WINDOW;
  }

  private compareImpacts(left: RuleImpact, right: RuleImpact): number {
    const leftBlockerProtected = Number(this.isNonMovable(left.blockerEntry));
    const rightBlockerProtected = Number(this.isNonMovable(right.blockerEntry));
    const leftSeverity = this.resolutionSeverity(left.resolutionType);
    const rightSeverity = this.resolutionSeverity(right.resolutionType);
    const leftMatchPriority = this.matchKindPriority(left.matchKind);
    const rightMatchPriority = this.matchKindPriority(right.matchKind);

    return (
      rightBlockerProtected - leftBlockerProtected ||
      rightSeverity - leftSeverity ||
      rightMatchPriority - leftMatchPriority ||
      right.rulePriority - left.rulePriority ||
      right.blockerEntry.protocolPriority - left.blockerEntry.protocolPriority ||
      left.adjustedEntry.timeInMinutes - right.adjustedEntry.timeInMinutes ||
      left.adjustedEntry.medicationName.localeCompare(right.adjustedEntry.medicationName) ||
      left.adjustedEntry.phaseDoseLabel.localeCompare(right.adjustedEntry.phaseDoseLabel) ||
      left.adjustedEntry.stableKey.localeCompare(right.adjustedEntry.stableKey)
    );
  }

  private compareBlockerStrength(left: ConflictEntryLike, right: ConflictEntryLike): number {
    return (
      Number(this.isNonMovable(right)) - Number(this.isNonMovable(left)) ||
      right.protocolPriority - left.protocolPriority ||
      left.medicationName.localeCompare(right.medicationName) ||
      left.phaseDoseLabel.localeCompare(right.phaseDoseLabel) ||
      left.stableKey.localeCompare(right.stableKey)
    );
  }

  private compareStableEntries(left: ConflictEntryLike, right: ConflictEntryLike): number {
    return (
      left.timeInMinutes - right.timeInMinutes ||
      left.medicationName.localeCompare(right.medicationName) ||
      left.phaseDoseLabel.localeCompare(right.phaseDoseLabel) ||
      left.stableKey.localeCompare(right.stableKey)
    );
  }

  private resolutionSeverity(resolutionType: ClinicalResolutionType): number {
    switch (resolutionType) {
      case ClinicalResolutionType.INACTIVATE_SOURCE:
        return 3;
      case ClinicalResolutionType.REQUIRE_MANUAL_ADJUSTMENT:
        return 2;
      case ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW:
      default:
        return 1;
    }
  }

  private matchKindPriority(matchKind: ConflictMatchKind): number {
    switch (matchKind) {
      case ConflictMatchKind.PRIORITY_BLOCK:
        return 4;
      case ConflictMatchKind.MANDATORY_INACTIVATION:
        return 3;
      case ConflictMatchKind.EXACT_MINUTE:
        return 2;
      case ConflictMatchKind.CLINICAL_WINDOW:
      default:
        return 1;
    }
  }

  private isNonMovable(entry: ConflictEntryLike): boolean {
    return NON_MOVABLE_GROUPS.has(entry.groupCode);
  }

  private isSupportedResolution(rule: ClinicalInteractionRuleSnapshot): boolean {
    return [
      ClinicalResolutionType.INACTIVATE_SOURCE,
      ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
      ClinicalResolutionType.REQUIRE_MANUAL_ADJUSTMENT,
    ].includes(rule.resolutionType);
  }
}

import { DoseUnit } from '../../../common/enums/dose-unit.enum';
import { ClinicalAnchor } from '../../../common/enums/clinical-anchor.enum';
import { ClinicalInteractionType } from '../../../common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../../../common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../../../common/enums/clinical-semantic-tag.enum';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';

export interface ClinicalMedicationSnapshot {
  id: string;
  commercialName?: string;
  activePrinciple: string;
  presentation: string;
  pharmaceuticalForm?: string;
  administrationRoute: string;
  usageInstructions: string;
  diluentType?: string;
  defaultAdministrationUnit?: DoseUnit;
  supportsManualAdjustment?: boolean;
  isOphthalmic?: boolean;
  isOtic?: boolean;
  isContraceptiveMonthly?: boolean;
  requiresGlycemiaScale?: boolean;
  notes?: string;
}

export interface ProtocolStepSnapshot {
  doseLabel: string;
  anchor: ClinicalAnchor;
  offsetMinutes: number;
  semanticTag: ClinicalSemanticTag;
}

export interface ProtocolFrequencySnapshot {
  frequency: number;
  label?: string;
  allowedRecurrenceTypes?: TreatmentRecurrence[];
  allowsPrn?: boolean;
  allowsVariableDoseBySchedule?: boolean;
  steps: ProtocolStepSnapshot[];
}

export interface ClinicalInteractionRuleSnapshot {
  interactionType: ClinicalInteractionType;
  targetGroupCode?: string;
  targetProtocolCode?: string;
  resolutionType: ClinicalResolutionType;
  windowMinutes?: number;
  windowBeforeMinutes?: number;
  windowAfterMinutes?: number;
  applicableSemanticTags?: ClinicalSemanticTag[];
  priority: number;
}

export interface ClinicalProtocolSnapshot {
  id: string;
  code: string;
  name: string;
  description: string;
  groupCode: string;
  subgroupCode?: string;
  priority: number;
  isDefault: boolean;
  active?: boolean;
  clinicalNotes?: string;
  frequencies: ProtocolFrequencySnapshot[];
}

export interface PrescriptionPhaseDoseOverride {
  doseLabel: string;
  doseValue: string;
  doseUnit: DoseUnit;
}

export interface PrescriptionPhaseGlycemiaScaleRange {
  minimum: number;
  maximum: number;
  doseValue: string;
  doseUnit: DoseUnit;
}

import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ClinicalAnchor } from '../../../common/enums/clinical-anchor.enum';
import { ClinicalInteractionType } from '../../../common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../../../common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../../../common/enums/clinical-semantic-tag.enum';
import { DoseUnit } from '../../../common/enums/dose-unit.enum';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';

export class CreateClinicalProtocolStepDto {
  @IsString()
  doseLabel: string;

  @IsEnum(ClinicalAnchor)
  anchor: ClinicalAnchor;

  @Type(() => Number)
  @IsInt()
  offsetMinutes: number;

  @IsOptional()
  @IsEnum(ClinicalSemanticTag)
  semanticTag?: ClinicalSemanticTag;
}

export class CreateClinicalProtocolFrequencyDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  frequency: number;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(TreatmentRecurrence, { each: true })
  allowedRecurrenceTypes?: TreatmentRecurrence[];

  @IsOptional()
  @IsBoolean()
  allowsPrn?: boolean;

  @IsOptional()
  @IsBoolean()
  allowsVariableDoseBySchedule?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateClinicalProtocolStepDto)
  steps: CreateClinicalProtocolStepDto[];
}

export class CreateClinicalInteractionRuleDto {
  @IsEnum(ClinicalInteractionType)
  interactionType: ClinicalInteractionType;

  @IsOptional()
  @IsString()
  targetGroupCode?: string;

  @IsOptional()
  @IsString()
  targetProtocolCode?: string;

  @IsEnum(ClinicalResolutionType)
  resolutionType: ClinicalResolutionType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  windowMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  windowBeforeMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  windowAfterMinutes?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(ClinicalSemanticTag, { each: true })
  applicableSemanticTags?: ClinicalSemanticTag[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;
}

export class CreateClinicalProtocolDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  groupCode: string;

  @IsOptional()
  @IsString()
  subgroupCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  clinicalNotes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateClinicalProtocolFrequencyDto)
  frequencies: CreateClinicalProtocolFrequencyDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateClinicalInteractionRuleDto)
  interactionRules?: CreateClinicalInteractionRuleDto[];
}

export class CreateClinicalMedicationDto {
  @IsOptional()
  @IsString()
  commercialName?: string;

  @IsString()
  activePrinciple: string;

  @IsString()
  presentation: string;

  @IsOptional()
  @IsString()
  pharmaceuticalForm?: string;

  @IsString()
  administrationRoute: string;

  @IsString()
  usageInstructions: string;

  @IsOptional()
  @IsString()
  diluentType?: string;

  @IsOptional()
  @IsEnum(DoseUnit)
  defaultAdministrationUnit?: DoseUnit;

  @IsOptional()
  @IsBoolean()
  supportsManualAdjustment?: boolean;

  @IsOptional()
  @IsBoolean()
  isOphthalmic?: boolean;

  @IsOptional()
  @IsBoolean()
  isOtic?: boolean;

  @IsOptional()
  @IsBoolean()
  isContraceptiveMonthly?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresGlycemiaScale?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateClinicalProtocolDto)
  protocols: CreateClinicalProtocolDto[];
}

import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { DoseUnit } from '../../../common/enums/dose-unit.enum';
import { MonthlySpecialReference } from '../../../common/enums/monthly-special-reference.enum';
import { OcularLaterality } from '../../../common/enums/ocular-laterality.enum';
import { OticLaterality } from '../../../common/enums/otic-laterality.enum';
import { PrnReason } from '../../../common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';
import { IsHhmmTime } from '../../../common/validators/is-hhmm-time.validator';
import {
  CreatePatientPrescriptionGlycemiaScaleRangeDto,
  CreatePatientPrescriptionPhaseDoseOverrideDto,
} from './create-patient-prescription.dto';

export class UpsertPatientPrescriptionPhaseDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  frequency: number;

  @IsBoolean()
  sameDosePerSchedule: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  @IsString()
  doseAmount?: string;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  @IsString()
  doseValue?: string;

  @IsOptional()
  @IsEnum(DoseUnit)
  doseUnit?: DoseUnit;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePatientPrescriptionPhaseDoseOverrideDto)
  perDoseOverrides?: CreatePatientPrescriptionPhaseDoseOverrideDto[];

  @IsEnum(TreatmentRecurrence)
  recurrenceType: TreatmentRecurrence;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  alternateDaysInterval?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  weeklyDay?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  monthlyRule?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  monthlyDay?: number;

  @IsOptional()
  @IsEnum(MonthlySpecialReference)
  monthlySpecialReference?: MonthlySpecialReference;

  @IsOptional()
  @IsDateString()
  monthlySpecialBaseDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  monthlySpecialOffsetDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  treatmentDays?: number;

  @IsBoolean()
  continuousUse: boolean;

  @IsOptional()
  @IsEnum(PrnReason)
  prnReason?: PrnReason;

  @IsOptional()
  @IsEnum(OcularLaterality)
  ocularLaterality?: OcularLaterality;

  @IsOptional()
  @IsEnum(OticLaterality)
  oticLaterality?: OticLaterality;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePatientPrescriptionGlycemiaScaleRangeDto)
  glycemiaScaleRanges?: CreatePatientPrescriptionGlycemiaScaleRangeDto[];

  @IsBoolean()
  manualAdjustmentEnabled: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsHhmmTime({ each: true })
  manualTimes?: string[];
}

export class UpdatePatientPrescriptionPhaseDto {
  @IsUUID()
  phaseId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  frequency?: number;

  @IsOptional()
  @IsBoolean()
  sameDosePerSchedule?: boolean;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  @IsString()
  doseAmount?: string;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  @IsString()
  doseValue?: string;

  @IsOptional()
  @IsEnum(DoseUnit)
  doseUnit?: DoseUnit;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePatientPrescriptionPhaseDoseOverrideDto)
  perDoseOverrides?: CreatePatientPrescriptionPhaseDoseOverrideDto[];

  @IsOptional()
  @IsEnum(TreatmentRecurrence)
  recurrenceType?: TreatmentRecurrence;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  alternateDaysInterval?: number;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  weeklyDay?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  monthlyRule?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  monthlyDay?: number;

  @IsOptional()
  @IsEnum(MonthlySpecialReference)
  monthlySpecialReference?: MonthlySpecialReference;

  @IsOptional()
  @IsDateString()
  monthlySpecialBaseDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  monthlySpecialOffsetDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  treatmentDays?: number;

  @IsOptional()
  @IsBoolean()
  continuousUse?: boolean;

  @IsOptional()
  @IsEnum(PrnReason)
  prnReason?: PrnReason;

  @IsOptional()
  @IsEnum(OcularLaterality)
  ocularLaterality?: OcularLaterality;

  @IsOptional()
  @IsEnum(OticLaterality)
  oticLaterality?: OticLaterality;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePatientPrescriptionGlycemiaScaleRangeDto)
  glycemiaScaleRanges?: CreatePatientPrescriptionGlycemiaScaleRangeDto[];

  @IsOptional()
  @IsBoolean()
  manualAdjustmentEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsHhmmTime({ each: true })
  manualTimes?: string[];
}

export class AddPatientPrescriptionMedicationDto {
  @IsUUID()
  clinicalMedicationId: string;

  @IsUUID()
  protocolId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertPatientPrescriptionPhaseDto)
  phases: UpsertPatientPrescriptionPhaseDto[];
}

@ValidatorConstraint({ name: 'MedicationUpdateHasAction', async: false })
class MedicationUpdateHasActionValidator implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const medication = args.object as UpdatePatientPrescriptionMedicationOperationDto;
    return (
      Boolean(medication.protocolId) ||
      Boolean(medication.replacePhases?.length) ||
      Boolean(medication.updatePhases?.length) ||
      Boolean(medication.removePhaseIds?.length)
    );
  }

  defaultMessage(): string {
    return 'Cada item de updateMedications deve informar protocolId, replacePhases, updatePhases ou removePhaseIds.';
  }
}

export class UpdatePatientPrescriptionMedicationOperationDto {
  @Validate(MedicationUpdateHasActionValidator)
  private readonly hasActionValidation: boolean;

  @IsUUID()
  prescriptionMedicationId: string;

  @IsOptional()
  @IsUUID()
  protocolId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdatePatientPrescriptionPhaseDto)
  updatePhases?: UpdatePatientPrescriptionPhaseDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertPatientPrescriptionPhaseDto)
  replacePhases?: UpsertPatientPrescriptionPhaseDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  removePhaseIds?: string[];
}

@ValidatorConstraint({ name: 'UpdatePrescriptionHasOperation', async: false })
class UpdatePrescriptionHasOperationValidator implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const dto = args.object as UpdatePatientPrescriptionDto;
    return (
      Boolean(dto.startedAt) ||
      Boolean(dto.addMedications?.length) ||
      Boolean(dto.updateMedications?.length) ||
      Boolean(dto.removeMedicationIds?.length)
    );
  }

  defaultMessage(): string {
    return 'Informe ao menos uma operação: addMedications, updateMedications ou removeMedicationIds.';
  }
}

export class UpdatePatientPrescriptionDto {
  @Validate(UpdatePrescriptionHasOperationValidator)
  private readonly hasOperationValidation: boolean;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AddPatientPrescriptionMedicationDto)
  addMedications?: AddPatientPrescriptionMedicationDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdatePatientPrescriptionMedicationOperationDto)
  updateMedications?: UpdatePatientPrescriptionMedicationOperationDto[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  removeMedicationIds?: string[];
}

export class AppendPrescriptionMedicationPhasesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertPatientPrescriptionPhaseDto)
  phases: UpsertPatientPrescriptionPhaseDto[];
}

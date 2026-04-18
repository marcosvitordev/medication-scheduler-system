import { Transform, Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsDefined, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min, ValidateIf, ValidateNested } from 'class-validator';
import { DoseUnit } from '../../../common/enums/dose-unit.enum';
import { PrnReason } from '../../../common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';
import {
  IsPrescriptionItemClinicallyValid,
  shouldValidateAlternateDaysInterval,
  shouldValidateManualTimes,
  shouldValidateMonthlyDay,
  shouldValidateMonthlyRule,
  shouldValidatePerDoseOverrides,
  shouldValidateTreatmentDays,
  shouldValidateWeeklyDay
} from '../validators/prescription-item.validator';

export class CreatePrescriptionItemDoseOverrideDto {
  @IsString()
  @Matches(/^D\d+$/)
  doseLabel: string;

  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  @IsString()
  doseValue: string;

  @IsEnum(DoseUnit)
  doseUnit: DoseUnit;
}

export class CreatePrescriptionItemDto {
  @IsPrescriptionItemClinicallyValid()
  private readonly clinicalValidation: boolean;

  @IsUUID()
  medicationId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  frequency: number;

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

  @IsBoolean()
  sameDosePerSchedule: boolean;

  @ValidateIf((item, value) => shouldValidatePerDoseOverrides(item, value))
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionItemDoseOverrideDto)
  perDoseOverrides?: CreatePrescriptionItemDoseOverrideDto[];

  @IsOptional()
  @IsEnum(TreatmentRecurrence)
  recurrenceType?: TreatmentRecurrence;

  @ValidateIf((item, value) => shouldValidateAlternateDaysInterval(item, value))
  @IsDefined({ message: 'alternateDaysInterval é obrigatório para recorrência ALTERNATE_DAYS.' })
  @Type(() => Number)
  @IsInt()
  @Min(2)
  alternateDaysInterval?: number;

  @ValidateIf((item, value) => shouldValidateWeeklyDay(item, value))
  @IsDefined({ message: 'weeklyDay é obrigatório para recorrência WEEKLY.' })
  @IsString()
  weeklyDay?: string;

  @ValidateIf((item, value) => shouldValidateMonthlyRule(item, value))
  @IsString()
  monthlyRule?: string;

  @ValidateIf((item, value) => shouldValidateMonthlyDay(item, value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  monthlyDay?: number;

  @ValidateIf((item, value) => shouldValidateTreatmentDays(item, value))
  @IsDefined({ message: 'treatmentDays é obrigatório quando o tratamento não for contínuo e nem PRN.' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  treatmentDays?: number;

  @IsBoolean()
  continuousUse: boolean;

  @IsOptional()
  @IsEnum(PrnReason)
  prnReason?: PrnReason;

  @IsBoolean()
  manualAdjustmentEnabled: boolean;

  @ValidateIf((item, value) => shouldValidateManualTimes(item, value))
  @IsDefined({ message: 'manualTimes é obrigatório quando manualAdjustmentEnabled for true.' })
  @IsArray()
  @ArrayMinSize(1)
  @Matches(/^\d{2}:\d{2}$/, { each: true })
  manualTimes?: string[];

  @IsOptional()
  @IsBoolean()
  dailyTreatment?: boolean;

  @IsOptional()
  @IsBoolean()
  crisisOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  feverOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  painOnly?: boolean;
}

export class CreatePrescriptionDto {
  @IsUUID()
  patientId: string;

  @IsDateString()
  startedAt: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionItemDto)
  items: CreatePrescriptionItemDto[];
}

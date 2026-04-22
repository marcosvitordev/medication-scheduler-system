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
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { DoseUnit } from '../../../common/enums/dose-unit.enum';
import { OcularLaterality } from '../../../common/enums/ocular-laterality.enum';
import { OticLaterality } from '../../../common/enums/otic-laterality.enum';
import { PrnReason } from '../../../common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';
import { IsHhmmTime } from '../../../common/validators/is-hhmm-time.validator';
import { IsPatientPrescriptionPhaseValid } from '../validators/patient-prescription-phase.validator';

export class CreatePatientPrescriptionPhaseDoseOverrideDto {
  @IsString()
  @Matches(/^D\d+$/)
  doseLabel: string;

  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  @IsString()
  doseValue: string;

  @IsEnum(DoseUnit)
  doseUnit: DoseUnit;
}

export class CreatePatientPrescriptionPhaseDto {
  @IsPatientPrescriptionPhaseValid()
  private readonly phaseValidation: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  phaseOrder: number;

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

  @IsBoolean()
  manualAdjustmentEnabled: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsHhmmTime({ each: true })
  manualTimes?: string[];
}

export class CreatePatientPrescriptionMedicationDto {
  @IsUUID()
  clinicalMedicationId: string;

  @IsUUID()
  protocolId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePatientPrescriptionPhaseDto)
  phases: CreatePatientPrescriptionPhaseDto[];
}

export class CreatePatientPrescriptionDto {
  @IsUUID()
  patientId: string;

  @IsDateString()
  startedAt: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePatientPrescriptionMedicationDto)
  medications: CreatePatientPrescriptionMedicationDto[];
}

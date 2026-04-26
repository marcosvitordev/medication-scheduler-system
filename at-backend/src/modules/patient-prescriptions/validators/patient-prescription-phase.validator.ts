import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PrnReason } from '../../../common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';
import { MonthlySpecialReference } from '../../../common/enums/monthly-special-reference.enum';

export type PhaseLike = {
  phaseOrder?: number;
  frequency?: number;
  sameDosePerSchedule?: boolean;
  perDoseOverrides?: { doseLabel?: string }[];
  recurrenceType?: TreatmentRecurrence;
  alternateDaysInterval?: number;
  weeklyDay?: string;
  monthlyRule?: string;
  monthlyDay?: number;
  monthlySpecialReference?: MonthlySpecialReference;
  monthlySpecialBaseDate?: string;
  monthlySpecialOffsetDays?: number;
  prnReason?: PrnReason;
  treatmentDays?: number;
  continuousUse?: boolean;
  manualAdjustmentEnabled?: boolean;
  manualTimes?: string[];
};

const VALID_WEEKLY_DAYS = new Set([
  'SEGUNDA',
  'TERCA',
  'QUARTA',
  'QUINTA',
  'SEXTA',
  'SABADO',
  'DOMINGO',
]);

@ValidatorConstraint({ name: 'PatientPrescriptionPhaseValid', async: false })
export class PatientPrescriptionPhaseValidator
  implements ValidatorConstraintInterface
{
  validate(_: unknown, args: ValidationArguments): boolean {
    return !getPhaseValidationError(args.object as PhaseLike);
  }

  defaultMessage(args: ValidationArguments): string {
    return (
      getPhaseValidationError(args.object as PhaseLike) ??
      'Fase terapêutica inválida.'
    );
  }
}

export function IsPatientPrescriptionPhaseValid(
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: PatientPrescriptionPhaseValidator,
    });
  };
}

export function getPhaseValidationError(phase: PhaseLike): string | undefined {
  const hasMonthlySpecialReference = isPresent(phase.monthlySpecialReference);
  const hasMonthlySpecialBaseDate = isPresent(phase.monthlySpecialBaseDate);
  const monthlySpecialOffsetDays = phase.monthlySpecialOffsetDays;
  const hasMonthlySpecialOffsetDays = isPresent(monthlySpecialOffsetDays);
  const hasAnyMonthlySpecialRule =
    hasMonthlySpecialReference || hasMonthlySpecialBaseDate || hasMonthlySpecialOffsetDays;

  if ((phase.phaseOrder ?? 0) < 1) {
    return 'phaseOrder deve iniciar em 1.';
  }

  if (phase.continuousUse && phase.treatmentDays !== undefined) {
    return 'continuousUse nao pode ser combinado com treatmentDays.';
  }

  if (
    !phase.continuousUse &&
    phase.recurrenceType !== TreatmentRecurrence.PRN &&
    phase.treatmentDays === undefined
  ) {
    return 'treatmentDays e obrigatorio quando a fase nao for continua e nem PRN.';
  }

  if (
    phase.recurrenceType === TreatmentRecurrence.WEEKLY &&
    (!phase.weeklyDay ||
      !VALID_WEEKLY_DAYS.has(phase.weeklyDay.trim().toUpperCase()))
  ) {
    return 'weeklyDay deve ser um dia valido da semana.';
  }

  if (
    phase.recurrenceType === TreatmentRecurrence.MONTHLY &&
    !isPresent(phase.monthlyDay) &&
    !phase.monthlyRule &&
    !hasAnyMonthlySpecialRule
  ) {
    return 'monthlyDay ou monthlyRule sao obrigatorios para recorrencia MONTHLY.';
  }

  if (
    hasMonthlySpecialOffsetDays &&
    monthlySpecialOffsetDays <= 0
  ) {
    return 'monthlySpecialOffsetDays deve ser maior que zero quando monthlySpecial* for informado.';
  }

  if (
    phase.recurrenceType === TreatmentRecurrence.ALTERNATE_DAYS &&
    phase.alternateDaysInterval === undefined
  ) {
    return 'alternateDaysInterval e obrigatorio para recorrencia ALTERNATE_DAYS.';
  }

  if (phase.recurrenceType === TreatmentRecurrence.PRN && !phase.prnReason) {
    return 'prnReason e obrigatorio para recorrencia PRN.';
  }

  if (phase.recurrenceType !== TreatmentRecurrence.PRN && phase.prnReason) {
    return 'prnReason so pode ser usado quando recurrenceType for PRN.';
  }

  if (
    phase.sameDosePerSchedule === false &&
    (!phase.perDoseOverrides || phase.perDoseOverrides.length !== phase.frequency)
  ) {
    return 'perDoseOverrides deve cobrir exatamente a quantidade de doses da fase.';
  }

  if (
    phase.sameDosePerSchedule === false &&
    phase.perDoseOverrides &&
    !coversAllDoseLabels(phase.perDoseOverrides, phase.frequency ?? 0)
  ) {
    return 'perDoseOverrides deve conter D1..Dn sem repeticao.';
  }

  if (phase.manualAdjustmentEnabled && (!phase.manualTimes || phase.manualTimes.length === 0)) {
    return 'manualTimes e obrigatorio quando manualAdjustmentEnabled for true.';
  }

  if (
    phase.manualAdjustmentEnabled &&
    phase.manualTimes &&
    phase.frequency !== undefined &&
    phase.manualTimes.length !== phase.frequency
  ) {
    return 'manualTimes deve corresponder exatamente a frequencia da fase.';
  }

  return undefined;
}

function isPresent<T>(value: T | null | undefined): value is NonNullable<T> {
  return value !== undefined && value !== null;
}

function coversAllDoseLabels(
  perDoseOverrides: { doseLabel?: string }[],
  frequency: number,
): boolean {
  const expected = Array.from({ length: frequency }, (_, index) => `D${index + 1}`);
  const actual = new Set(perDoseOverrides.map((override) => override.doseLabel));
  return expected.every((label) => actual.has(label));
}

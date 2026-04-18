import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PrnReason } from '../../../common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';

type PrescriptionItemLike = {
  frequency?: number;
  recurrenceType?: TreatmentRecurrence;
  alternateDaysInterval?: number;
  weeklyDay?: string;
  monthlyRule?: string;
  monthlyDay?: number;
  treatmentDays?: number;
  continuousUse?: boolean;
  prnReason?: PrnReason;
  manualAdjustmentEnabled?: boolean;
  manualTimes?: string[];
  sameDosePerSchedule?: boolean;
  perDoseOverrides?: unknown[];
  crisisOnly?: boolean;
  feverOnly?: boolean;
  painOnly?: boolean;
};

@ValidatorConstraint({ name: 'PrescriptionItemClinicalRules', async: false })
export class PrescriptionItemClinicalRulesValidator
  implements ValidatorConstraintInterface
{
  validate(_: unknown, args: ValidationArguments): boolean {
    return !getPrescriptionItemValidationError(
      args.object as PrescriptionItemLike,
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return (
      getPrescriptionItemValidationError(args.object as PrescriptionItemLike) ??
      'Payload clinico da prescricao invalido.'
    );
  }
}

export function IsPrescriptionItemClinicallyValid(
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: PrescriptionItemClinicalRulesValidator,
    });
  };
}

export function getEffectiveRecurrenceType(
  item: PrescriptionItemLike,
): TreatmentRecurrence {
  if (item.recurrenceType) {
    return item.recurrenceType;
  }

  if (
    item.prnReason ||
    item.crisisOnly ||
    item.feverOnly ||
    item.painOnly
  ) {
    return TreatmentRecurrence.PRN;
  }

  if (item.monthlyDay !== undefined || hasText(item.monthlyRule)) {
    return TreatmentRecurrence.MONTHLY;
  }

  if (hasText(item.weeklyDay)) {
    return TreatmentRecurrence.WEEKLY;
  }

  if (
    item.alternateDaysInterval !== undefined &&
    item.alternateDaysInterval > 1
  ) {
    return TreatmentRecurrence.ALTERNATE_DAYS;
  }

  return TreatmentRecurrence.DAILY;
}

export function getEffectivePrnReason(
  item: PrescriptionItemLike,
): PrnReason | undefined {
  if (item.prnReason) {
    return item.prnReason;
  }

  if (item.crisisOnly) return PrnReason.CRISIS;
  if (item.feverOnly) return PrnReason.FEVER;
  if (item.painOnly) return PrnReason.PAIN;
  return undefined;
}

export function shouldValidateAlternateDaysInterval(
  item: PrescriptionItemLike,
  value: unknown,
): boolean {
  return (
    value !== undefined ||
    getEffectiveRecurrenceType(item) === TreatmentRecurrence.ALTERNATE_DAYS
  );
}

export function shouldValidateWeeklyDay(
  item: PrescriptionItemLike,
  value: unknown,
): boolean {
  return (
    value !== undefined ||
    getEffectiveRecurrenceType(item) === TreatmentRecurrence.WEEKLY
  );
}

export function shouldValidateMonthlyDay(
  _item: PrescriptionItemLike,
  value: unknown,
): boolean {
  return value !== undefined;
}

export function shouldValidateMonthlyRule(
  _item: PrescriptionItemLike,
  value: unknown,
): boolean {
  return value !== undefined;
}

export function shouldValidateTreatmentDays(
  item: PrescriptionItemLike,
  value: unknown,
): boolean {
  return (
    value !== undefined ||
    (!item.continuousUse &&
      getEffectiveRecurrenceType(item) !== TreatmentRecurrence.PRN)
  );
}

export function shouldValidateManualTimes(
  item: PrescriptionItemLike,
  value: unknown,
): boolean {
  return value !== undefined || Boolean(item.manualAdjustmentEnabled);
}

export function shouldValidatePerDoseOverrides(
  item: PrescriptionItemLike,
  value: unknown,
): boolean {
  return value !== undefined || item.sameDosePerSchedule === false;
}

function getPrescriptionItemValidationError(
  item: PrescriptionItemLike,
): string | undefined {
  const recurrenceType = getEffectiveRecurrenceType(item);
  const prnReason = getEffectivePrnReason(item);

  if (item.continuousUse && item.treatmentDays !== undefined) {
    return 'continuousUse nao pode ser combinado com treatmentDays.';
  }

  if (
    recurrenceType !== TreatmentRecurrence.ALTERNATE_DAYS &&
    item.alternateDaysInterval !== undefined
  ) {
    return 'alternateDaysInterval so pode ser informado para recorrencia ALTERNATE_DAYS.';
  }

  if (
    recurrenceType !== TreatmentRecurrence.WEEKLY &&
    hasText(item.weeklyDay)
  ) {
    return 'weeklyDay so pode ser informado para recorrencia WEEKLY.';
  }

  if (
    recurrenceType !== TreatmentRecurrence.MONTHLY &&
    (item.monthlyDay !== undefined || hasText(item.monthlyRule))
  ) {
    return 'monthlyDay e monthlyRule so podem ser informados para recorrencia MONTHLY.';
  }

  if (
    recurrenceType !== TreatmentRecurrence.PRN &&
    (item.prnReason ||
      item.crisisOnly ||
      item.feverOnly ||
      item.painOnly)
  ) {
    return 'prnReason e flags legadas de PRN so podem ser informados para recorrencia PRN.';
  }

  if (
    recurrenceType === TreatmentRecurrence.MONTHLY &&
    item.monthlyDay === undefined &&
    !hasText(item.monthlyRule)
  ) {
    return 'Informe monthlyDay ou monthlyRule para recorrencia MONTHLY.';
  }

  if (
    recurrenceType === TreatmentRecurrence.ALTERNATE_DAYS &&
    item.alternateDaysInterval === undefined
  ) {
    return 'alternateDaysInterval e obrigatorio para recorrencia ALTERNATE_DAYS.';
  }

  if (
    recurrenceType === TreatmentRecurrence.PRN &&
    !prnReason
  ) {
    return 'prnReason e obrigatorio para recorrencia PRN.';
  }

  if (
    !item.continuousUse &&
    recurrenceType !== TreatmentRecurrence.PRN &&
    item.treatmentDays === undefined
  ) {
    return 'treatmentDays e obrigatorio quando o tratamento nao for continuo e nem PRN.';
  }

  if (
    item.manualAdjustmentEnabled &&
    (!item.manualTimes || item.manualTimes.length === 0)
  ) {
    return 'manualTimes e obrigatorio quando manualAdjustmentEnabled for true.';
  }

  if (
    item.manualAdjustmentEnabled &&
    item.manualTimes &&
    item.frequency !== undefined &&
    item.manualTimes.length !== item.frequency
  ) {
    return 'manualTimes deve ter a mesma quantidade de horarios de frequency.';
  }

  if (
    !item.manualAdjustmentEnabled &&
    item.manualTimes &&
    item.manualTimes.length > 0
  ) {
    return 'manualTimes so pode ser informado quando manualAdjustmentEnabled for true.';
  }

  if (
    item.sameDosePerSchedule === false &&
    (!item.perDoseOverrides || item.perDoseOverrides.length === 0)
  ) {
    return 'perDoseOverrides e obrigatorio quando sameDosePerSchedule for false.';
  }

  if (
    item.sameDosePerSchedule === false &&
    item.perDoseOverrides &&
    item.frequency !== undefined &&
    item.perDoseOverrides.length !== item.frequency
  ) {
    return 'perDoseOverrides deve ter a mesma quantidade de doses de frequency.';
  }

  if (
    item.sameDosePerSchedule !== false &&
    item.perDoseOverrides &&
    item.perDoseOverrides.length > 0
  ) {
    return 'perDoseOverrides so pode ser informado quando sameDosePerSchedule for false.';
  }

  return undefined;
}

function hasText(value?: string): boolean {
  return Boolean(value?.trim());
}

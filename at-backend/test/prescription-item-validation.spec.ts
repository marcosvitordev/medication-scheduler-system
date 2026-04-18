import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { DoseUnit } from '../src/common/enums/dose-unit.enum';
import { PrnReason } from '../src/common/enums/prn-reason.enum';
import { TreatmentRecurrence } from '../src/common/enums/treatment-recurrence.enum';
import { CreatePrescriptionItemDto } from '../src/modules/prescriptions/dto/create-prescription.dto';

describe('CreatePrescriptionItemDto clinical validation', () => {
  function buildValidItem(
    overrides: Partial<CreatePrescriptionItemDto> = {},
  ): CreatePrescriptionItemDto {
    return plainToInstance(CreatePrescriptionItemDto, {
      medicationId: '550e8400-e29b-41d4-a716-446655440000',
      frequency: 2,
      doseAmount: '1 COMP',
      doseValue: '1',
      doseUnit: DoseUnit.COMP,
      sameDosePerSchedule: true,
      recurrenceType: TreatmentRecurrence.DAILY,
      treatmentDays: 10,
      continuousUse: false,
      manualAdjustmentEnabled: false,
      ...overrides,
    });
  }

  function validateItem(item: CreatePrescriptionItemDto): string[] {
    return flattenErrors(validateSync(item));
  }

  it('rejects weekly recurrence without weeklyDay', () => {
    const errors = validateItem(
      buildValidItem({
        recurrenceType: TreatmentRecurrence.WEEKLY,
        weeklyDay: undefined,
      }),
    );

    expect(errors).toContain(
      'weeklyDay é obrigatório para recorrência WEEKLY.',
    );
  });

  it('rejects monthly recurrence without monthlyDay or monthlyRule', () => {
    const errors = validateItem(
      buildValidItem({
        recurrenceType: TreatmentRecurrence.MONTHLY,
        monthlyDay: undefined,
        monthlyRule: undefined,
      }),
    );

    expect(errors).toContain(
      'Informe monthlyDay ou monthlyRule para recorrencia MONTHLY.',
    );
  });

  it('rejects PRN recurrence without prnReason', () => {
    const errors = validateItem(
      buildValidItem({
        recurrenceType: TreatmentRecurrence.PRN,
        prnReason: undefined,
        treatmentDays: undefined,
      }),
    );

    expect(errors).toContain('prnReason e obrigatorio para recorrencia PRN.');
  });

  it('rejects manual adjustment without manualTimes', () => {
    const errors = validateItem(
      buildValidItem({
        manualAdjustmentEnabled: true,
        manualTimes: undefined,
      }),
    );

    expect(errors).toContain(
      'manualTimes é obrigatório quando manualAdjustmentEnabled for true.',
    );
  });

  it('rejects manual adjustment when manualTimes count does not match frequency', () => {
    const errors = validateItem(
      buildValidItem({
        manualAdjustmentEnabled: true,
        manualTimes: ['08:00'],
      }),
    );

    expect(errors).toContain(
      'manualTimes deve ter a mesma quantidade de horarios de frequency.',
    );
  });

  it('rejects variable dose without perDoseOverrides', () => {
    const errors = validateItem(
      buildValidItem({
        sameDosePerSchedule: false,
        perDoseOverrides: undefined,
      }),
    );

    expect(errors).toContain(
      'perDoseOverrides e obrigatorio quando sameDosePerSchedule for false.',
    );
  });

  it('rejects continuous use combined with treatmentDays', () => {
    const errors = validateItem(
      buildValidItem({
        continuousUse: true,
        treatmentDays: 15,
      }),
    );

    expect(errors).toContain(
      'continuousUse nao pode ser combinado com treatmentDays.',
    );
  });

  it('accepts a valid alternate-days payload', () => {
    const errors = validateItem(
      buildValidItem({
        recurrenceType: TreatmentRecurrence.ALTERNATE_DAYS,
        alternateDaysInterval: 2,
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it('accepts a valid PRN payload', () => {
    const errors = validateItem(
      buildValidItem({
        recurrenceType: TreatmentRecurrence.PRN,
        prnReason: PrnReason.FEVER,
        treatmentDays: undefined,
      }),
    );

    expect(errors).toHaveLength(0);
  });
});

function flattenErrors(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...flattenErrors(error.children ?? []),
  ]);
}

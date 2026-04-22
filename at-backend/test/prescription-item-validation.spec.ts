import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { ClinicalAnchor } from '../src/common/enums/clinical-anchor.enum';
import { ClinicalInteractionType } from '../src/common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../src/common/enums/clinical-resolution-type.enum';
import { DoseUnit } from '../src/common/enums/dose-unit.enum';
import { PrnReason } from '../src/common/enums/prn-reason.enum';
import { MonthlySpecialReference } from '../src/common/enums/monthly-special-reference.enum';
import { OcularLaterality } from '../src/common/enums/ocular-laterality.enum';
import { OticLaterality } from '../src/common/enums/otic-laterality.enum';
import { TreatmentRecurrence } from '../src/common/enums/treatment-recurrence.enum';
import {
  CreateClinicalMedicationDto,
} from '../src/modules/clinical-catalog/dto/create-clinical-medication.dto';
import { CreatePatientPrescriptionPhaseDto } from '../src/modules/patient-prescriptions/dto/create-patient-prescription.dto';

describe('New DTO clinical validation', () => {
  function validatePhase(overrides: Partial<CreatePatientPrescriptionPhaseDto> = {}): string[] {
    const phase = plainToInstance(CreatePatientPrescriptionPhaseDto, {
      phaseOrder: 1,
      frequency: 2,
      sameDosePerSchedule: true,
      doseAmount: '1 COMP',
      doseValue: '1',
      doseUnit: DoseUnit.COMP,
      recurrenceType: TreatmentRecurrence.DAILY,
      treatmentDays: 10,
      continuousUse: false,
      manualAdjustmentEnabled: false,
      ...overrides,
    });

    return flattenErrors(validateSync(phase));
  }

  it('rejects weekly recurrence without weeklyDay', () => {
    expect(
      validatePhase({
        recurrenceType: TreatmentRecurrence.WEEKLY,
        weeklyDay: undefined,
      }),
    ).toContain('weeklyDay deve ser um dia valido da semana.');
  });

  it('rejects monthly recurrence without monthlyDay or monthlyRule', () => {
    expect(
      validatePhase({
        recurrenceType: TreatmentRecurrence.MONTHLY,
        monthlyDay: undefined,
        monthlyRule: undefined,
      }),
    ).toContain('monthlyDay ou monthlyRule sao obrigatorios para recorrencia MONTHLY.');
  });

  it('rejects PRN recurrence without prnReason', () => {
    expect(
      validatePhase({
        recurrenceType: TreatmentRecurrence.PRN,
        treatmentDays: undefined,
        prnReason: undefined,
      }),
    ).toContain('prnReason e obrigatorio para recorrencia PRN.');
  });

  it('rejects prnReason outside PRN recurrence', () => {
    expect(
      validatePhase({
        recurrenceType: TreatmentRecurrence.DAILY,
        prnReason: PrnReason.PAIN,
      }),
    ).toContain('prnReason so pode ser usado quando recurrenceType for PRN.');
  });

  it('accepts expanded PRN reasons', () => {
    expect(
      validatePhase({
        recurrenceType: TreatmentRecurrence.PRN,
        treatmentDays: undefined,
        prnReason: PrnReason.NAUSEA_VOMITING,
      }),
    ).toHaveLength(0);

    expect(
      validatePhase({
        recurrenceType: TreatmentRecurrence.PRN,
        treatmentDays: undefined,
        prnReason: PrnReason.SHORTNESS_OF_BREATH,
      }),
    ).toHaveLength(0);
  });

  it('accepts monthly recurrence with monthlySpecial* payload', () => {
    expect(
      validatePhase({
        recurrenceType: TreatmentRecurrence.MONTHLY,
        monthlySpecialReference: MonthlySpecialReference.MENSTRUATION_START,
        monthlySpecialBaseDate: '2026-02-20',
        monthlySpecialOffsetDays: 8,
        monthlyDay: undefined,
        monthlyRule: undefined,
      }),
    ).toHaveLength(0);
  });

  it('rejects invalid monthlySpecialReference enum value', () => {
    const errors = validatePhase({
      recurrenceType: TreatmentRecurrence.MONTHLY,
      monthlySpecialReference: 'INVALID' as MonthlySpecialReference,
      monthlySpecialBaseDate: '2026-02-20',
      monthlySpecialOffsetDays: 8,
    });
    expect(errors.some((message) => message.includes('monthlySpecialReference'))).toBe(true);
  });

  it('rejects invalid monthlySpecialBaseDate', () => {
    const errors = validatePhase({
      recurrenceType: TreatmentRecurrence.MONTHLY,
      monthlySpecialReference: MonthlySpecialReference.MENSTRUATION_START,
      monthlySpecialBaseDate: '20/02/2026',
      monthlySpecialOffsetDays: 8,
    });
    expect(errors.some((message) => message.includes('monthlySpecialBaseDate'))).toBe(true);
  });

  it('rejects invalid monthlySpecialOffsetDays', () => {
    const errors = validatePhase({
      recurrenceType: TreatmentRecurrence.MONTHLY,
      monthlySpecialReference: MonthlySpecialReference.MENSTRUATION_START,
      monthlySpecialBaseDate: '2026-02-20',
      monthlySpecialOffsetDays: -1,
    });
    expect(errors.some((message) => message.includes('monthlySpecialOffsetDays'))).toBe(true);
  });

  it('rejects manual adjustment without manualTimes', () => {
    expect(
      validatePhase({
        manualAdjustmentEnabled: true,
        manualTimes: undefined,
      }),
    ).toContain('manualTimes e obrigatorio quando manualAdjustmentEnabled for true.');
  });

  it('rejects variable dose without complete D1..Dn coverage', () => {
    expect(
      validatePhase({
        sameDosePerSchedule: false,
        perDoseOverrides: [{ doseLabel: 'D1', doseValue: '1', doseUnit: DoseUnit.COMP }],
      }),
    ).toContain('perDoseOverrides deve cobrir exatamente a quantidade de doses da fase.');
  });

  it('rejects continuous use combined with treatmentDays', () => {
    expect(
      validatePhase({
        continuousUse: true,
        treatmentDays: 10,
      }),
    ).toContain('continuousUse nao pode ser combinado com treatmentDays.');
  });

  it('accepts a valid alternate-days phase', () => {
    expect(
      validatePhase({
        recurrenceType: TreatmentRecurrence.ALTERNATE_DAYS,
        alternateDaysInterval: 2,
      }),
    ).toHaveLength(0);
  });

  it('accepts valid ocular and otic laterality enums', () => {
    expect(
      validatePhase({
        ocularLaterality: OcularLaterality.RIGHT_EYE,
      }),
    ).toHaveLength(0);

    expect(
      validatePhase({
        oticLaterality: OticLaterality.BOTH_EARS,
      }),
    ).toHaveLength(0);
  });

  it('rejects invalid ocular/otic laterality enum values', () => {
    const ocularErrors = validatePhase({
      ocularLaterality: 'INVALID' as OcularLaterality,
    });
    const oticErrors = validatePhase({
      oticLaterality: 'INVALID' as OticLaterality,
    });

    expect(ocularErrors.some((message) => message.includes('ocularLaterality'))).toBe(true);
    expect(oticErrors.some((message) => message.includes('oticLaterality'))).toBe(true);
  });

  it('accepts valid glycemiaScaleRanges payload', () => {
    expect(
      validatePhase({
        glycemiaScaleRanges: [
          { minimum: 140, maximum: 180, doseValue: '2', doseUnit: DoseUnit.UI },
          { minimum: 181, maximum: 220, doseValue: '4', doseUnit: DoseUnit.UI },
        ],
      }),
    ).toHaveLength(0);
  });

  it('rejects invalid glycemiaScaleRanges unit', () => {
    const errors = validatePhase({
      glycemiaScaleRanges: [
        { minimum: 140, maximum: 180, doseValue: '2', doseUnit: 'INVALID' as DoseUnit },
      ],
    });

    expect(errors.some((message) => message.includes('doseUnit'))).toBe(true);
  });

  it('rejects clinical medication creation without protocol frequencies and steps', () => {
    const dto = plainToInstance(CreateClinicalMedicationDto, {
      activePrinciple: 'Teste',
      presentation: 'Caixa',
      administrationRoute: 'VO',
      usageInstructions: 'Conforme prescrição',
      protocols: [
        {
          code: 'PROTO',
          name: 'Protocolo',
          description: 'Desc',
          groupCode: 'GROUP_I',
          frequencies: [],
          interactionRules: [
            {
              interactionType: ClinicalInteractionType.AFFECTED_BY_SALTS,
              resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
            },
          ],
        },
      ],
    });

    const errors = flattenErrors(validateSync(dto));
    expect(errors).toContain('frequencies must contain at least 1 elements');
  });

  it('accepts a valid clinical medication payload with protocol, frequencies and steps', () => {
    const dto = plainToInstance(CreateClinicalMedicationDto, {
      activePrinciple: 'Teste',
      presentation: 'Caixa',
      administrationRoute: 'VO',
      usageInstructions: 'Conforme prescrição',
      protocols: [
        {
          code: 'PROTO',
          name: 'Protocolo',
          description: 'Desc',
          groupCode: 'GROUP_I',
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: ClinicalAnchor.CAFE,
                  offsetMinutes: 0,
                },
              ],
            },
          ],
          interactionRules: [],
        },
      ],
    });

    expect(flattenErrors(validateSync(dto))).toHaveLength(0);
  });
});

function flattenErrors(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...flattenErrors(error.children ?? []),
  ]);
}

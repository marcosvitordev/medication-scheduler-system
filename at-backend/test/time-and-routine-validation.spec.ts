import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { calculateEndDate } from '../src/common/utils/treatment-window.util';
import { hhmmToMinutes } from '../src/common/utils/time.util';
import { CreateRoutineDto } from '../src/modules/patients/dto/create-routine.dto';

describe('time and routine validation', () => {
  it('rejects invalid routine times like 99:99', () => {
    const routine = plainToInstance(CreateRoutineDto, {
      acordar: '99:99',
      cafe: '07:00',
      almoco: '12:00',
      lanche: '15:00',
      jantar: '19:00',
      dormir: '22:00',
    });

    const errors = flattenErrors(validateSync(routine));
    expect(errors).toContain(
      'acordar deve estar no formato HH:mm com hora entre 00-23 e minuto entre 00-59.',
    );
  });

  it('throws a clear exception when converting an invalid HH:mm string', () => {
    expect(() => hhmmToMinutes('24:99')).toThrow(BadRequestException);
  });

  it('calculates endDate without UTC drift', () => {
    expect(calculateEndDate('2026-04-17', 10)).toBe('2026-04-26');
    expect(calculateEndDate('2026-01-30', 5)).toBe('2026-02-03');
  });

  it('throws a bad request exception for invalid clinical dates', () => {
    expect(() => calculateEndDate('2026-02-30', 3)).toThrow(BadRequestException);
  });
});

function flattenErrors(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...flattenErrors(error.children ?? []),
  ]);
}

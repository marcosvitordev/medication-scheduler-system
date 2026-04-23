import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { calculateEndDate } from '../src/common/utils/treatment-window.util';
import {
  formatMinuteIndex,
  hhmmToMinutes,
  normalizeRoutineTimeline,
  parseClockInput,
} from '../src/common/utils/time.util';
import { validateRoutine } from '../src/common/utils/routine.util';
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
      'acordar deve estar no formato HH:mm com hora entre 00-23 e minuto entre 00-59, ou 24:00.',
    );
  });

  it('throws a clear exception when converting an invalid HH:mm string', () => {
    expect(() => hhmmToMinutes('24:99')).toThrow(BadRequestException);
  });

  it('accepts 24:00 as a valid clinical clock input', () => {
    expect(parseClockInput('24:00')).toMatchObject({
      dayMinutes: 1440,
      isEndOfDayBoundary: true,
    });
  });

  it('rejects invalid values beyond the end-of-day boundary', () => {
    expect(() => parseClockInput('24:01')).toThrow(BadRequestException);
    expect(() => parseClockInput('25:00')).toThrow(BadRequestException);
  });

  it('formats clinical minute indices across midnight without collapsing 24:00', () => {
    expect(formatMinuteIndex(1440)).toBe('24:00');
    expect(formatMinuteIndex(1500)).toBe('01:00');
  });

  it('normalizes dormir=24:00 on the same clinical day', () => {
    expect(
      normalizeRoutineTimeline({
        acordar: '06:00',
        cafe: '07:00',
        almoco: '12:00',
        lanche: '15:00',
        jantar: '21:00',
        dormir: '24:00',
      }),
    ).toMatchObject({
      JANTAR: 1260,
      DORMIR: 1440,
    });
  });

  it('normalizes dormir after midnight onto the next clinical day', () => {
    expect(
      normalizeRoutineTimeline({
        acordar: '06:00',
        cafe: '07:00',
        almoco: '12:00',
        lanche: '15:00',
        jantar: '21:00',
        dormir: '01:00',
      }),
    ).toMatchObject({
      JANTAR: 1260,
      DORMIR: 1500,
    });
    expect(
      normalizeRoutineTimeline({
        acordar: '05:00',
        cafe: '07:00',
        almoco: '12:00',
        lanche: '16:00',
        jantar: '19:00',
        dormir: '02:00',
      }),
    ).toMatchObject({
      JANTAR: 1140,
      DORMIR: 1560,
    });
  });

  it('accepts valid routines when dormir crosses midnight and keeps interval validation', () => {
    expect(() =>
      validateRoutine({
        acordar: '06:00',
        cafe: '07:00',
        almoco: '12:00',
        lanche: '15:00',
        jantar: '21:00',
        dormir: '24:00',
      }),
    ).not.toThrow();

    expect(() =>
      validateRoutine({
        acordar: '06:00',
        cafe: '07:00',
        almoco: '12:00',
        lanche: '15:00',
        jantar: '21:00',
        dormir: '01:00',
      }),
    ).not.toThrow();

    expect(() =>
      validateRoutine({
        acordar: '05:00',
        cafe: '07:00',
        almoco: '12:00',
        lanche: '16:00',
        jantar: '19:00',
        dormir: '02:00',
      }),
    ).not.toThrow();
  });

  it('still rejects invalid sleep intervals after timeline normalization', () => {
    expect(() =>
      validateRoutine({
        acordar: '06:00',
        cafe: '07:00',
        almoco: '12:00',
        lanche: '15:00',
        jantar: '23:00',
        dormir: '24:00',
      }),
    ).toThrow(BadRequestException);
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

import { BadRequestException } from '@nestjs/common';
import { MealAnchor } from '../enums/meal-anchor.enum';

const MINUTES_PER_DAY = 24 * 60;

export interface ParsedClockInput {
  raw: string;
  hours: number;
  minutes: number;
  dayMinutes: number;
  isEndOfDayBoundary: boolean;
}

export interface RoutineClockInput {
  acordar: string;
  cafe: string;
  almoco: string;
  lanche: string;
  jantar: string;
  dormir: string;
}
export type RoutineTimeline = Record<MealAnchor, number>;

export function parseClockInput(value: string): ParsedClockInput {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new BadRequestException(`Horário inválido: ${value}. Use o formato HH:mm.`);
  }

  const [hours, minutes] = value.split(':').map(Number);
  const isEndOfDayBoundary = hours === 24 && minutes === 0;
  const isStandardClockTime = hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;

  if (!isStandardClockTime && !isEndOfDayBoundary) {
    throw new BadRequestException(`Horário inválido: ${value}. Use o formato HH:mm.`);
  }

  return {
    raw: value,
    hours,
    minutes,
    dayMinutes: hours * 60 + minutes,
    isEndOfDayBoundary,
  };
}

export function normalizeClockSequence(values: string[]): number[] {
  let dayOffset = 0;
  let previousMinuteIndex: number | undefined;

  return values.map((value) => {
    const parsed = parseClockInput(value);
    let minuteIndex = parsed.dayMinutes + dayOffset;

    if (previousMinuteIndex !== undefined && minuteIndex < previousMinuteIndex) {
      dayOffset += MINUTES_PER_DAY;
      minuteIndex = parsed.dayMinutes + dayOffset;
    }

    previousMinuteIndex = minuteIndex;
    return minuteIndex;
  });
}

export function normalizeRoutineTimeline(routine: RoutineClockInput): RoutineTimeline {
  const orderedAnchors = [
    { anchor: MealAnchor.ACORDAR, value: routine.acordar },
    { anchor: MealAnchor.CAFE, value: routine.cafe },
    { anchor: MealAnchor.ALMOCO, value: routine.almoco },
    { anchor: MealAnchor.LANCHE, value: routine.lanche },
    { anchor: MealAnchor.JANTAR, value: routine.jantar },
    { anchor: MealAnchor.DORMIR, value: routine.dormir },
  ] as const;
  const normalizedMinuteIndices = normalizeClockSequence(
    orderedAnchors.map(({ value }) => value),
  );

  return orderedAnchors.reduce((timeline, { anchor }, index) => {
    timeline[anchor] = normalizedMinuteIndices[index];
    return timeline;
  }, {} as RoutineTimeline);
}

export function formatMinuteIndex(total: number): string {
  if (total === MINUTES_PER_DAY) {
    return '24:00';
  }

  let normalized = total % MINUTES_PER_DAY;
  if (normalized < 0) normalized += MINUTES_PER_DAY;

  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minutes = String(normalized % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function hhmmToMinutes(value: string): number {
  return parseClockInput(value).dayMinutes;
}

export function minutesToHhmm(total: number): string {
  return formatMinuteIndex(total);
}

export function isValidHhmm(value: string): boolean {
  try {
    parseClockInput(value);
    return true;
  } catch {
    return false;
  }
}

export function assertValidHhmm(value: string): void {
  parseClockInput(value);
}

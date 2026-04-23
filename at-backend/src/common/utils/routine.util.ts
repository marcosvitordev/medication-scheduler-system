import { BadRequestException } from '@nestjs/common';
import { MealAnchor } from '../enums/meal-anchor.enum';
import { RoutineClockInput, normalizeRoutineTimeline } from './time.util';

export type RoutineClockMap = RoutineClockInput;

export function validateRoutine(routine: RoutineClockMap): void {
  const timeline = normalizeRoutineTimeline(routine);

  if (timeline[MealAnchor.CAFE] - timeline[MealAnchor.ACORDAR] < 60) {
    throw new BadRequestException('Café da manhã deve ocorrer pelo menos 1 hora após acordar.');
  }
  if (timeline[MealAnchor.ALMOCO] - timeline[MealAnchor.CAFE] < 240) {
    throw new BadRequestException('Almoço deve ocorrer pelo menos 4 horas após o café da manhã.');
  }
  if (timeline[MealAnchor.LANCHE] - timeline[MealAnchor.ALMOCO] < 180) {
    throw new BadRequestException('Lanche deve ocorrer pelo menos 3 horas após o almoço.');
  }
  if (timeline[MealAnchor.JANTAR] - timeline[MealAnchor.LANCHE] < 180) {
    throw new BadRequestException('Jantar deve ocorrer pelo menos 3 horas após o lanche.');
  }
  if (timeline[MealAnchor.DORMIR] - timeline[MealAnchor.JANTAR] < 120) {
    throw new BadRequestException('Dormir deve ocorrer pelo menos 2 horas após o jantar.');
  }
}

import { BadRequestException } from '@nestjs/common';

export function calculateEndDate(startDate: string, treatmentDays?: number): string | undefined {
  if (!treatmentDays || treatmentDays <= 0) {
    return undefined;
  }

  const date = parseClinicalDate(startDate);
  date.setDate(date.getDate() + treatmentDays - 1);

  const resultYear = String(date.getFullYear());
  const resultMonth = String(date.getMonth() + 1).padStart(2, '0');
  const resultDay = String(date.getDate()).padStart(2, '0');
  return `${resultYear}-${resultMonth}-${resultDay}`;
}

function parseClinicalDate(startDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startDate);

  if (!match) {
    throw new BadRequestException(`startedAt inválido para cálculo clínico: ${startDate}.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  const isValidDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isValidDate) {
    throw new BadRequestException(`startedAt inválido para cálculo clínico: ${startDate}.`);
  }

  return date;
}

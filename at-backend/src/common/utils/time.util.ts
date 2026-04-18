import { BadRequestException } from '@nestjs/common';

export function hhmmToMinutes(value: string): number {
  assertValidHhmm(value);

  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToHhmm(total: number): string {
  let normalized = total % (24 * 60);
  if (normalized < 0) normalized += 24 * 60;

  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minutes = String(normalized % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function isValidHhmm(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hours, minutes] = value.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export function assertValidHhmm(value: string): void {
  if (!isValidHhmm(value)) {
    throw new BadRequestException(`Horário inválido: ${value}. Use o formato HH:mm.`);
  }
}

export function calculateEndDate(startDate: string, treatmentDays?: number): string | undefined {
  if (!treatmentDays || treatmentDays <= 0) {
    return undefined;
  }

  const [year, month, day] = startDate.split('-').map(Number);

  if (!year || !month || !day) {
    throw new Error(`Data inválida para cálculo clínico: ${startDate}.`);
  }

  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + treatmentDays - 1);

  const resultYear = String(date.getFullYear());
  const resultMonth = String(date.getMonth() + 1).padStart(2, '0');
  const resultDay = String(date.getDate()).padStart(2, '0');
  return `${resultYear}-${resultMonth}-${resultDay}`;
}

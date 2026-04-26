import type { CalendarScheduleDoseDto, CalendarScheduleItemDto, ScheduleStatus } from "@/types/contracts";

export function statusVariant(status: ScheduleStatus | string) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "INACTIVE") return "destructive" as const;
  if (status === "MANUAL_ADJUSTMENT_REQUIRED") return "warning" as const;
  if (/manual/i.test(status)) return "warning" as const;
  if (/inativo/i.test(status)) return "destructive" as const;
  return "success" as const;
}

export function flattenDoses(scheduleItems: CalendarScheduleItemDto[]) {
  return scheduleItems
    .flatMap((item) =>
      item.doses.map((dose) => ({
        item,
        dose,
        key: `${item.prescriptionMedicationId}:${item.phaseId}:${dose.label}`,
      })),
    )
    .sort((left, right) =>
      left.dose.contextoHorario.horario_resolvido_minutos -
        right.dose.contextoHorario.horario_resolvido_minutos ||
      left.item.medicamento.localeCompare(right.item.medicamento),
    );
}

export function doseBorderClass(dose: CalendarScheduleDoseDto) {
  if (dose.status === "INACTIVE") return "border-l-destructive bg-destructive/5";
  if (dose.status === "MANUAL_ADJUSTMENT_REQUIRED") return "border-l-warning bg-warning/10";
  if (dose.contextoHorario.horario_original !== dose.horario) return "border-l-warning bg-warning/10";
  return "border-l-primary bg-white";
}

export function toDoseUnitLabel(unit?: string | null) {
  if (!unit) return "unidade";
  return unit;
}

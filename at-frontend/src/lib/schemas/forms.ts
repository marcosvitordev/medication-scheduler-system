import { z } from "zod";

const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:mm.");

const perDoseOverrideSchema = z.object({
  doseLabel: z.string().regex(/^D\d+$/, "Use o formato D1, D2, D3..."),
  doseValue: z.string().min(1, "Informe a dose."),
  doseUnit: z.string().min(1, "Selecione a unidade."),
});

const glycemiaScaleRangeSchema = z.object({
  minimum: z.preprocess(
    (value) => (value === "" || Number.isNaN(value) ? undefined : value),
    z.coerce.number().int("Informe valor inteiro.").min(0, "Informe valor mínimo maior ou igual a zero."),
  ),
  maximum: z.preprocess(
    (value) => (value === "" || Number.isNaN(value) ? undefined : value),
    z.coerce.number().int("Informe valor inteiro.").min(0, "Informe valor máximo maior ou igual a zero."),
  ),
  doseValue: z.string().min(1, "Informe a dose."),
  doseUnit: z.string().min(1, "Selecione a unidade."),
});

export const patientFormSchema = z.object({
  fullName: z.string().min(3, "Informe o nome completo."),
  birthDate: z.string().min(1, "Informe a data de nascimento."),
  rg: z.string().optional(),
  cpf: z.string().optional(),
  phone: z.string().optional(),
});

export const routineFormSchema = z.object({
  acordar: hhmmSchema,
  cafe: hhmmSchema,
  almoco: hhmmSchema,
  lanche: hhmmSchema,
  jantar: hhmmSchema,
  dormir: hhmmSchema,
  banho: hhmmSchema.optional().or(z.literal("")),
});

export const prescriptionPhaseFormSchema = z
  .object({
    frequency: z.coerce.number().min(1, "Selecione a frequência."),
    sameDosePerSchedule: z.boolean(),
    doseValue: z.string().optional(),
    doseUnit: z.string().optional(),
    perDoseOverrides: z.array(perDoseOverrideSchema).optional(),
    recurrenceType: z.enum(["DAILY", "WEEKLY", "MONTHLY", "ALTERNATE_DAYS", "PRN"]),
    weeklyDay: z.string().optional(),
    monthlyDay: z.preprocess(
      (value) => (value === "" || Number.isNaN(value) ? undefined : value),
      z.coerce.number().min(1, "Informe um dia entre 1 e 31.").max(31, "Informe um dia entre 1 e 31.").optional(),
    ),
    monthlySpecialReference: z.enum(["MENSTRUATION_START"]).optional(),
    monthlySpecialBaseDate: z.string().optional(),
    monthlySpecialOffsetDays: z.preprocess(
      (value) => (value === "" || Number.isNaN(value) ? undefined : value),
      z.coerce.number().int("Informe valor inteiro.").min(1, "Informe deslocamento maior que zero.").optional(),
    ),
    alternateDaysInterval: z.preprocess(
      (value) => (value === "" || Number.isNaN(value) ? undefined : value),
      z.coerce.number().min(2, "Informe intervalo mínimo de 2 dias.").optional(),
    ),
    prnReason: z.string().optional(),
    ocularLaterality: z.enum(["RIGHT_EYE", "LEFT_EYE", "BOTH_EYES"]).optional(),
    oticLaterality: z.enum(["RIGHT_EAR", "LEFT_EAR", "BOTH_EARS"]).optional(),
    glycemiaScaleRanges: z.array(glycemiaScaleRangeSchema).optional(),
    treatmentDays: z.preprocess(
      (value) => (value === "" || Number.isNaN(value) ? undefined : value),
      z.coerce.number().min(1, "Informe pelo menos 1 dia.").optional(),
    ),
    continuousUse: z.boolean(),
    manualAdjustmentEnabled: z.boolean(),
    manualTimes: z.array(hhmmSchema).optional(),
  })
  .superRefine((phase, context) => {
    if (phase.sameDosePerSchedule) {
      if (!phase.doseValue?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe a dose.",
          path: ["doseValue"],
        });
      }

      if (!phase.doseUnit) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione a unidade.",
          path: ["doseUnit"],
        });
      }
    }

    if (!phase.sameDosePerSchedule && (phase.perDoseOverrides ?? []).length !== phase.frequency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe dose e unidade para todos os horários da fase.",
        path: ["perDoseOverrides"],
      });
    }

    if (phase.continuousUse && phase.treatmentDays !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Uso contínuo não deve ter dias de tratamento.",
        path: ["treatmentDays"],
      });
    }

    if (!phase.continuousUse && phase.recurrenceType !== "PRN" && phase.treatmentDays === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe os dias de tratamento ou marque uso contínuo.",
        path: ["treatmentDays"],
      });
    }

    if (phase.recurrenceType === "WEEKLY" && !phase.weeklyDay) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione o dia da semana.",
        path: ["weeklyDay"],
      });
    }

    const hasMonthlySpecialFields =
      phase.monthlySpecialReference !== undefined ||
      Boolean(phase.monthlySpecialBaseDate) ||
      phase.monthlySpecialOffsetDays !== undefined;

    if (phase.recurrenceType === "MONTHLY" && phase.monthlyDay === undefined && !hasMonthlySpecialFields) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o dia do mês.",
        path: ["monthlyDay"],
      });
    }

    if (hasMonthlySpecialFields) {
      if (phase.recurrenceType !== "MONTHLY") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Regra mensal especial exige recorrência mensal.",
          path: ["recurrenceType"],
        });
      }

      if (!phase.monthlySpecialReference) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecione a referência mensal.",
          path: ["monthlySpecialReference"],
        });
      }

      if (!phase.monthlySpecialBaseDate) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe a data base clínica.",
          path: ["monthlySpecialBaseDate"],
        });
      }

      if (phase.monthlySpecialOffsetDays === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Informe o deslocamento em dias.",
          path: ["monthlySpecialOffsetDays"],
        });
      }
    }

    if (phase.recurrenceType === "ALTERNATE_DAYS" && phase.alternateDaysInterval === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o intervalo em dias.",
        path: ["alternateDaysInterval"],
      });
    }

    if (phase.recurrenceType === "PRN" && !phase.prnReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione o motivo de uso se necessário.",
        path: ["prnReason"],
      });
    }

    if (phase.manualAdjustmentEnabled && (phase.manualTimes ?? []).length !== phase.frequency) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe todos os horários manuais da fase.",
        path: ["manualTimes"],
      });
    }

    const ranges = [...(phase.glycemiaScaleRanges ?? [])].sort((left, right) => left.minimum - right.minimum);
    ranges.forEach((range, index) => {
      if (range.maximum < range.minimum) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "O valor máximo deve ser maior ou igual ao mínimo.",
          path: ["glycemiaScaleRanges", index, "maximum"],
        });
      }

      const previous = ranges[index - 1];
      if (!previous) return;

      if (range.minimum <= previous.maximum) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "As faixas glicêmicas não podem se sobrepor.",
          path: ["glycemiaScaleRanges"],
        });
      }

      if (range.minimum !== previous.maximum + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "As faixas glicêmicas não podem ter lacunas.",
          path: ["glycemiaScaleRanges"],
        });
      }
    });
  });

export const prescriptionMedicationFormSchema = z.object({
  clinicalMedicationId: z.string().min(1, "Selecione o medicamento."),
  protocolId: z.string().min(1, "Selecione o protocolo."),
  phases: z.array(prescriptionPhaseFormSchema).min(1, "Adicione ao menos uma fase."),
});

export const prescriptionFormSchema = z.object({
  startedAt: z.string().min(1, "Informe a data de início."),
  medications: z.array(prescriptionMedicationFormSchema).min(1, "Adicione ao menos um medicamento."),
});

export const manualAdjustmentSchema = z.object({
  times: z.array(hhmmSchema).min(1, "Informe ao menos um horário."),
});

export type PatientFormValues = z.infer<typeof patientFormSchema>;
export type RoutineFormValues = z.infer<typeof routineFormSchema>;
export type PrescriptionPhaseFormValues = z.infer<typeof prescriptionPhaseFormSchema>;
export type PrescriptionMedicationFormValues = z.infer<typeof prescriptionMedicationFormSchema>;
export type PrescriptionFormValues = z.infer<typeof prescriptionFormSchema>;
export type ManualAdjustmentValues = z.infer<typeof manualAdjustmentSchema>;

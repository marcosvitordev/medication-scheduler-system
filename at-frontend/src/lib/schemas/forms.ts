import { z } from "zod";

const hhmmSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:mm.");

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

export const prescriptionFormSchema = z.object({
  startedAt: z.string().min(1, "Informe a data de início."),
  clinicalMedicationId: z.string().min(1, "Selecione o medicamento."),
  protocolId: z.string().min(1, "Selecione o protocolo."),
  frequency: z.coerce.number().min(1, "Selecione a frequência."),
  doseValue: z.string().min(1, "Informe a dose."),
  doseUnit: z.string().min(1, "Selecione a unidade."),
  recurrenceType: z.enum(["DAILY", "WEEKLY", "MONTHLY", "ALTERNATE_DAYS", "PRN"]),
  treatmentDays: z.preprocess(
    (value) => (value === "" || Number.isNaN(value) ? undefined : value),
    z.coerce.number().min(1, "Informe pelo menos 1 dia.").optional(),
  ),
  continuousUse: z.boolean(),
  manualAdjustmentEnabled: z.boolean(),
  manualTimes: z.array(hhmmSchema).optional(),
});

export const manualAdjustmentSchema = z.object({
  times: z.array(hhmmSchema).min(1, "Informe ao menos um horário."),
});

export type PatientFormValues = z.infer<typeof patientFormSchema>;
export type RoutineFormValues = z.infer<typeof routineFormSchema>;
export type PrescriptionFormValues = z.infer<typeof prescriptionFormSchema>;
export type ManualAdjustmentValues = z.infer<typeof manualAdjustmentSchema>;

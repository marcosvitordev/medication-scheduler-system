import { apiRequest } from "@/lib/api/client";
import type {
  CalendarScheduleResponseDto,
  ClinicalMedication,
  CreatePatientPrescriptionDto,
  Patient,
  PatientRoutine,
  UpdatePatientPrescriptionDto,
} from "@/types/contracts";

export const patientService = {
  list: () => apiRequest<Patient[]>("/patients"),
  create: (body: {
    fullName: string;
    birthDate: string;
    rg?: string;
    cpf?: string;
    phone?: string;
  }) => apiRequest<Patient>("/patients", { method: "POST", body }),
  addRoutine: (patientId: string, body: Omit<PatientRoutine, "id" | "active" | "createdAt">) =>
    apiRequest<PatientRoutine>(`/patients/${patientId}/routines`, { method: "POST", body }),
};

export const clinicalCatalogService = {
  seed: () => apiRequest<unknown>("/clinical-catalog/seed", { method: "POST" }),
  listMedications: () => apiRequest<ClinicalMedication[]>("/clinical-catalog/medications"),
};

export const prescriptionService = {
  create: (body: CreatePatientPrescriptionDto) =>
    apiRequest<CalendarScheduleResponseDto>("/patient-prescriptions", { method: "POST", body }),
  update: (prescriptionId: string, body: UpdatePatientPrescriptionDto) =>
    apiRequest<CalendarScheduleResponseDto>(`/patient-prescriptions/${prescriptionId}`, {
      method: "PATCH",
      body,
    }),
  getSchedule: (prescriptionId: string) =>
    apiRequest<CalendarScheduleResponseDto>(`/patient-prescriptions/${prescriptionId}/schedule`),
};

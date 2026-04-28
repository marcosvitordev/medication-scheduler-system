const API_BASE = "/api";

async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Erro desconhecido" }));
    throw new Error(error.message || `Erro ${res.status}`);
  }

  return res.json();
}

// Patients
export const patientsApi = {
  list: () => fetcher<import("@/types").Patient[]>("/patients"),
  get: (id: string) => fetcher<import("@/types").Patient>(`/patients/${id}`),
  create: (data: import("@/types").CreatePatientDto) =>
    fetcher<import("@/types").Patient>("/patients", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  createRoutine: (patientId: string, data: import("@/types").CreateRoutineDto) =>
    fetcher<import("@/types").PatientRoutine>(`/patients/${patientId}/routines`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// Clinical Catalog
export const catalogApi = {
  seed: () =>
    fetcher<{ message: string }>("/clinical-catalog/seed", {
      method: "POST",
    }),
  listGroups: () => fetcher<import("@/types").ClinicalGroup[]>("/clinical-catalog/groups"),
  listMedications: () =>
    fetcher<import("@/types").ClinicalMedication[]>("/clinical-catalog/medications"),
  createMedication: (data: Partial<import("@/types").ClinicalMedication>) =>
    fetcher<import("@/types").ClinicalMedication>("/clinical-catalog/medications", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// Prescriptions
export const prescriptionsApi = {
  list: () => fetcher<import("@/types").PatientPrescription[]>("/patient-prescriptions"),
  get: (id: string) =>
    fetcher<import("@/types").PatientPrescription>(`/patient-prescriptions/${id}`),
  create: (data: import("@/types").CreatePrescriptionDto) =>
    fetcher<import("@/types").CalendarScheduleResponse>("/patient-prescriptions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<import("@/types").CreatePrescriptionDto>) =>
    fetcher<import("@/types").CalendarScheduleResponse>(`/patient-prescriptions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  getSchedule: (id: string) =>
    fetcher<import("@/types").CalendarScheduleResponse>(
      `/patient-prescriptions/${id}/schedule`
    ),
  addPhases: (
    prescriptionId: string,
    medicationId: string,
    data: { phases: import("@/types").PrescriptionPhase[] }
  ) =>
    fetcher<import("@/types").CalendarScheduleResponse>(
      `/patient-prescriptions/${prescriptionId}/medications/${medicationId}/phases`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    ),
};

// SWR fetcher
export const swrFetcher = <T>(url: string): Promise<T> => fetcher<T>(url);

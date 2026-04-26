export const queryKeys = {
  patients: ["patients"] as const,
  clinicalMedications: ["clinical-medications"] as const,
  schedule: (prescriptionId: string) => ["schedule", prescriptionId] as const,
};

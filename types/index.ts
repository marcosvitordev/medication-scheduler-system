// Patient Types
export interface PatientRoutine {
  id: string;
  acordar: string;
  cafe: string;
  almoco: string;
  lanche: string;
  jantar: string;
  dormir: string;
  banho?: string | null;
  active: boolean;
  createdAt: string;
}

export interface Patient {
  id: string;
  fullName: string;
  birthDate: string;
  rg?: string;
  cpf?: string;
  phone?: string;
  routines: PatientRoutine[];
}

export interface CreatePatientDto {
  fullName: string;
  birthDate: string;
  rg?: string;
  cpf?: string;
  phone?: string;
}

export interface CreateRoutineDto {
  acordar: string;
  cafe: string;
  almoco: string;
  lanche: string;
  jantar: string;
  dormir: string;
  banho?: string;
}

// Clinical Catalog Types
export interface ClinicalProtocol {
  id: string;
  code: string;
  description?: string;
}

export interface ClinicalMedication {
  id: string;
  commercialName?: string;
  activePrinciple: string;
  presentation: string;
  pharmaceuticalForm?: string;
  administrationRoute: string;
  usageInstructions: string;
  diluentType?: string;
  defaultAdministrationUnit?: string;
  supportsManualAdjustment: boolean;
  isOphthalmic: boolean;
  isOtic: boolean;
  isContraceptiveMonthly: boolean;
  requiresGlycemiaScale: boolean;
  notes?: string;
  isDefault: boolean;
  protocols: ClinicalProtocol[];
}

export interface ClinicalGroup {
  id: string;
  code: string;
  name: string;
  description?: string;
}

// Prescription Types
export interface PrescriptionPhase {
  phaseOrder: number;
  frequency: number;
  sameDosePerSchedule: boolean;
  doseAmount: string;
  doseValue: string;
  doseUnit: string;
  recurrenceType: "DAILY" | "WEEKLY" | "MONTHLY";
  treatmentDays?: number;
  continuousUse: boolean;
  manualAdjustmentEnabled: boolean;
  manualTimes?: string[];
}

export interface PrescriptionMedication {
  clinicalMedicationId: string;
  protocolId: string;
  phases: PrescriptionPhase[];
}

export interface CreatePrescriptionDto {
  patientId: string;
  startedAt: string;
  medications: PrescriptionMedication[];
}

export interface PatientPrescription {
  id: string;
  patient: Patient;
  startedAt: string;
  status: string;
  medications: Array<{
    id: string;
    clinicalMedication: ClinicalMedication;
    protocol: ClinicalProtocol;
    phases: Array<PrescriptionPhase & { id: string }>;
  }>;
}

// Schedule Types
export type ScheduleStatus = "ACTIVE" | "INACTIVE" | "MANUAL_ADJUSTMENT_REQUIRED";

export interface ScheduleDose {
  label: string;
  horario: string;
  doseValor: string | null;
  doseUnidade: string | null;
  doseExibicao: string;
  status: ScheduleStatus;
  statusLabel: string;
  observacao: string | null;
  reasonCode: string | null;
  reasonText: string | null;
  conflito: {
    tipo_resolucao_codigo: string | null;
    tipo_match_codigo: string | null;
  } | null;
}

export interface ScheduleItem {
  prescriptionMedicationId: string;
  phaseOrder: number;
  medicamento: string;
  principioAtivo: string;
  apresentacao: string;
  formaFarmaceutica: string | null;
  via: string;
  modoUso: string;
  recorrenciaTexto: string;
  inicio: string | null;
  termino: string | null;
  status: string;
  observacoes: string[];
  doses: ScheduleDose[];
}

export interface CalendarScheduleResponse {
  prescriptionId: string;
  documentHeader: {
    nomeEmpresa: string;
    cnpj: string;
    telefone: string;
    email: string;
    farmaceuticoNome: string;
    farmaceuticoCrf: string;
  };
  patient: {
    id: string;
    nome: string;
    dataNascimento: string | null;
    idade: number | null;
    rg: string | null;
    cpf: string | null;
    telefone: string | null;
  };
  routine: {
    acordar: string;
    cafe: string;
    almoco: string;
    lanche: string;
    jantar: string;
    dormir: string;
    banho: string | null;
  };
  scheduleItems: ScheduleItem[];
}

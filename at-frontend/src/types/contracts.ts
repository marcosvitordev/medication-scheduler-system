export type ScheduleStatus = "ACTIVE" | "INACTIVE" | "MANUAL_ADJUSTMENT_REQUIRED";

export type TreatmentRecurrence =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "ALTERNATE_DAYS"
  | "PRN";

export type DoseUnit =
  | "COMP"
  | "CAP"
  | "DRAGEA"
  | "ML"
  | "GOTAS"
  | "UI"
  | "JATOS"
  | "APLICADOR"
  | "BISNAGA"
  | "SUPOSITORIO"
  | "AREA_AFETADA";

export type OcularLaterality = "RIGHT_EYE" | "LEFT_EYE" | "BOTH_EYES";

export type OticLaterality = "RIGHT_EAR" | "LEFT_EAR" | "BOTH_EARS";

export type MonthlySpecialReference = "MENSTRUATION_START";

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
  createdAt?: string;
}

export interface Patient {
  id: string;
  fullName: string;
  birthDate: string;
  rg?: string | null;
  cpf?: string | null;
  phone?: string | null;
  routines?: PatientRoutine[];
}

export interface ClinicalProtocolStep {
  id?: string;
  doseLabel: string;
  anchor: string;
  offsetMinutes: number;
  semanticTag?: string;
}

export interface ClinicalProtocolFrequency {
  id?: string;
  frequency: number;
  label?: string | null;
  allowedRecurrenceTypes?: TreatmentRecurrence[];
  allowsPrn?: boolean;
  allowsVariableDoseBySchedule?: boolean;
  steps: ClinicalProtocolStep[];
}

export interface ClinicalProtocol {
  id: string;
  code: string;
  name: string;
  description: string;
  subgroupCode?: string | null;
  priority: number;
  isDefault: boolean;
  active: boolean;
  clinicalNotes?: string | null;
  group?: {
    id: string;
    code: string;
    name: string;
  };
  frequencies: ClinicalProtocolFrequency[];
}

export interface ClinicalMedication {
  id: string;
  commercialName?: string | null;
  activePrinciple: string;
  presentation: string;
  pharmaceuticalForm?: string | null;
  administrationRoute: string;
  usageInstructions: string;
  defaultAdministrationUnit?: DoseUnit | null;
  supportsManualAdjustment: boolean;
  isOphthalmic: boolean;
  isOtic: boolean;
  isContraceptiveMonthly: boolean;
  requiresGlycemiaScale: boolean;
  notes?: string | null;
  protocols: ClinicalProtocol[];
}

export interface CreatePatientPrescriptionPhaseDto {
  phaseOrder: number;
  frequency: number;
  sameDosePerSchedule: boolean;
  doseAmount?: string;
  doseValue?: string;
  doseUnit?: DoseUnit;
  perDoseOverrides?: Array<{
    doseLabel: string;
    doseValue: string;
    doseUnit: DoseUnit;
  }>;
  recurrenceType: TreatmentRecurrence;
  weeklyDay?: string;
  monthlyDay?: number;
  alternateDaysInterval?: number;
  prnReason?: string;
  monthlySpecialReference?: MonthlySpecialReference;
  monthlySpecialBaseDate?: string;
  monthlySpecialOffsetDays?: number;
  ocularLaterality?: OcularLaterality;
  oticLaterality?: OticLaterality;
  glycemiaScaleRanges?: Array<{
    minimum: number;
    maximum: number;
    doseValue: string;
    doseUnit: DoseUnit;
  }>;
  treatmentDays?: number;
  continuousUse: boolean;
  manualAdjustmentEnabled: boolean;
  manualTimes?: string[];
}

export interface CreatePatientPrescriptionDto {
  patientId: string;
  startedAt: string;
  medications: Array<{
    clinicalMedicationId: string;
    protocolId: string;
    phases: CreatePatientPrescriptionPhaseDto[];
  }>;
}

export interface UpdatePatientPrescriptionDto {
  startedAt?: string;
  updateMedications?: Array<{
    prescriptionMedicationId: string;
    updatePhases?: Array<{
      phaseId: string;
      manualAdjustmentEnabled?: boolean;
      manualTimes?: string[];
    }>;
  }>;
}

export interface CalendarDocumentHeaderDto {
  nomeEmpresa: string;
  cnpj: string;
  telefone: string;
  email: string;
  farmaceuticoNome: string;
  farmaceuticoCrf: string;
}

export interface CalendarPatientDto {
  id: string;
  nome: string;
  dataNascimento: string | null;
  idade: number | null;
  rg: string | null;
  cpf: string | null;
  telefone: string | null;
}

export interface CalendarRoutineDto {
  acordar: string;
  cafe: string;
  almoco: string;
  lanche: string;
  jantar: string;
  dormir: string;
  banho: string | null;
}

export interface CalendarScheduleDoseDto {
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
  contextoHorario: {
    ancora: string | null;
    ancora_horario_minutos: number | null;
    deslocamento_minutos: number | null;
    tag_semantica: string | null;
    horario_original_minutos: number;
    horario_original: string;
    horario_resolvido_minutos: number;
    horario_resolvido: string;
  };
  conflito: {
    tipo_interacao_codigo: string | null;
    tipo_interacao_label: string | null;
    tipo_resolucao_codigo: string | null;
    tipo_resolucao_label: string | null;
    tipo_match_codigo: string | null;
    tipo_match_label: string | null;
    medicamento_disparador_nome: string | null;
    grupo_disparador_codigo: string | null;
    protocolo_disparador_codigo: string | null;
    prioridade_regra: number | null;
    janela_antes_minutos: number | null;
    janela_depois_minutos: number | null;
  } | null;
}

export interface CalendarScheduleItemDto {
  prescriptionMedicationId: string;
  phaseId: string;
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
  doses: CalendarScheduleDoseDto[];
}

export interface CalendarScheduleResponseDto {
  prescriptionId: string;
  documentHeader: CalendarDocumentHeaderDto;
  patient: CalendarPatientDto;
  routine: CalendarRoutineDto;
  scheduleItems: CalendarScheduleItemDto[];
}

export interface PatientPrescription {
  id: string;
  startedAt: string;
  status: string;
  patient: Patient;
  medications: Array<{
    id: string;
    sourceClinicalMedicationId: string;
    sourceProtocolId: string;
    medicationSnapshot: {
      commercialName?: string;
      activePrinciple: string;
      presentation: string;
      administrationRoute: string;
      defaultAdministrationUnit?: DoseUnit;
    };
    phases: Array<{
      id: string;
      phaseOrder: number;
      frequency: number;
      manualAdjustmentEnabled: boolean;
      manualTimes?: string[];
    }>;
  }>;
}

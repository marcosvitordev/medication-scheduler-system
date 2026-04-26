import { ConflictReasonCode } from '../../../common/enums/conflict-reason-code.enum';
import { ScheduleStatus } from "../../../common/enums/schedule-status.enum";
import {
  ConflitoAgendamentoDto,
  ContextoHorarioAgendadoDto,
} from "./schedule-response.dto";

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
  reasonCode: ConflictReasonCode | null;
  reasonText: string | null;
  contextoHorario: ContextoHorarioAgendadoDto;
  conflito: ConflitoAgendamentoDto | null;
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

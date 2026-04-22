import { PrnReason } from '../../../common/enums/prn-reason.enum';
import { DoseUnit } from '../../../common/enums/dose-unit.enum';
import { OcularLaterality } from '../../../common/enums/ocular-laterality.enum';
import { OticLaterality } from '../../../common/enums/otic-laterality.enum';
import { TreatmentRecurrence } from '../../../common/enums/treatment-recurrence.enum';
import { ClinicalAnchor } from '../../../common/enums/clinical-anchor.enum';
import { ClinicalInteractionType } from '../../../common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../../../common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../../../common/enums/clinical-semantic-tag.enum';
import { MonthlySpecialReference } from '../../../common/enums/monthly-special-reference.enum';

export interface ResolvedScheduleTimeContextDto {
  anchor?: ClinicalAnchor;
  anchorTimeInMinutes?: number;
  offsetMinutes?: number;
  semanticTag?: ClinicalSemanticTag;
  originalTimeInMinutes: number;
  originalTimeFormatted: string;
  resolvedTimeInMinutes: number;
  resolvedTimeFormatted: string;
}

export interface ScheduleConflictDto {
  interactionType?: ClinicalInteractionType;
  resolutionType?: ClinicalResolutionType;
  triggerMedicationName?: string;
  triggerGroupCode?: string;
  triggerProtocolCode?: string;
  rulePriority?: number;
  windowBeforeMinutes?: number;
  windowAfterMinutes?: number;
}

export interface ContextoHorarioAgendadoDto {
  ancora: ClinicalAnchor | null;
  ancora_horario_minutos: number | null;
  deslocamento_minutos: number | null;
  tag_semantica: ClinicalSemanticTag | null;
  horario_original_minutos: number;
  horario_original: string;
  horario_resolvido_minutos: number;
  horario_resolvido: string;
}

export interface ConflitoAgendamentoDto {
  tipo_interacao_codigo: ClinicalInteractionType | null;
  tipo_interacao_label: string | null;
  tipo_resolucao_codigo: ClinicalResolutionType | null;
  tipo_resolucao_label: string | null;
  medicamento_disparador_nome: string | null;
  grupo_disparador_codigo: string | null;
  protocolo_disparador_codigo: string | null;
  prioridade_regra: number | null;
  janela_antes_minutos: number | null;
  janela_depois_minutos: number | null;
}

export interface FaixaEscalaGlicemicaDto {
  minimo: number;
  maximo: number;
  dose: string;
  unidade: DoseUnit;
  label_clinico: string;
}

export interface ScheduleEntryDto {
  dose_horario_label: string;
  dose_valor: string | null;
  dose_unidade: string | null;
  dose_exibicao: string;
  horario: string;
  recorrencia_codigo: TreatmentRecurrence | null;
  recorrencia_label: string;
  dia_semanal: string | null;
  regra_mensal: string | null;
  dia_mensal: number | null;
  regra_mensal_especial_codigo: MonthlySpecialReference | null;
  regra_mensal_especial_label: string | null;
  data_base_clinica: string | null;
  deslocamento_dias: number | null;
  data_referencia_regra: string | null;
  descricao_regra_mensal: string | null;
  intervalo_dias_alternados: number | null;
  uso_continuo: boolean;
  uso_se_necessario: boolean;
  motivo_se_necessario: PrnReason | null;
  lateralidade_ocular_codigo: OcularLaterality | null;
  lateralidade_ocular_label: string | null;
  lateralidade_otologica_codigo: OticLaterality | null;
  lateralidade_otologica_label: string | null;
  via_administracao_label: string;
  escala_glicemica: FaixaEscalaGlicemicaDto[] | null;
  escala_glicemica_label: string | null;
  status_codigo: string;
  status_label: string;
  orientacao_clinica: string | null;
  observacao: string | null;
  contexto_horario: ContextoHorarioAgendadoDto;
  conflito: ConflitoAgendamentoDto | null;
}

export interface ScheduledPhaseDto {
  fase_ordem: number;
  fase_label: string;
  data_inicio: string | null;
  data_fim: string | null;
  uso_continuo: boolean;
  regra_mensal_especial_codigo: MonthlySpecialReference | null;
  regra_mensal_especial_label: string | null;
  data_base_clinica: string | null;
  deslocamento_dias: number | null;
  data_referencia_regra: string | null;
  descricao_regra_mensal: string | null;
  lateralidade_ocular_codigo: OcularLaterality | null;
  lateralidade_ocular_label: string | null;
  lateralidade_otologica_codigo: OticLaterality | null;
  lateralidade_otologica_label: string | null;
  via_administracao_label: string;
  escala_glicemica: FaixaEscalaGlicemicaDto[] | null;
  escala_glicemica_label: string | null;
  entradas: ScheduleEntryDto[];
}

export interface ScheduledMedicationDto {
  nome_medicamento: string;
  principio_ativo: string;
  apresentacao: string;
  forma_farmaceutica: string | null;
  via_administracao: string;
  orientacoes_uso: string;
  grupo_codigo: string;
  grupo_label: string;
  protocolo_codigo: string;
  protocolo_nome: string | null;
  protocolo_descricao: string | null;
  fases: ScheduledPhaseDto[];
}

export interface SchedulingPatientHeaderDto {
  nome_completo: string;
  data_nascimento: string | null;
  idade: number | null;
  rg: string | null;
  cpf: string | null;
  telefone: string | null;
}

export interface SchedulingRoutineHeaderDto {
  acordar: string;
  cafe: string;
  almoco: string;
  lanche: string;
  jantar: string;
  dormir: string;
}

export interface SchedulingResultDto {
  paciente_id: string;
  prescricao_id: string;
  paciente: SchedulingPatientHeaderDto;
  rotina: SchedulingRoutineHeaderDto;
  data_inicio_prescricao: string | null;
  data_geracao_schedule: string;
  medicamentos: ScheduledMedicationDto[];
}

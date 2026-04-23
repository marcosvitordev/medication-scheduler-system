import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ClinicalAnchor } from '../../common/enums/clinical-anchor.enum';
import { ClinicalInteractionType } from '../../common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../../common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../../common/enums/clinical-semantic-tag.enum';
import { OcularLaterality } from '../../common/enums/ocular-laterality.enum';
import { OticLaterality } from '../../common/enums/otic-laterality.enum';
import { PrnReason } from '../../common/enums/prn-reason.enum';
import { ScheduleStatus } from '../../common/enums/schedule-status.enum';
import { TreatmentRecurrence } from '../../common/enums/treatment-recurrence.enum';
import { MonthlySpecialReference } from '../../common/enums/monthly-special-reference.enum';
import { calculateEndDate } from '../../common/utils/treatment-window.util';
import {
  formatMinuteIndex,
  minutesToHhmm,
  normalizeClockSequence,
  normalizeRoutineTimeline,
} from '../../common/utils/time.util';
import { PatientService } from '../patients/patient.service';
import { PatientRoutine } from '../patients/entities/patient-routine.entity';
import { PatientPrescriptionMedication } from '../patient-prescriptions/entities/patient-prescription-medication.entity';
import { PatientPrescriptionPhase } from '../patient-prescriptions/entities/patient-prescription-phase.entity';
import { PatientPrescription } from '../patient-prescriptions/entities/patient-prescription.entity';
import { ConflictResolutionService, ConflictEntryLike } from './services/conflict-resolution.service';
import {
  FaixaEscalaGlicemicaDto,
  ConflitoAgendamentoDto,
  ContextoHorarioAgendadoDto,
  ScheduleEntryDto,
  ScheduledPhaseDto,
  SchedulingResultDto,
} from './dto/schedule-response.dto';
import { ScheduledDose } from './entities/scheduled-dose.entity';
import { SchedulingRulesService } from './services/scheduling-rules.service';

type ScheduleAnchors = Record<ClinicalAnchor, number>;
interface PhaseWindow {
  startDate: string;
  endDate?: string;
}

interface ScheduleContext {
  routine: PatientRoutine;
  anchors: ScheduleAnchors;
}

interface MonthlySpecialRule {
  regra_mensal_especial_codigo: MonthlySpecialReference;
  regra_mensal_especial_label: string;
  data_base_clinica: string;
  deslocamento_dias: number;
  data_referencia_regra: string;
  descricao_regra_mensal: string;
}

interface WorkingEntry extends ConflictEntryLike {
  prescriptionMedication: PatientPrescriptionMedication;
  phase: PatientPrescriptionPhase;
  sourceClinicalMedicationId: string;
  sourceProtocolId: string;
  phaseOrder: number;
  protocolPriority: number;
  doseLabel: string;
  administrationValue?: string;
  administrationUnit?: string;
  administrationLabel: string;
  recurrenceType?: TreatmentRecurrence;
  recurrenceLabel?: string;
  startDate?: string;
  endDate?: string;
  weeklyDay?: string;
  monthlyRule?: string;
  monthlyDay?: number;
  monthlySpecialReference?: MonthlySpecialReference;
  monthlySpecialBaseDate?: string;
  monthlySpecialOffsetDays?: number;
  monthlySpecialReferenceDate?: string;
  monthlySpecialRuleDescription?: string;
  alternateDaysInterval?: number;
  continuousUse: boolean;
  isPrn: boolean;
  prnReason?: PrnReason;
  clinicalInstructionLabel?: string;
  timeFormatted: string;
}

@Injectable()
export class SchedulingService {
  constructor(
    @InjectRepository(ScheduledDose)
    private readonly scheduledDoseRepository: Repository<ScheduledDose>,
    @InjectRepository(PatientPrescription)
    private readonly prescriptionRepository: Repository<PatientPrescription>,
    private readonly patientService: PatientService,
    private readonly rulesService: SchedulingRulesService,
    private readonly conflictResolutionService: ConflictResolutionService,
  ) {}

  async buildAndPersistSchedule(
    prescription: PatientPrescription,
    entityManager?: EntityManager,
  ): Promise<SchedulingResultDto> {
    const generationDate = new Date();
    const scheduleContext = await this.resolveScheduleContextForBuild(prescription);
    let entries = this.buildBaseEntries(prescription, scheduleContext.anchors);
    entries = this.applyConflictRules(entries);
    entries = entries.map((entry) => ({
      ...entry,
      timeFormatted: minutesToHhmm(entry.timeInMinutes),
      timeContext: {
        ...entry.timeContext,
        resolvedTimeInMinutes: entry.timeInMinutes,
        resolvedTimeFormatted: minutesToHhmm(entry.timeInMinutes),
      },
    }));
    entries = this.sortEntries(entries);

    const persisted = await this.persistSchedule(prescription, entries, entityManager);
    return this.mapSchedulingResult(
      prescription,
      persisted,
      scheduleContext.routine,
      generationDate,
    );
  }

  async getScheduleByPrescription(prescriptionId: string): Promise<SchedulingResultDto> {
    const generationDate = new Date();
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId },
      relations: ['patient', 'patient.routines', 'medications', 'medications.phases'],
    });
    if (!prescription) {
      throw new NotFoundException('Prescrição do paciente não encontrada.');
    }
    const routine = this.resolveActiveRoutineFromPatient(prescription);

    const scheduledDoses = await this.scheduledDoseRepository.find({
      where: { prescription: { id: prescriptionId } },
      relations: ['prescriptionMedication', 'phase'],
      order: { phaseOrder: 'ASC', timeInMinutes: 'ASC' },
    });

    return this.mapSchedulingResult(prescription, scheduledDoses, routine, generationDate);
  }

  private async resolveScheduleContextForBuild(
    prescription: PatientPrescription,
  ): Promise<ScheduleContext> {
    const routine = await this.patientService.getActiveRoutine(prescription.patient.id);
    return {
      routine,
      anchors: this.toScheduleAnchors(routine),
    };
  }

  private toScheduleAnchors(
    routine: Pick<PatientRoutine, 'acordar' | 'cafe' | 'almoco' | 'lanche' | 'jantar' | 'dormir'>,
  ): ScheduleAnchors {
    const timeline = normalizeRoutineTimeline({
      acordar: routine.acordar,
      cafe: routine.cafe,
      almoco: routine.almoco,
      lanche: routine.lanche,
      jantar: routine.jantar,
      dormir: routine.dormir,
    });

    return {
      [ClinicalAnchor.ACORDAR]: timeline[ClinicalAnchor.ACORDAR],
      [ClinicalAnchor.CAFE]: timeline[ClinicalAnchor.CAFE],
      [ClinicalAnchor.ALMOCO]: timeline[ClinicalAnchor.ALMOCO],
      [ClinicalAnchor.LANCHE]: timeline[ClinicalAnchor.LANCHE],
      [ClinicalAnchor.JANTAR]: timeline[ClinicalAnchor.JANTAR],
      [ClinicalAnchor.DORMIR]: timeline[ClinicalAnchor.DORMIR],
      [ClinicalAnchor.MANUAL]: 0,
    };
  }

  private resolveActiveRoutineFromPatient(prescription: PatientPrescription): PatientRoutine {
    const activeRoutines = (prescription.patient.routines ?? [])
      .filter((routine) => routine.active)
      .sort((left, right) => {
        const leftDate = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightDate = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightDate - leftDate || right.id.localeCompare(left.id);
      });

    if (activeRoutines.length === 0) {
      throw new NotFoundException('Rotina ativa do paciente não encontrada.');
    }
    if (activeRoutines.length > 1) {
      throw new ConflictException(
        'Paciente com múltiplas rotinas ativas. Corrija a consistência da base.',
      );
    }

    return activeRoutines[0];
  }

  private buildBaseEntries(
    prescription: PatientPrescription,
    anchors: ScheduleAnchors,
  ): WorkingEntry[] {
    const phases = [...prescription.medications]
      .sort((a, b) => a.medicationSnapshot.activePrinciple.localeCompare(b.medicationSnapshot.activePrinciple))
      .flatMap((medication) =>
        [...medication.phases]
          .sort((a, b) => a.phaseOrder - b.phaseOrder)
          .flatMap((phase) =>
            this.buildEntriesForPhase(
              prescription,
              medication,
              phase,
              anchors,
              this.computePhaseWindow(prescription.startedAt, medication, phase),
            ),
          ),
      );

    return phases;
  }

  private computePhaseWindow(
    prescriptionStartDate: string,
    medication: PatientPrescriptionMedication,
    phase: PatientPrescriptionPhase,
  ): PhaseWindow {
    const sorted = [...medication.phases].sort((a, b) => a.phaseOrder - b.phaseOrder);
    let currentStart = prescriptionStartDate;
    for (const currentPhase of sorted) {
      const currentEnd = currentPhase.continuousUse
        ? undefined
        : calculateEndDate(currentStart, currentPhase.treatmentDays ?? 1);
      if (currentPhase.phaseOrder === phase.phaseOrder) {
        return { startDate: currentStart, endDate: currentEnd };
      }
      if (!currentEnd) {
        return { startDate: currentStart, endDate: undefined };
      }
      currentStart = shiftDateByDays(currentEnd, 1);
    }
    return { startDate: prescriptionStartDate };
  }

  private buildEntriesForPhase(
    prescription: PatientPrescription,
    medication: PatientPrescriptionMedication,
    phase: PatientPrescriptionPhase,
    anchors: ScheduleAnchors,
    phaseWindow: PhaseWindow,
  ): WorkingEntry[] {
    if (phase.manualAdjustmentEnabled && phase.manualTimes?.length) {
      const normalizedManualTimes = normalizeClockSequence(phase.manualTimes);
      return normalizedManualTimes.map((timeInMinutes, index) =>
        this.createEntry(
          prescription,
          medication,
          phase,
          `D${index + 1}`,
          timeInMinutes,
          ClinicalSemanticTag.STANDARD,
          ClinicalAnchor.MANUAL,
          timeInMinutes,
          0,
          phaseWindow,
          'Horário definido manualmente.',
        ),
      );
    }

    const frequencyConfig = this.rulesService.getFrequencyConfig(
      medication.protocolSnapshot,
      phase.frequency,
    );

    return frequencyConfig.steps.map((step) =>
      this.createEntry(
        prescription,
        medication,
        phase,
        step.doseLabel,
        anchors[step.anchor] + step.offsetMinutes,
        step.semanticTag,
        step.anchor,
        anchors[step.anchor],
        step.offsetMinutes,
        phaseWindow,
      ),
    );
  }

  private createEntry(
    prescription: PatientPrescription,
    medication: PatientPrescriptionMedication,
    phase: PatientPrescriptionPhase,
    doseLabel: string,
    timeInMinutes: number,
    semanticTag: ClinicalSemanticTag,
    anchor: ClinicalAnchor,
    anchorTimeInMinutes: number,
    offsetMinutes: number,
    phaseWindow: PhaseWindow,
    note?: string,
  ): WorkingEntry {
    const administration = this.resolveAdministration(phase, doseLabel);
    const monthlySpecialRule = toMonthlySpecialRule(phase);

    return {
      prescriptionMedication: medication,
      phase,
      sourceClinicalMedicationId: medication.sourceClinicalMedicationId,
      sourceProtocolId: medication.sourceProtocolId,
      phaseOrder: phase.phaseOrder,
      protocolPriority: medication.protocolSnapshot.priority,
      medicationName:
        medication.medicationSnapshot.commercialName ??
        medication.medicationSnapshot.activePrinciple,
      groupCode: medication.protocolSnapshot.groupCode,
      protocolCode: medication.protocolSnapshot.code,
      semanticTag,
      interactionRulesSnapshot: medication.interactionRulesSnapshot,
      phaseDoseLabel: doseLabel,
      doseLabel,
      administrationValue: administration.administrationValue,
      administrationUnit: administration.administrationUnit,
      administrationLabel: administration.administrationLabel,
      recurrenceType: phase.recurrenceType,
      recurrenceLabel: formatRecurrenceLabel(phase.recurrenceType, phaseWindow.startDate, phaseWindow.endDate, phase),
      startDate: phaseWindow.startDate,
      endDate: phaseWindow.endDate,
      weeklyDay: phase.weeklyDay,
      monthlyRule: monthlySpecialRule?.descricao_regra_mensal ?? phase.monthlyRule,
      monthlyDay: monthlySpecialRule ? undefined : phase.monthlyDay,
      monthlySpecialReference: monthlySpecialRule?.regra_mensal_especial_codigo,
      monthlySpecialBaseDate: monthlySpecialRule?.data_base_clinica,
      monthlySpecialOffsetDays: monthlySpecialRule?.deslocamento_dias,
      monthlySpecialReferenceDate: monthlySpecialRule?.data_referencia_regra,
      monthlySpecialRuleDescription: monthlySpecialRule?.descricao_regra_mensal,
      alternateDaysInterval: phase.alternateDaysInterval,
      continuousUse: phase.continuousUse,
      isPrn: phase.recurrenceType === TreatmentRecurrence.PRN,
      prnReason: phase.prnReason,
      clinicalInstructionLabel:
        phase.recurrenceType === TreatmentRecurrence.PRN
          ? phase.prnReason
            ? `Uso se necessario em caso de ${toPrnReasonLabel(phase.prnReason)}.`
            : 'Uso se necessario.'
          : undefined,
      timeInMinutes,
      timeFormatted: formatMinuteIndex(timeInMinutes),
      timeContext: {
        anchor,
        anchorTimeInMinutes,
        offsetMinutes,
        semanticTag,
        originalTimeInMinutes: timeInMinutes,
        originalTimeFormatted: formatMinuteIndex(timeInMinutes),
        resolvedTimeInMinutes: timeInMinutes,
        resolvedTimeFormatted: formatMinuteIndex(timeInMinutes),
      },
      status: ScheduleStatus.ACTIVE,
      note,
    };
  }

  private resolveAdministration(
    phase: PatientPrescriptionPhase,
    doseLabel: string,
  ): {
    administrationValue?: string;
    administrationUnit?: string;
    administrationLabel: string;
  } {
    const override = phase.sameDosePerSchedule
      ? undefined
      : phase.perDoseOverrides?.find((item) => item.doseLabel === doseLabel);
    const administrationValue = override?.doseValue ?? phase.doseValue;
    const administrationUnit = override?.doseUnit ?? phase.doseUnit;
    if (administrationValue && administrationUnit) {
      return {
        administrationValue,
        administrationUnit,
        administrationLabel: `${administrationValue} ${administrationUnit}`,
      };
    }
    return {
      administrationValue,
      administrationUnit,
      administrationLabel: administrationValue ?? phase.doseAmount ?? doseLabel,
    };
  }

  private applyConflictRules(entries: WorkingEntry[]): WorkingEntry[] {
    const normalized = entries.map((entry) => ({ ...entry }));
    this.conflictResolutionService.apply(normalized);
    return normalized;
  }

  private sortEntries(entries: WorkingEntry[]): WorkingEntry[] {
    return [...entries].sort(
      (a, b) =>
        a.phaseOrder - b.phaseOrder ||
        a.timeInMinutes - b.timeInMinutes ||
        a.medicationName.localeCompare(b.medicationName),
    );
  }

  private async persistSchedule(
    prescription: PatientPrescription,
    entries: WorkingEntry[],
    entityManager?: EntityManager,
  ): Promise<ScheduledDose[]> {
    const scheduledDoseRepository =
      entityManager?.getRepository(ScheduledDose) ?? this.scheduledDoseRepository;

    await scheduledDoseRepository.delete({
      prescription: { id: prescription.id },
    });

    return scheduledDoseRepository.save(
      entries.map((entry) =>
        scheduledDoseRepository.create({
          prescription,
          prescriptionMedication: entry.prescriptionMedication,
          phase: entry.phase,
          phaseOrder: entry.phaseOrder,
          doseLabel: entry.doseLabel,
          administrationValue: entry.administrationValue,
          administrationUnit: entry.administrationUnit,
          administrationLabel: entry.administrationLabel,
          recurrenceType: entry.recurrenceType,
          startDate: entry.startDate,
          endDate: entry.endDate,
          weeklyDay: entry.weeklyDay,
          monthlyRule: entry.monthlyRule,
          monthlyDay: entry.monthlyDay,
          alternateDaysInterval: entry.alternateDaysInterval,
          continuousUse: entry.continuousUse,
          isPrn: entry.isPrn,
          prnReason: entry.prnReason,
          clinicalInstructionLabel: entry.clinicalInstructionLabel,
          timeInMinutes: entry.timeInMinutes,
          timeFormatted: entry.timeFormatted,
          anchor: entry.timeContext.anchor,
          anchorTimeInMinutes: entry.timeContext.anchorTimeInMinutes,
          offsetMinutes: entry.timeContext.offsetMinutes,
          semanticTag: entry.timeContext.semanticTag,
          originalTimeInMinutes: entry.timeContext.originalTimeInMinutes,
          originalTimeFormatted: entry.timeContext.originalTimeFormatted,
          status: entry.status,
          note: entry.note,
          conflictInteractionType: entry.conflict?.interactionType,
          conflictResolutionType: entry.conflict?.resolutionType,
          conflictTriggerMedicationName: entry.conflict?.triggerMedicationName,
          conflictTriggerGroupCode: entry.conflict?.triggerGroupCode,
          conflictTriggerProtocolCode: entry.conflict?.triggerProtocolCode,
          conflictRulePriority: entry.conflict?.rulePriority,
          conflictWindowBeforeMinutes: entry.conflict?.windowBeforeMinutes,
          conflictWindowAfterMinutes: entry.conflict?.windowAfterMinutes,
        }),
      ),
    );
  }

  private mapSchedulingResult(
    prescription: PatientPrescription,
    doses: ScheduledDose[],
    routine: PatientRoutine,
    generationDate: Date,
  ): SchedulingResultDto {
    const medications = [...prescription.medications].sort((a, b) => {
      const leftName = a.medicationSnapshot.commercialName ?? a.medicationSnapshot.activePrinciple;
      const rightName = b.medicationSnapshot.commercialName ?? b.medicationSnapshot.activePrinciple;
      return leftName.localeCompare(rightName) || a.id.localeCompare(b.id);
    });

    return {
      paciente_id: prescription.patient.id,
      prescricao_id: prescription.id,
      paciente: this.mapPatientHeader(prescription, generationDate),
      rotina: this.mapRoutineHeader(routine),
      data_inicio_prescricao: toPtBrDate(prescription.startedAt),
      data_geracao_schedule: toPtBrDateFromDate(generationDate),
      medicamentos: medications.map((medication) => ({
        prescription_medication_id: medication.id,
        nome_medicamento:
          medication.medicationSnapshot.commercialName ??
          medication.medicationSnapshot.activePrinciple,
        principio_ativo: medication.medicationSnapshot.activePrinciple,
        apresentacao: medication.medicationSnapshot.presentation,
        forma_farmaceutica: medication.medicationSnapshot.pharmaceuticalForm ?? null,
        via_administracao: medication.medicationSnapshot.administrationRoute,
        orientacoes_uso: medication.medicationSnapshot.usageInstructions,
        grupo_codigo: medication.protocolSnapshot.groupCode,
        grupo_label: toGroupLabel(medication.protocolSnapshot.groupCode),
        protocolo_codigo: medication.protocolSnapshot.code,
        protocolo_nome: medication.protocolSnapshot.name ?? null,
        protocolo_descricao: medication.protocolSnapshot.description ?? null,
        fases: this.mapPhases(medication, doses),
      })),
    };
  }

  private mapPatientHeader(
    prescription: PatientPrescription,
    generationDate: Date,
  ): SchedulingResultDto['paciente'] {
    return {
      nome_completo: prescription.patient.fullName,
      data_nascimento: toPtBrDate(prescription.patient.birthDate),
      idade: calculateAge(prescription.patient.birthDate, generationDate),
      rg: prescription.patient.rg ?? null,
      cpf: prescription.patient.cpf ?? null,
      telefone: prescription.patient.phone ?? null,
    };
  }

  private mapRoutineHeader(routine: PatientRoutine): SchedulingResultDto['rotina'] {
    return {
      acordar: routine.acordar,
      cafe: routine.cafe,
      almoco: routine.almoco,
      lanche: routine.lanche,
      jantar: routine.jantar,
      dormir: routine.dormir,
    };
  }

  private mapPhases(
    medication: PatientPrescriptionMedication,
    doses: ScheduledDose[],
  ): ScheduledPhaseDto[] {
    return [...medication.phases]
      .sort((a, b) => a.phaseOrder - b.phaseOrder)
      .map((phase) => {
        const phaseDoses = doses
          .filter(
            (dose) =>
              dose.prescriptionMedication.id === medication.id &&
              dose.phase.id === phase.id,
          )
          .sort((a, b) => a.timeInMinutes - b.timeInMinutes);
        const escala_glicemica = toGlycemiaScaleRanges(phase.glycemiaScaleRanges);
        const escala_glicemica_label = toGlycemiaScaleLabel(escala_glicemica);
        const monthlySpecialRule = toMonthlySpecialRule(phase);

        const phaseEntries = phaseDoses.map((dose): ScheduleEntryDto => {
            const recorrencia_label = formatRecurrenceLabel(
              phase.recurrenceType,
              dose.startDate,
              dose.endDate,
              phase,
            );
            const lateralidade_ocular_codigo = phase.ocularLaterality ?? null;
            const lateralidade_otologica_codigo = phase.oticLaterality ?? null;
            const lateralidade_ocular_label = toOcularLateralityLabel(lateralidade_ocular_codigo);
            const lateralidade_otologica_label =
              toOticLateralityLabel(lateralidade_otologica_codigo);
            const via_administracao_label = toViaAdministracaoLabel(
              medication.medicationSnapshot.administrationRoute,
              lateralidade_ocular_label,
              lateralidade_otologica_label,
            );
            const conflito = this.mapConflito(dose);
            const contexto_horario: ContextoHorarioAgendadoDto = {
              ancora: dose.anchor ?? null,
              ancora_horario_minutos: dose.anchorTimeInMinutes ?? null,
              deslocamento_minutos: dose.offsetMinutes ?? null,
              tag_semantica: dose.semanticTag ?? null,
              horario_original_minutos: dose.originalTimeInMinutes,
              horario_original: dose.originalTimeFormatted,
              horario_resolvido_minutos: dose.timeInMinutes,
              horario_resolvido: dose.timeFormatted,
            };
            return {
              prescription_medication_id: dose.prescriptionMedication.id,
              phase_id: dose.phase.id,
              dose_horario_label: dose.doseLabel,
              dose_valor: dose.administrationValue ?? null,
              dose_unidade: dose.administrationUnit ?? null,
              dose_exibicao: dose.administrationLabel ?? dose.doseLabel,
              horario: dose.timeFormatted,
              recorrencia_codigo: dose.recurrenceType ?? null,
              recorrencia_label,
              dia_semanal: dose.weeklyDay ?? null,
              regra_mensal: monthlySpecialRule?.descricao_regra_mensal ?? dose.monthlyRule ?? null,
              dia_mensal: monthlySpecialRule ? null : dose.monthlyDay ?? null,
              regra_mensal_especial_codigo:
                monthlySpecialRule?.regra_mensal_especial_codigo ?? null,
              regra_mensal_especial_label:
                monthlySpecialRule?.regra_mensal_especial_label ?? null,
              data_base_clinica: monthlySpecialRule?.data_base_clinica ?? null,
              deslocamento_dias: monthlySpecialRule?.deslocamento_dias ?? null,
              data_referencia_regra: monthlySpecialRule?.data_referencia_regra ?? null,
              descricao_regra_mensal: monthlySpecialRule?.descricao_regra_mensal ?? null,
              intervalo_dias_alternados: dose.alternateDaysInterval ?? null,
              uso_continuo: dose.continuousUse,
              uso_se_necessario: dose.isPrn,
              motivo_se_necessario: dose.prnReason ?? null,
              lateralidade_ocular_codigo,
              lateralidade_ocular_label,
              lateralidade_otologica_codigo,
              lateralidade_otologica_label,
              via_administracao_label,
              escala_glicemica,
              escala_glicemica_label,
              status_codigo: dose.status,
              status_label: toStatusLabel(dose.status),
              orientacao_clinica: dose.clinicalInstructionLabel ?? null,
              observacao: dose.note ?? null,
              contexto_horario,
              conflito,
            };
          });

        const primeiraDose = phaseDoses[0];
        const lateralidade_ocular_codigo = phase.ocularLaterality ?? null;
        const lateralidade_otologica_codigo = phase.oticLaterality ?? null;
        const lateralidade_ocular_label = toOcularLateralityLabel(lateralidade_ocular_codigo);
        const lateralidade_otologica_label =
          toOticLateralityLabel(lateralidade_otologica_codigo);
        const via_administracao_label = toViaAdministracaoLabel(
          medication.medicationSnapshot.administrationRoute,
          lateralidade_ocular_label,
          lateralidade_otologica_label,
        );

        return {
          phase_id: phase.id,
          fase_ordem: phase.phaseOrder,
          fase_label: `Posologia ${phase.phaseOrder}`,
          data_inicio: toPtBrDate(primeiraDose?.startDate),
          data_fim: toPtBrDate(primeiraDose?.endDate),
          uso_continuo: phase.continuousUse,
          regra_mensal_especial_codigo: monthlySpecialRule?.regra_mensal_especial_codigo ?? null,
          regra_mensal_especial_label: monthlySpecialRule?.regra_mensal_especial_label ?? null,
          data_base_clinica: monthlySpecialRule?.data_base_clinica ?? null,
          deslocamento_dias: monthlySpecialRule?.deslocamento_dias ?? null,
          data_referencia_regra: monthlySpecialRule?.data_referencia_regra ?? null,
          descricao_regra_mensal: monthlySpecialRule?.descricao_regra_mensal ?? null,
          lateralidade_ocular_codigo,
          lateralidade_ocular_label,
          lateralidade_otologica_codigo,
          lateralidade_otologica_label,
          via_administracao_label,
          escala_glicemica,
          escala_glicemica_label,
          entradas: phaseEntries,
        };
      });
  }

  private mapConflito(dose: ScheduledDose): ConflitoAgendamentoDto | null {
    if (!dose.conflictInteractionType && !dose.conflictResolutionType) {
      return null;
    }
    return {
      tipo_interacao_codigo: dose.conflictInteractionType ?? null,
      tipo_interacao_label: toInteractionLabel(dose.conflictInteractionType),
      tipo_resolucao_codigo: dose.conflictResolutionType ?? null,
      tipo_resolucao_label: toResolutionLabel(dose.conflictResolutionType),
      medicamento_disparador_nome: dose.conflictTriggerMedicationName ?? null,
      grupo_disparador_codigo: dose.conflictTriggerGroupCode ?? null,
      protocolo_disparador_codigo: dose.conflictTriggerProtocolCode ?? null,
      prioridade_regra: dose.conflictRulePriority ?? null,
      janela_antes_minutos: dose.conflictWindowBeforeMinutes ?? null,
      janela_depois_minutos: dose.conflictWindowAfterMinutes ?? null,
    };
  }
}

function formatRecurrenceLabel(
  recurrenceType: TreatmentRecurrence,
  startDate: string | undefined,
  endDate: string | undefined,
  phase: PatientPrescriptionPhase,
): string {
  if (recurrenceType === TreatmentRecurrence.MONTHLY) {
    const monthlySpecialRule = toMonthlySpecialRule(phase);
    if (monthlySpecialRule) return monthlySpecialRule.descricao_regra_mensal;
  }

  if (phase.continuousUse) {
    return 'Uso contínuo';
  }

  switch (recurrenceType) {
    case TreatmentRecurrence.WEEKLY:
      return phase.weeklyDay ? `Semanal em ${phase.weeklyDay}` : 'Semanal';
    case TreatmentRecurrence.MONTHLY:
      if (phase.monthlyDay) return `Mensal no dia ${phase.monthlyDay}`;
      return phase.monthlyRule ? `Mensal: ${phase.monthlyRule}` : 'Mensal';
    case TreatmentRecurrence.ALTERNATE_DAYS:
      return `A cada ${phase.alternateDaysInterval ?? 2} dias`;
    case TreatmentRecurrence.PRN:
      return phase.prnReason
        ? `Se necessário: ${toPrnReasonLabel(phase.prnReason)}`
        : 'Se necessário';
    case TreatmentRecurrence.DAILY:
    default:
      if (!startDate) return 'Diário';
      return endDate ? 'Diário' : phase.continuousUse ? 'Uso contínuo' : 'Diário';
  }
}

function toPtBrDate(dateString: string | undefined): string | null {
  if (!dateString) return null;
  const [year, month, day] = dateString.split('-');
  if (!year || !month || !day) return null;
  return `${day}/${month}/${year}`;
}

function toPtBrDateFromDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function calculateAge(birthDate: string | undefined, referenceDate: Date): number | null {
  if (!birthDate) return null;
  const [yearRaw, monthRaw, dayRaw] = birthDate.split('-');
  const birthYear = Number(yearRaw);
  const birthMonth = Number(monthRaw);
  const birthDay = Number(dayRaw);

  if (!birthYear || !birthMonth || !birthDay) return null;

  const referenceYear = referenceDate.getFullYear();
  const referenceMonth = referenceDate.getMonth() + 1;
  const referenceDay = referenceDate.getDate();

  let age = referenceYear - birthYear;
  const hadBirthdayThisYear =
    referenceMonth > birthMonth || (referenceMonth === birthMonth && referenceDay >= birthDay);
  if (!hadBirthdayThisYear) age -= 1;

  return age >= 0 ? age : null;
}

function toStatusLabel(status: string): string {
  switch (status) {
    case ScheduleStatus.INACTIVE:
      return 'Inativo';
    case ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED:
      return 'Ajuste manual necessário';
    case ScheduleStatus.ACTIVE:
    default:
      return 'Ativo';
  }
}

function toInteractionLabel(interactionType?: ClinicalInteractionType): string | null {
  switch (interactionType) {
    case ClinicalInteractionType.AFFECTED_BY_SALTS:
      return 'Interferência com sais/antiácidos';
    case ClinicalInteractionType.AFFECTED_BY_SUCRALFATE:
      return 'Interferência com sucralfato';
    case ClinicalInteractionType.AFFECTED_BY_CALCIUM:
      return 'Interferência com cálcio';
    default:
      return null;
  }
}

function toResolutionLabel(resolutionType?: ClinicalResolutionType): string | null {
  switch (resolutionType) {
    case ClinicalResolutionType.INACTIVATE_SOURCE:
      return 'Inativar dose';
    case ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW:
      return 'Deslocar dose por janela';
    case ClinicalResolutionType.REQUIRE_MANUAL_ADJUSTMENT:
      return 'Exigir ajuste manual';
    default:
      return null;
  }
}

function toGroupLabel(groupCode: string): string {
  if (!groupCode) return 'Grupo';
  const normalized = groupCode.startsWith('GROUP_')
    ? groupCode.replace('GROUP_', '')
    : groupCode;
  return `Grupo ${normalized.split('_').join(' ')}`;
}

function toPrnReasonLabel(prnReason?: PrnReason): string {
  switch (prnReason) {
    case PrnReason.CRISIS:
      return 'crise';
    case PrnReason.PAIN:
      return 'dor';
    case PrnReason.FEVER:
      return 'febre';
    case PrnReason.NAUSEA_VOMITING:
      return 'náusea e vômito';
    case PrnReason.SHORTNESS_OF_BREATH:
      return 'falta de ar';
    default:
      return 'necessidade clínica';
  }
}

function toOcularLateralityLabel(laterality: OcularLaterality | null): string | null {
  switch (laterality) {
    case OcularLaterality.RIGHT_EYE:
      return 'olho direito';
    case OcularLaterality.LEFT_EYE:
      return 'olho esquerdo';
    case OcularLaterality.BOTH_EYES:
      return 'ambos os olhos';
    default:
      return null;
  }
}

function toOticLateralityLabel(laterality: OticLaterality | null): string | null {
  switch (laterality) {
    case OticLaterality.RIGHT_EAR:
      return 'orelha direita';
    case OticLaterality.LEFT_EAR:
      return 'orelha esquerda';
    case OticLaterality.BOTH_EARS:
      return 'nas 2 orelhas';
    default:
      return null;
  }
}

function toViaAdministracaoLabel(
  viaAdministracao: string,
  ocularLabel: string | null,
  oticLabel: string | null,
): string {
  if (ocularLabel) return `Via ocular - ${ocularLabel}`;
  if (oticLabel) return `Via otológica - ${oticLabel}`;
  return viaAdministracao;
}

function toMonthlySpecialRule(phase: PatientPrescriptionPhase): MonthlySpecialRule | null {
  if (
    !phase.monthlySpecialReference ||
    !phase.monthlySpecialBaseDate ||
    phase.monthlySpecialOffsetDays === undefined
  ) {
    return null;
  }
  const dataBaseClinica = toPtBrDate(phase.monthlySpecialBaseDate);
  const monthlyReferenceDate = shiftDateByDays(
    phase.monthlySpecialBaseDate,
    phase.monthlySpecialOffsetDays,
  );
  const dataReferenciaRegra = toPtBrDate(monthlyReferenceDate);

  if (!dataBaseClinica || !dataReferenciaRegra) {
    return null;
  }

  return {
    regra_mensal_especial_codigo: phase.monthlySpecialReference,
    regra_mensal_especial_label: toMonthlySpecialReferenceLabel(phase.monthlySpecialReference),
    data_base_clinica: dataBaseClinica,
    deslocamento_dias: phase.monthlySpecialOffsetDays,
    data_referencia_regra: dataReferenciaRegra,
    descricao_regra_mensal: toMonthlySpecialDescription(phase.monthlySpecialOffsetDays),
  };
}

function toMonthlySpecialReferenceLabel(reference: MonthlySpecialReference): string {
  switch (reference) {
    case MonthlySpecialReference.MENSTRUATION_START:
    default:
      return 'Início da menstruação';
  }
}

function toMonthlySpecialDescription(offsetDays: number): string {
  return `Primeira aplicação: ${offsetDays}º dia após início da menstruação. Demais aplicações: mensal no mesmo dia do mês.`;
}

function toGlycemiaScaleRanges(
  ranges: PatientPrescriptionPhase['glycemiaScaleRanges'],
): FaixaEscalaGlicemicaDto[] | null {
  if (!ranges?.length) return null;
  return [...ranges]
    .sort((a, b) => a.minimum - b.minimum)
    .map((range) => ({
      minimo: range.minimum,
      maximo: range.maximum,
      dose: range.doseValue,
      unidade: range.doseUnit,
      label_clinico: `Se glicemia entre ${range.minimum} e ${range.maximum}: aplicar ${range.doseValue} ${range.doseUnit}.`,
    }));
}

function toGlycemiaScaleLabel(ranges: FaixaEscalaGlicemicaDto[] | null): string | null {
  if (!ranges?.length) return null;
  return ranges.map((range) => range.label_clinico).join(' ');
}

function shiftDateByDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const resultYear = String(date.getFullYear());
  const resultMonth = String(date.getMonth() + 1).padStart(2, '0');
  const resultDay = String(date.getDate()).padStart(2, '0');
  return `${resultYear}-${resultMonth}-${resultDay}`;
}

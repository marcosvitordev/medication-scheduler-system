import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, Repository } from "typeorm";
import { GroupCode } from "../../common/enums/group-code.enum";
import { MealAnchor } from "../../common/enums/meal-anchor.enum";
import { ScheduleStatus } from "../../common/enums/schedule-status.enum";
import { TreatmentRecurrence } from "../../common/enums/treatment-recurrence.enum";
import {
  buildRecurrenceMetadata,
  buildClinicalInstructionLabel,
  formatClinicalRecurrenceLabel,
} from "../../common/utils/recurrence.util";
import { minutesToHhmm, hhmmToMinutes } from "../../common/utils/time.util";
import { PatientService } from "../patients/patient.service";
import { Prescription } from "../prescriptions/entities/prescription.entity";
import { PrescriptionItemDoseOverride } from "../prescriptions/entities/prescription-item.entity";
import { PrescriptionItem } from "../prescriptions/entities/prescription-item.entity";
import { ScheduledDose } from "./entities/scheduled-dose.entity";
import {
  SchedulingResultDto,
  ScheduleEntryDto,
} from "./dto/schedule-response.dto";
import { SchedulingRulesService } from "./services/scheduling-rules.service";

interface WorkingEntry extends ScheduleEntryDto {
  prescriptionItem: PrescriptionItem;
  interferesWithSalts: boolean;
}

interface ResolvedAdministration {
  administrationValue?: string;
  administrationUnit?: string;
  administrationLabel: string;
}

type ScheduleAnchors = Record<MealAnchor, number>;

@Injectable()
export class SchedulingService {
  constructor(
    @InjectRepository(ScheduledDose)
    private readonly scheduledDoseRepository: Repository<ScheduledDose>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
    private readonly patientService: PatientService,
    private readonly rulesService: SchedulingRulesService,
  ) {}

  async buildAndPersistSchedule(
    prescription: Prescription,
    entityManager?: EntityManager,
  ): Promise<SchedulingResultDto> {
    const anchors = await this.resolveScheduleAnchors(prescription);

    let entries = this.buildBaseEntries(prescription, anchors);
    entries = entries.map((entry) => this.resolveDoseForEntry(entry));
    entries = entries.map((entry) =>
      this.attachClinicalMetadata(entry, prescription),
    );
    entries = entries.map((entry) => this.attachPrnMetadata(entry));
    entries = this.applySpecialRules(entries, anchors);
    entries = this.sortEntries(entries);

    const persisted = await this.persistSchedule(
      prescription,
      entries,
      entityManager,
    );
    return this.mapSchedulingResult(prescription, persisted);
  }

  private async resolveScheduleAnchors(
    prescription: Prescription,
  ): Promise<ScheduleAnchors> {
    const routine = await this.patientService.getActiveRoutine(
      prescription.patient.id,
    );

    return {
      [MealAnchor.ACORDAR]: hhmmToMinutes(routine.acordar),
      [MealAnchor.CAFE]: hhmmToMinutes(routine.cafe),
      [MealAnchor.ALMOCO]: hhmmToMinutes(routine.almoco),
      [MealAnchor.LANCHE]: hhmmToMinutes(routine.lanche),
      [MealAnchor.JANTAR]: hhmmToMinutes(routine.jantar),
      [MealAnchor.DORMIR]: hhmmToMinutes(routine.dormir),
    };
  }

  private buildBaseEntries(
    prescription: Prescription,
    anchors: ScheduleAnchors,
  ): WorkingEntry[] {
    return prescription.items.flatMap((item) =>
      this.buildBaseEntriesForItem(item, anchors),
    );
  }

  private buildBaseEntriesForItem(
    item: PrescriptionItem,
    anchors: ScheduleAnchors,
  ): WorkingEntry[] {
    if (item.manualAdjustmentEnabled && item.manualTimes?.length) {
      return this.buildBaseEntriesFromManualTimes(item);
    }

    return this.buildBaseEntriesFromFormula(item, anchors);
  }

  private buildBaseEntriesFromManualTimes(
    item: PrescriptionItem,
  ): WorkingEntry[] {
    return item.manualTimes!.map((time, index) =>
      this.createBaseEntry(
        item,
        `D${index + 1}`,
        hhmmToMinutes(time),
        "Horário definido manualmente.",
      ),
    );
  }

  private buildBaseEntriesFromFormula(
    item: PrescriptionItem,
    anchors: ScheduleAnchors,
  ): WorkingEntry[] {
    const formula = this.rulesService.getFormula(
      item.medication.group.code,
      item.frequency,
    );

    return formula.map((step) =>
      this.createBaseEntry(
        item,
        step.doseLabel,
        anchors[step.base] + step.offsetMinutes,
      ),
    );
  }

  private applySpecialRules(
    entries: WorkingEntry[],
    anchors: ScheduleAnchors,
  ): WorkingEntry[] {
    const normalized = entries.map((entry) => ({ ...entry }));

    this.applyCalciumRule(normalized);
    this.applySaltRule(normalized);
    this.applySucralfateRule(normalized, anchors);
    this.detectResidualConflicts(normalized);

    return normalized.map((entry) => ({
      ...entry,
      timeFormatted: minutesToHhmm(entry.timeInMinutes),
    }));
  }

  private applyCalciumRule(entries: WorkingEntry[]): void {
    const calciumEntries = entries.filter(
      (entry) =>
        entry.groupCode === GroupCode.GROUP_III_CALC &&
        entry.status === ScheduleStatus.ACTIVE,
    );
    calciumEntries.forEach((calcium) => {
      const conflicting = entries.find(
        (entry) =>
          entry !== calcium &&
          entry.status === ScheduleStatus.ACTIVE &&
          entry.timeInMinutes === calcium.timeInMinutes &&
          entry.interferesWithSalts,
      );

      if (conflicting) {
        calcium.timeInMinutes += 60;
        calcium.note = `Cálcio deslocado 1 hora por interferência com ${conflicting.medicationName}.`;
      }
    });
  }

  private applySaltRule(entries: WorkingEntry[]): void {
    const saltEntries = entries.filter(
      (entry) =>
        entry.groupCode === GroupCode.GROUP_III_SAL &&
        entry.status === ScheduleStatus.ACTIVE,
    );
    saltEntries.forEach((salt) => {
      const conflict = entries.find(
        (entry) =>
          entry !== salt &&
          entry.status === ScheduleStatus.ACTIVE &&
          entry.timeInMinutes === salt.timeInMinutes &&
          entry.interferesWithSalts,
      );
      if (conflict) {
        salt.status = ScheduleStatus.INACTIVE;
        salt.note = `Dose inativada por conflito com ${conflictingName(conflict)}.`;
      }
    });
  }

  private applySucralfateRule(
    entries: WorkingEntry[],
    anchors: ScheduleAnchors,
  ): void {
    const sucralfateEntries = entries.filter(
      (entry) =>
        entry.groupCode === GroupCode.GROUP_II_SUCRA &&
        entry.status === ScheduleStatus.ACTIVE,
    );
    sucralfateEntries.forEach((entry) => {
      const currentConflict = entries.some(
        (other) =>
          other !== entry &&
          other.status === ScheduleStatus.ACTIVE &&
          other.timeInMinutes === entry.timeInMinutes,
      );
      if (!currentConflict) return;

      const alternative = anchors[MealAnchor.ALMOCO] + 120;
      const bedtimeConflict = entries.some(
        (other) =>
          other !== entry &&
          other.status === ScheduleStatus.ACTIVE &&
          other.timeInMinutes === anchors[MealAnchor.DORMIR],
      );
      const alternativeConflict = entries.some(
        (other) =>
          other !== entry &&
          other.status === ScheduleStatus.ACTIVE &&
          other.timeInMinutes === alternative,
      );

      if (!alternativeConflict && !bedtimeConflict) {
        entry.timeInMinutes = alternative;
        entry.note =
          "Sucralfato deslocado para almoço + 2h por conflito no horário principal.";
        return;
      }

      entry.status = ScheduleStatus.INACTIVE;
      entry.note =
        "Sucralfato inativado por conflito no horário principal, alternativo e/ou dormir.";
    });
  }

  private detectResidualConflicts(entries: WorkingEntry[]): void {
    const grouped = new Map<number, WorkingEntry[]>();
    entries
      .filter((entry) => entry.status === ScheduleStatus.ACTIVE)
      .forEach((entry) => {
        const list = grouped.get(entry.timeInMinutes) ?? [];
        list.push(entry);
        grouped.set(entry.timeInMinutes, list);
      });

    grouped.forEach((list) => {
      if (list.length <= 1) return;
      const highPriorityGroups = [
        GroupCode.GROUP_II,
        GroupCode.GROUP_II_BIFOS,
        GroupCode.GROUP_II_SUCRA,
        GroupCode.GROUP_INSUL_ULTRA,
        GroupCode.GROUP_INSUL_RAPIDA,
      ];

      const anchor = list.find((entry) =>
        highPriorityGroups.includes(entry.groupCode as GroupCode),
      );
      list.forEach((entry) => {
        if (anchor && entry !== anchor) {
          entry.status = ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED;
          entry.note = `Conflito com dose prioritária ${anchor.medicationName}; ajuste manual recomendado.`;
        }
      });
    });
  }

  private createBaseEntry(
    item: PrescriptionItem,
    doseLabel: string,
    timeInMinutes: number,
    note?: string,
  ): WorkingEntry {
    return {
      medicationId: item.medication.id,
      medicationName:
        item.medication.commercialName || item.medication.activePrinciple,
      groupCode: item.medication.group.code,
      doseLabel,
      administrationLabel: doseLabel,
      continuousUse: item.continuousUse,
      isPrn: false,
      timeInMinutes,
      timeFormatted: minutesToHhmm(timeInMinutes),
      status: ScheduleStatus.ACTIVE,
      note,
      prescriptionItem: item,
      interferesWithSalts: item.medication.interferesWithSalts,
    };
  }

  private resolveDoseForEntry(entry: WorkingEntry): WorkingEntry {
    const administration = this.resolveAdministration(
      entry.prescriptionItem,
      entry.doseLabel,
    );

    return {
      ...entry,
      administrationValue: administration.administrationValue,
      administrationUnit: administration.administrationUnit,
      administrationLabel: administration.administrationLabel,
    };
  }

  private attachClinicalMetadata(
    entry: WorkingEntry,
    prescription: Prescription,
  ): WorkingEntry {
    return {
      ...entry,
      ...buildRecurrenceMetadata(entry.prescriptionItem, prescription),
    };
  }

  private attachPrnMetadata(entry: WorkingEntry): WorkingEntry {
    if (!entry.isPrn) {
      return entry;
    }

    return {
      ...entry,
      clinicalInstructionLabel: buildClinicalInstructionLabel(
        entry.recurrenceType ?? TreatmentRecurrence.PRN,
        entry.prnReason,
      ),
      note:
        entry.note ??
        "Dose sob demanda; administrar apenas se houver indicacao clinica.",
    };
  }

  private resolveAdministration(
    item: PrescriptionItem,
    doseLabel: string,
  ): ResolvedAdministration {
    const override = this.findDoseOverride(item, doseLabel);
    const administrationValue = override?.doseValue ?? item.doseValue;
    const administrationUnit = override?.doseUnit ?? item.doseUnit;

    if (administrationValue && administrationUnit) {
      return {
        administrationValue,
        administrationUnit,
        administrationLabel: `${administrationValue} ${administrationUnit}`,
      };
    }

    const fallbackLabel = administrationValue ?? item.doseAmount ?? doseLabel;

    return {
      administrationValue,
      administrationUnit,
      administrationLabel: fallbackLabel,
    };
  }

  private findDoseOverride(
    item: PrescriptionItem,
    doseLabel: string,
  ): PrescriptionItemDoseOverride | undefined {
    if (item.sameDosePerSchedule || !item.perDoseOverrides?.length) {
      return undefined;
    }

    return item.perDoseOverrides.find((override) => override.doseLabel === doseLabel);
  }

  private sortEntries(entries: WorkingEntry[]): WorkingEntry[] {
    return [...entries].sort(
      (a, b) =>
        a.timeInMinutes - b.timeInMinutes ||
        a.medicationName.localeCompare(b.medicationName),
    );
  }

  private async persistSchedule(
    prescription: Prescription,
    entries: WorkingEntry[],
    entityManager?: EntityManager,
  ): Promise<ScheduledDose[]> {
    const scheduledDoseRepository = this.getScheduledDoseRepository(entityManager);

    await scheduledDoseRepository.delete({
      prescription: { id: prescription.id },
    });

    return scheduledDoseRepository.save(
      entries.map((entry) =>
        this.toScheduledDoseEntity(scheduledDoseRepository, prescription, entry),
      ),
    );
  }

  private getScheduledDoseRepository(
    entityManager?: EntityManager,
  ): Repository<ScheduledDose> {
    return entityManager?.getRepository(ScheduledDose) ?? this.scheduledDoseRepository;
  }

  private toScheduledDoseEntity(
    scheduledDoseRepository: Repository<ScheduledDose>,
    prescription: Prescription,
    entry: WorkingEntry,
  ): ScheduledDose {
    return scheduledDoseRepository.create({
      prescription,
      prescriptionItem: entry.prescriptionItem,
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
      status: entry.status,
      note: entry.note,
    });
  }

  private mapSchedulingResult(
    prescription: Prescription,
    persisted: ScheduledDose[],
  ): SchedulingResultDto {
    return {
      patientId: prescription.patient.id,
      prescriptionId: prescription.id,
      entries: persisted.map((entry) => this.mapScheduleEntry(entry)),
    };
  }

  private mapScheduleEntry(entry: ScheduledDose): ScheduleEntryDto {
    const recurrenceLabel = entry.recurrenceType
      ? formatClinicalRecurrenceLabel({
          recurrenceType: entry.recurrenceType,
          startDate: entry.startDate ?? "",
          endDate: entry.endDate,
          weeklyDay: entry.weeklyDay,
          monthlyRule: entry.monthlyRule,
          monthlyDay: entry.monthlyDay,
          alternateDaysInterval: entry.alternateDaysInterval,
          continuousUse: entry.continuousUse,
          isPrn: entry.isPrn,
          prnReason: entry.prnReason,
          clinicalInstructionLabel: entry.clinicalInstructionLabel,
        })
      : undefined;

    return {
      medicationId: entry.prescriptionItem.medication.id,
      medicationName:
        entry.prescriptionItem.medication.commercialName ||
        entry.prescriptionItem.medication.activePrinciple,
      groupCode: entry.prescriptionItem.medication.group.code,
      doseLabel: entry.doseLabel,
      administrationValue: entry.administrationValue,
      administrationUnit: entry.administrationUnit,
      administrationLabel: entry.administrationLabel ?? entry.doseLabel,
      recurrenceType: entry.recurrenceType,
      recurrenceLabel,
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
      status: entry.status,
      note: entry.note,
    };
  }

  async getScheduleByPrescription(
    prescriptionId: string,
  ): Promise<SchedulingResultDto> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId },
      relations: ["patient"],
    });

    if (!prescription) {
      throw new NotFoundException("Prescrição não encontrada.");
    }

    const scheduledDoses = await this.scheduledDoseRepository.find({
      where: { prescription: { id: prescriptionId } },
      relations: [
        "prescriptionItem",
        "prescriptionItem.medication",
        "prescriptionItem.medication.group",
      ],
      order: { timeInMinutes: "ASC" },
    });

    return this.mapSchedulingResult(prescription, scheduledDoses);
  }
}

function conflictingName(entry: WorkingEntry): string {
  return entry.medicationName;
}

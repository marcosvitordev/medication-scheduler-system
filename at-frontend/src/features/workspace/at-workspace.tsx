"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CalendarPlus,
  Check,
  ClipboardList,
  Clock3,
  Database,
  History,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, type UseFormReturn } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, inputClassName } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { clinicalCatalogService, patientService, prescriptionService } from "@/lib/api/services";
import { queryKeys } from "@/lib/api/query-keys";
import { formatApiError } from "@/lib/utils";
import {
  manualAdjustmentSchema,
  patientFormSchema,
  prescriptionFormSchema,
  routineFormSchema,
  type ManualAdjustmentValues,
  type PatientFormValues,
  type PrescriptionMedicationFormValues,
  type PrescriptionPhaseFormValues,
  type PrescriptionFormValues,
  type RoutineFormValues,
} from "@/lib/schemas/forms";
import type {
  CalendarScheduleResponseDto,
  ClinicalMedication,
  ClinicalProtocol,
  ClinicalProtocolFrequency,
  DoseUnit,
  OcularLaterality,
  OticLaterality,
  Patient,
  PatientRoutine,
  TreatmentRecurrence,
} from "@/types/contracts";
import { doseBorderClass, flattenDoses, statusVariant, toDoseUnitLabel } from "./formatters";

type StepId = "patient" | "routine" | "prescription" | "review" | "calendar";

type SelectedDose = ReturnType<typeof flattenDoses>[number];

const steps: Array<{ id: StepId; label: string; icon: React.ElementType }> = [
  { id: "patient", label: "Paciente", icon: UserRound },
  { id: "routine", label: "Rotina", icon: Clock3 },
  { id: "prescription", label: "Prescrição", icon: ClipboardList },
  { id: "review", label: "Resumo", icon: Check },
  { id: "calendar", label: "Calendário", icon: CalendarDays },
];

const recurrenceOptions: Array<{ value: TreatmentRecurrence; label: string }> = [
  { value: "DAILY", label: "Diário" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "ALTERNATE_DAYS", label: "Dias alternados" },
  { value: "PRN", label: "Se necessário" },
];

const weeklyDayOptions = [
  { value: "SEGUNDA", label: "Segunda-feira" },
  { value: "TERCA", label: "Terça-feira" },
  { value: "QUARTA", label: "Quarta-feira" },
  { value: "QUINTA", label: "Quinta-feira" },
  { value: "SEXTA", label: "Sexta-feira" },
  { value: "SABADO", label: "Sábado" },
  { value: "DOMINGO", label: "Domingo" },
];

const prnReasonOptions = [
  { value: "CRISIS", label: "Crise" },
  { value: "FEVER", label: "Febre" },
  { value: "PAIN", label: "Dor" },
  { value: "NAUSEA_VOMITING", label: "Náusea ou vômito" },
  { value: "SHORTNESS_OF_BREATH", label: "Falta de ar" },
];

const doseUnits: DoseUnit[] = [
  "COMP",
  "CAP",
  "DRAGEA",
  "ML",
  "GOTAS",
  "UI",
  "JATOS",
  "APLICADOR",
  "BISNAGA",
  "SUPOSITORIO",
  "AREA_AFETADA",
];

const ocularLateralityOptions: Array<{ value: OcularLaterality; label: string }> = [
  { value: "RIGHT_EYE", label: "Olho direito" },
  { value: "LEFT_EYE", label: "Olho esquerdo" },
  { value: "BOTH_EYES", label: "Ambos os olhos" },
];

const oticLateralityOptions: Array<{ value: OticLaterality; label: string }> = [
  { value: "RIGHT_EAR", label: "Ouvido direito" },
  { value: "LEFT_EAR", label: "Ouvido esquerdo" },
  { value: "BOTH_EARS", label: "Ambos os ouvidos" },
];

const emptyPatientForm: PatientFormValues = {
  fullName: "",
  birthDate: "",
  rg: "",
  cpf: "",
  phone: "",
};

const emptyRoutineForm: RoutineFormValues = {
  acordar: "",
  cafe: "",
  almoco: "",
  lanche: "",
  jantar: "",
  dormir: "",
  banho: "",
};

function emptyPrescriptionPhaseForm(overrides: Partial<PrescriptionPhaseFormValues> = {}): PrescriptionPhaseFormValues {
  return {
    frequency: 0,
    sameDosePerSchedule: true,
    doseValue: "",
    doseUnit: "",
    perDoseOverrides: [],
    recurrenceType: "DAILY",
    weeklyDay: undefined,
    monthlyDay: undefined,
    monthlySpecialReference: undefined,
    monthlySpecialBaseDate: undefined,
    monthlySpecialOffsetDays: undefined,
    alternateDaysInterval: undefined,
    prnReason: undefined,
    ocularLaterality: undefined,
    oticLaterality: undefined,
    glycemiaScaleRanges: [],
    treatmentDays: undefined,
    continuousUse: false,
    manualAdjustmentEnabled: false,
    manualTimes: [],
    ...overrides,
  };
}

function emptyGlycemiaScaleRange(doseUnit: DoseUnit | "" = "UI") {
  return {
    minimum: undefined as unknown as number,
    maximum: undefined as unknown as number,
    doseValue: "",
    doseUnit: (doseUnit || "UI") as DoseUnit,
  };
}

function emptyPrescriptionPhaseForMedication(medication: ClinicalMedication | null) {
  return emptyPrescriptionPhaseForm({
    doseUnit: medication?.defaultAdministrationUnit ?? "",
    glycemiaScaleRanges: medication?.requiresGlycemiaScale
      ? [emptyGlycemiaScaleRange(medication.defaultAdministrationUnit ?? "UI")]
      : [],
  });
}

function emptyPrescriptionMedicationForm(): PrescriptionMedicationFormValues {
  return {
    clinicalMedicationId: "",
    protocolId: "",
    phases: [emptyPrescriptionPhaseForm()],
  };
}

const emptyPrescriptionForm: PrescriptionFormValues = {
  startedAt: "",
  medications: [emptyPrescriptionMedicationForm()],
};

function createPerDoseOverrides(frequency: number, doseValue = "", doseUnit = "") {
  return Array.from({ length: Math.max(frequency, 0) }, (_, index) => ({
    doseLabel: `D${index + 1}`,
    doseValue,
    doseUnit,
  }));
}

function resizePerDoseOverrides(
  frequency: number,
  currentOverrides: PrescriptionPhaseFormValues["perDoseOverrides"],
  doseValue = "",
  doseUnit = "",
) {
  return Array.from({ length: Math.max(frequency, 0) }, (_, index) => {
    const doseLabel = `D${index + 1}`;
    const current = currentOverrides?.find((override) => override.doseLabel === doseLabel);
    return {
      doseLabel,
      doseValue: current?.doseValue ?? doseValue,
      doseUnit: current?.doseUnit ?? doseUnit,
    };
  });
}

export function AtWorkspace() {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<StepId>("patient");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [schedule, setSchedule] = useState<CalendarScheduleResponseDto | null>(null);
  const [reviewValues, setReviewValues] = useState<PrescriptionFormValues | null>(null);
  const [selectedDoseKey, setSelectedDoseKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const patientsQuery = useQuery({
    queryKey: queryKeys.patients,
    queryFn: patientService.list,
  });

  const catalogQuery = useQuery({
    queryKey: queryKeys.clinicalMedications,
    queryFn: clinicalCatalogService.listMedications,
  });

  const patientForm = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: emptyPatientForm,
  });

  const routineForm = useForm<RoutineFormValues>({
    resolver: zodResolver(routineFormSchema),
    defaultValues: emptyRoutineForm,
  });

  const prescriptionForm = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionFormSchema),
    defaultValues: emptyPrescriptionForm,
  });
  const prescriptionMedicationFields = useFieldArray({
    control: prescriptionForm.control,
    name: "medications",
  });

  const manualForm = useForm<ManualAdjustmentValues>({
    resolver: zodResolver(manualAdjustmentSchema),
    mode: "onChange",
    defaultValues: { times: [] },
  });

  const watchedPrescriptionMedications = prescriptionForm.watch("medications");
  const watchedCpf = patientForm.watch("cpf") ?? "";
  const normalizedWatchedCpf = normalizeCpf(watchedCpf) ?? "";
  const duplicatePatientByCpf =
    normalizedWatchedCpf.length === 11
      ? patientsQuery.data?.find((patient) => normalizeCpf(patient.cpf ?? "") === normalizedWatchedCpf) ?? null
      : null;
  const activeRoutine = useMemo(() => resolveActiveRoutine(selectedPatient), [selectedPatient]);
  const scheduleDoses = useMemo(() => flattenDoses(schedule?.scheduleItems ?? []), [schedule]);
  const selectedDose = scheduleDoses.find((entry) => entry.key === selectedDoseKey) ?? scheduleDoses[0] ?? null;
  const selectedPhaseDoses = useMemo(() => {
    if (!selectedDose) return [];
    return scheduleDoses
      .filter(
	        (entry) =>
	          entry.item.prescriptionMedicationId === selectedDose.item.prescriptionMedicationId &&
	          entry.item.phaseId === selectedDose.item.phaseId,
      )
      .sort((left, right) => compareDoseLabels(left.dose.label, right.dose.label));
  }, [scheduleDoses, selectedDose]);
  const watchedManualTimes = manualForm.watch("times");
  const manualTimesAreComplete =
    selectedPhaseDoses.length > 0 &&
    watchedManualTimes.length === selectedPhaseDoses.length &&
    watchedManualTimes.every((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time));
  const prescriptionCardsAreComplete =
    watchedPrescriptionMedications.length > 0 &&
	    watchedPrescriptionMedications.every((medication) => {
	      const catalogMedication = resolveMedication(catalogQuery.data ?? [], medication.clinicalMedicationId);
	      const protocol = resolveProtocol(catalogMedication, medication.protocolId);
	      return isPrescriptionMedicationComplete(medication, protocol, catalogMedication);
	    });

  useEffect(() => {
    if (!selectedPhaseDoses.length) {
      manualForm.reset({ times: [] });
      return;
    }

    manualForm.reset({
      times: selectedPhaseDoses.map((entry) =>
        entry.dose.horario === "24:00" ? "23:59" : entry.dose.horario,
      ),
    });
  }, [manualForm, selectedPhaseDoses]);

  useEffect(() => {
    if (!activeRoutine) {
      routineForm.reset(emptyRoutineForm);
      return;
    }

    routineForm.reset({
      acordar: activeRoutine.acordar,
      cafe: activeRoutine.cafe,
      almoco: activeRoutine.almoco,
      lanche: activeRoutine.lanche,
      jantar: activeRoutine.jantar,
      dormir: activeRoutine.dormir,
      banho: activeRoutine.banho ?? "",
    });
  }, [activeRoutine, routineForm]);

  const createPatientMutation = useMutation({
    mutationFn: (values: PatientFormValues) =>
      patientService.create({
        ...values,
        cpf: normalizeCpf(values.cpf),
      }),
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      setSelectedPatient(patient);
      setCurrentStep("routine");
      setMessage({ tone: "success", text: "Paciente salvo e selecionado para atendimento." });
    },
    onError: (error) => setMessage({ tone: "error", text: formatApiError(error) }),
  });

  const addRoutineMutation = useMutation({
    mutationFn: (values: RoutineFormValues) => {
      if (!selectedPatient) throw new Error("Selecione um paciente antes de salvar a rotina.");
      return patientService.addRoutine(selectedPatient.id, {
        ...values,
        banho: values.banho || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      setCurrentStep("prescription");
      setMessage({
        tone: "success",
        text: activeRoutine
          ? "Rotina ativa substituída. A rotina anterior foi preservada no histórico."
          : "Rotina ativa registrada para o paciente.",
      });
    },
    onError: (error) => setMessage({ tone: "error", text: formatApiError(error) }),
  });

  const seedCatalogMutation = useMutation({
    mutationFn: clinicalCatalogService.seed,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clinicalMedications });
      setMessage({ tone: "success", text: "Catálogo clínico populado com dados iniciais." });
    },
    onError: (error) => setMessage({ tone: "error", text: formatApiError(error) }),
  });

	  const createPrescriptionMutation = useMutation({
	    mutationFn: async (values: PrescriptionFormValues) => {
	      if (!selectedPatient) throw new Error("Selecione um paciente antes de criar a prescrição.");
	      const catalog = catalogQuery.data ?? [];
	
	      return prescriptionService.create({
	        patientId: selectedPatient.id,
	        startedAt: values.startedAt,
	        medications: values.medications.map((medication) => {
          const selectedMedication = resolveMedication(catalog, medication.clinicalMedicationId);
          const selectedProtocol = resolveProtocol(selectedMedication, medication.protocolId);
          if (!selectedMedication || !selectedProtocol) {
            throw new Error("Selecione medicamento e protocolo para todos os itens da prescrição.");
          }

          return {
            clinicalMedicationId: selectedMedication.id,
            protocolId: selectedProtocol.id,
            phases: medication.phases.map((phase, phaseIndex) => ({
              phaseOrder: phaseIndex + 1,
              frequency: phase.frequency,
              sameDosePerSchedule: phase.sameDosePerSchedule,
              doseValue: phase.sameDosePerSchedule ? phase.doseValue : undefined,
              doseUnit: phase.sameDosePerSchedule ? (phase.doseUnit as DoseUnit) : undefined,
              doseAmount: phase.sameDosePerSchedule ? `${phase.doseValue} ${phase.doseUnit}` : undefined,
              perDoseOverrides: phase.sameDosePerSchedule
                ? undefined
                : phase.perDoseOverrides?.map((override) => ({
                    doseLabel: override.doseLabel,
                    doseValue: override.doseValue,
                    doseUnit: override.doseUnit as DoseUnit,
                  })),
	              recurrenceType: phase.recurrenceType,
	              weeklyDay: phase.recurrenceType === "WEEKLY" ? phase.weeklyDay : undefined,
	              monthlyDay:
	                phase.recurrenceType === "MONTHLY" && !selectedMedication.isContraceptiveMonthly
	                  ? phase.monthlyDay
	                  : undefined,
	              monthlySpecialReference:
	                selectedMedication.isContraceptiveMonthly && phase.recurrenceType === "MONTHLY"
	                  ? "MENSTRUATION_START"
	                  : undefined,
	              monthlySpecialBaseDate:
	                selectedMedication.isContraceptiveMonthly && phase.recurrenceType === "MONTHLY"
	                  ? phase.monthlySpecialBaseDate
	                  : undefined,
	              monthlySpecialOffsetDays:
	                selectedMedication.isContraceptiveMonthly && phase.recurrenceType === "MONTHLY"
	                  ? phase.monthlySpecialOffsetDays
	                  : undefined,
	              alternateDaysInterval:
	                phase.recurrenceType === "ALTERNATE_DAYS" ? phase.alternateDaysInterval : undefined,
	              prnReason: phase.recurrenceType === "PRN" ? phase.prnReason : undefined,
	              ocularLaterality: selectedMedication.isOphthalmic ? phase.ocularLaterality : undefined,
	              oticLaterality: selectedMedication.isOtic ? phase.oticLaterality : undefined,
	              glycemiaScaleRanges: selectedMedication.requiresGlycemiaScale
	                ? phase.glycemiaScaleRanges?.map((range) => ({
	                    minimum: range.minimum,
	                    maximum: range.maximum,
	                    doseValue: range.doseValue,
	                    doseUnit: range.doseUnit as DoseUnit,
	                  }))
	                : undefined,
	              treatmentDays: phase.continuousUse ? undefined : phase.treatmentDays,
	              continuousUse: phase.continuousUse,
              manualAdjustmentEnabled: phase.manualAdjustmentEnabled,
              manualTimes: phase.manualAdjustmentEnabled ? phase.manualTimes : undefined,
            })),
          };
	        }),
	      });
	    },
	    onSuccess: (result) => {
	      setSchedule(result);
	      setSelectedDoseKey(flattenDoses(result.scheduleItems)[0]?.key ?? null);
	      setCurrentStep("calendar");
	      setMessage({ tone: "success", text: "Prescrição criada e calendário gerado." });
	    },
    onError: (error) => setMessage({ tone: "error", text: formatApiError(error) }),
  });

	  const manualAdjustmentMutation = useMutation({
	    mutationFn: async (values: ManualAdjustmentValues) => {
	      if (!schedule || !selectedDose) {
	        throw new Error("Prescrição ou dose selecionada não encontrada.");
	      }
	
	      return prescriptionService.update(schedule.prescriptionId, {
	        updateMedications: [
	          {
	            prescriptionMedicationId: selectedDose.item.prescriptionMedicationId,
	            updatePhases: [
	              {
	                phaseId: selectedDose.item.phaseId,
	                manualAdjustmentEnabled: true,
                manualTimes: values.times,
              },
            ],
          },
        ],
      });
    },
    onSuccess: (result) => {
      const previousSelectedDose = selectedDose;
      setSchedule(result);
      const nextDoses = flattenDoses(result.scheduleItems);
      const nextSelectedDose =
        nextDoses.find(
          (entry) =>
	            previousSelectedDose &&
	            entry.item.prescriptionMedicationId === previousSelectedDose.item.prescriptionMedicationId &&
	            entry.item.phaseId === previousSelectedDose.item.phaseId,
        ) ?? nextDoses[0];
      setSelectedDoseKey(nextSelectedDose?.key ?? null);
      setMessage({ tone: "success", text: "Ajuste manual aplicado e calendário regenerado." });
    },
    onError: (error) => setMessage({ tone: "error", text: formatApiError(error) }),
  });

	  function handlePrescriptionMedicationChange(index: number, medicationId: string) {
	    const medication = resolveMedication(catalogQuery.data ?? [], medicationId);
	    prescriptionForm.setValue(`medications.${index}.clinicalMedicationId`, medicationId, { shouldValidate: true });
	    prescriptionForm.setValue(`medications.${index}.protocolId`, "", { shouldValidate: true });
	    prescriptionForm.setValue(
	      `medications.${index}.phases`,
	      [emptyPrescriptionPhaseForMedication(medication)],
	      { shouldValidate: true },
	    );
	  }

  function handlePrescriptionProtocolChange(index: number, protocolId: string) {
    const currentPhases = prescriptionForm.getValues(`medications.${index}.phases`);
    prescriptionForm.setValue(`medications.${index}.protocolId`, protocolId, { shouldValidate: true });
    prescriptionForm.setValue(
      `medications.${index}.phases`,
      currentPhases.map((phase) => ({
        ...phase,
        frequency: 0,
	        recurrenceType: "DAILY" as const,
	        weeklyDay: undefined,
	        monthlyDay: undefined,
	        monthlySpecialReference: undefined,
	        monthlySpecialBaseDate: undefined,
	        monthlySpecialOffsetDays: undefined,
	        alternateDaysInterval: undefined,
	        prnReason: undefined,
        sameDosePerSchedule: true,
        perDoseOverrides: [],
        manualTimes: [],
      })),
      { shouldValidate: true },
    );
  }

  function clearIncompatibleRecurrenceFields(
    medicationIndex: number,
    phaseIndex: number,
    recurrenceType: TreatmentRecurrence,
  ) {
    const phasePath = `medications.${medicationIndex}.phases.${phaseIndex}` as const;
    if (recurrenceType !== "WEEKLY") {
      prescriptionForm.setValue(`${phasePath}.weeklyDay`, undefined, { shouldValidate: true });
    }
	    if (recurrenceType !== "MONTHLY") {
	      prescriptionForm.setValue(`${phasePath}.monthlyDay`, undefined, { shouldValidate: true });
	      prescriptionForm.setValue(`${phasePath}.monthlySpecialReference`, undefined, { shouldValidate: true });
	      prescriptionForm.setValue(`${phasePath}.monthlySpecialBaseDate`, undefined, { shouldValidate: true });
	      prescriptionForm.setValue(`${phasePath}.monthlySpecialOffsetDays`, undefined, { shouldValidate: true });
	    }
    if (recurrenceType !== "ALTERNATE_DAYS") {
      prescriptionForm.setValue(`${phasePath}.alternateDaysInterval`, undefined, { shouldValidate: true });
    }
    if (recurrenceType !== "PRN") {
      prescriptionForm.setValue(`${phasePath}.prnReason`, undefined, { shouldValidate: true });
    }
  }

  function handlePrescriptionFrequencyChange(medicationIndex: number, phaseIndex: number, frequency: number) {
    const medication = prescriptionForm.getValues(`medications.${medicationIndex}`);
    const catalogMedication = resolveMedication(catalogQuery.data ?? [], medication.clinicalMedicationId);
    const protocol = resolveProtocol(catalogMedication, medication.protocolId);
    const frequencyConfig = resolveFrequencyConfig(protocol, frequency);
    const phase = prescriptionForm.getValues(`medications.${medicationIndex}.phases.${phaseIndex}`);
    const currentRecurrence = prescriptionForm.getValues(
      `medications.${medicationIndex}.phases.${phaseIndex}.recurrenceType`,
    );
    const nextRecurrence = isRecurrenceAllowed(currentRecurrence, frequencyConfig)
      ? currentRecurrence
      : getDefaultRecurrenceForFrequency(frequencyConfig);

    prescriptionForm.setValue(`medications.${medicationIndex}.phases.${phaseIndex}.frequency`, frequency, {
      shouldValidate: true,
    });
    prescriptionForm.setValue(`medications.${medicationIndex}.phases.${phaseIndex}.recurrenceType`, nextRecurrence, {
      shouldValidate: true,
    });
    clearIncompatibleRecurrenceFields(medicationIndex, phaseIndex, nextRecurrence);
    const manualAdjustmentEnabled = prescriptionForm.getValues(
      `medications.${medicationIndex}.phases.${phaseIndex}.manualAdjustmentEnabled`,
    );
    prescriptionForm.setValue(
      `medications.${medicationIndex}.phases.${phaseIndex}.manualTimes`,
      manualAdjustmentEnabled && frequency > 0 ? Array.from({ length: frequency }, () => "") : [],
      { shouldValidate: true },
    );
    if (!phase.sameDosePerSchedule && frequencyConfig?.allowsVariableDoseBySchedule === true) {
      prescriptionForm.setValue(
        `medications.${medicationIndex}.phases.${phaseIndex}.perDoseOverrides`,
        resizePerDoseOverrides(frequency, phase.perDoseOverrides, phase.doseValue ?? "", phase.doseUnit ?? ""),
        { shouldValidate: true },
      );
    } else {
      prescriptionForm.setValue(`medications.${medicationIndex}.phases.${phaseIndex}.sameDosePerSchedule`, true, {
        shouldValidate: true,
      });
      prescriptionForm.setValue(`medications.${medicationIndex}.phases.${phaseIndex}.perDoseOverrides`, [], {
        shouldValidate: true,
      });
    }
  }

  function handlePrescriptionManualEnabledChange(medicationIndex: number, phaseIndex: number, enabled: boolean) {
    const frequency = prescriptionForm.getValues(`medications.${medicationIndex}.phases.${phaseIndex}.frequency`);
    prescriptionForm.setValue(`medications.${medicationIndex}.phases.${phaseIndex}.manualAdjustmentEnabled`, enabled, {
      shouldValidate: true,
    });
    prescriptionForm.setValue(
      `medications.${medicationIndex}.phases.${phaseIndex}.manualTimes`,
      enabled && frequency > 0 ? Array.from({ length: frequency }, () => "") : [],
      { shouldValidate: true },
    );
  }

  function handlePrescriptionSameDoseChange(medicationIndex: number, phaseIndex: number, sameDosePerSchedule: boolean) {
    const phase = prescriptionForm.getValues(`medications.${medicationIndex}.phases.${phaseIndex}`);
    prescriptionForm.setValue(
      `medications.${medicationIndex}.phases.${phaseIndex}.sameDosePerSchedule`,
      sameDosePerSchedule,
      { shouldValidate: true },
    );
    prescriptionForm.setValue(
      `medications.${medicationIndex}.phases.${phaseIndex}.perDoseOverrides`,
      sameDosePerSchedule ? [] : createPerDoseOverrides(phase.frequency, phase.doseValue ?? "", phase.doseUnit ?? ""),
      { shouldValidate: true },
    );
  }

  function handlePrescriptionRecurrenceChange(
    medicationIndex: number,
    phaseIndex: number,
    recurrenceType: TreatmentRecurrence,
  ) {
    const phasePath = `medications.${medicationIndex}.phases.${phaseIndex}` as const;
    prescriptionForm.setValue(`${phasePath}.recurrenceType`, recurrenceType, { shouldValidate: true });
    clearIncompatibleRecurrenceFields(medicationIndex, phaseIndex, recurrenceType);
  }

  function appendPrescriptionMedication() {
    prescriptionMedicationFields.append(emptyPrescriptionMedicationForm());
  }

  function resetFlow() {
	    setCurrentStep("patient");
	    setSelectedPatient(null);
	    setSchedule(null);
	    setReviewValues(null);
	    setSelectedDoseKey(null);
    setMessage(null);
    patientForm.reset(emptyPatientForm);
    routineForm.reset(emptyRoutineForm);
    prescriptionForm.reset(emptyPrescriptionForm);
    manualForm.reset({ times: [] });
  }

	  function submitRoutine(values: RoutineFormValues) {
	    if (activeRoutine && selectedPatient) {
	      const confirmed = window.confirm(
        `Você está substituindo a rotina ativa de ${selectedPatient.fullName}. A rotina anterior será mantida no histórico, mas deixará de ser usada para novos agendamentos. Deseja continuar?`,
      );
      if (!confirmed) return;
    }

    addRoutineMutation.mutate(values);
  }

  function submitPrescriptionForReview(values: PrescriptionFormValues) {
    setReviewValues(values);
    setCurrentStep("review");
    setMessage(null);
  }

  return (
    <main className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="border-r bg-white p-4 lg:min-h-screen lg:p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-md bg-primary text-sm font-black text-primary-foreground">
            AT
          </div>
          <div>
            <strong className="block">Sistema AT</strong>
            <span className="text-sm text-muted-foreground">Aprazamento farmacêutico</span>
          </div>
        </div>

        <nav className="grid grid-cols-5 gap-2 lg:grid-cols-1">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <button
                className={`focus-ring flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold lg:justify-start ${
                  currentStep === step.id
                    ? "border-primary/35 bg-primary/10 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-muted"
                }`}
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                type="button"
              >
                <Icon className="size-4" />
                <span className="hidden lg:inline">{step.label}</span>
              </button>
            );
          })}
        </nav>

        <Panel className="mt-6 shadow-none">
          <p className="mb-3 text-xs font-bold uppercase text-muted-foreground">Estado</p>
          <AuditRow label="Paciente" value={selectedPatient?.fullName ?? "Pendente"} />
          <AuditRow
            label="Rotina"
            value={
              selectedPatient
                ? activeRoutine
                  ? "Rotina ativa existente"
                  : "Pronta para cadastro"
                : "Pendente"
            }
          />
          <AuditRow label="Prescrição" value={schedule?.prescriptionId ? "Criada" : reviewValues ? "Em revisão" : "Pendente"} />
          <AuditRow label="Agenda" value={schedule ? `${scheduleDoses.length} doses` : "Não gerada"} />
        </Panel>
      </aside>

      <section className="min-w-0 p-4 lg:p-6">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">MVP conectado à API</p>
            <h1 className="text-2xl font-bold tracking-tight lg:text-4xl">{titleForStep(currentStep)}</h1>
          </div>
          <Button aria-label="Reiniciar fluxo" onClick={resetFlow} size="icon" type="button" variant="secondary">
            <RotateCcw className="size-4" />
          </Button>
        </header>

        {message ? (
          <div
            className={`mb-4 rounded-md border p-3 text-sm font-semibold ${
              message.tone === "success"
                ? "border-success/30 bg-success/10 text-success"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        {currentStep === "patient" ? (
          <Panel className="max-w-5xl">
            <PanelHeader
              action={<Badge variant={selectedPatient ? "success" : "default"}>{selectedPatient ? "Selecionado" : "Pendente"}</Badge>}
              title="Identificação do paciente"
            />
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <form className="grid gap-4" onSubmit={patientForm.handleSubmit((values) => createPatientMutation.mutate(values))}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field error={patientForm.formState.errors.fullName?.message} label="Nome completo">
                    <input className={inputClassName} {...patientForm.register("fullName")} />
                  </Field>
                  <Field error={patientForm.formState.errors.birthDate?.message} label="Nascimento">
                    <input className={inputClassName} type="date" {...patientForm.register("birthDate")} />
                  </Field>
                  <Field label="RG">
                    <input className={inputClassName} {...patientForm.register("rg")} />
                  </Field>
                  <Field label="CPF">
                    <input className={inputClassName} {...patientForm.register("cpf")} />
                  </Field>
                  <Field className="md:col-span-2" label="Telefone">
                    <input className={inputClassName} {...patientForm.register("phone")} />
                  </Field>
                </div>
                {normalizedWatchedCpf && normalizedWatchedCpf.length !== 11 ? (
                  <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm font-semibold text-warning">
                    CPF deve conter 11 dígitos. Você pode digitar com ou sem máscara.
                  </div>
                ) : null}
                {duplicatePatientByCpf ? (
                  <div className="flex flex-col gap-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning md:flex-row md:items-center md:justify-between">
                    <strong>
                      Já existe paciente com este CPF: {duplicatePatientByCpf.fullName}.
                    </strong>
                    <Button
                      onClick={() => {
                        setSelectedPatient(duplicatePatientByCpf);
                        setCurrentStep("routine");
                        setMessage({ tone: "success", text: "Paciente existente selecionado para atendimento." });
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Selecionar paciente existente
                    </Button>
                  </div>
                ) : null}
                <div className="flex justify-end">
                  <Button disabled={createPatientMutation.isPending || Boolean(duplicatePatientByCpf)} type="submit">
                    {createPatientMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Salvar paciente
                  </Button>
                </div>
              </form>

              <div className="rounded-md border bg-muted/40 p-4">
                <h3 className="mb-3 font-bold">Pacientes existentes</h3>
                <div className="grid max-h-[320px] gap-2 overflow-auto">
                  {patientsQuery.isLoading ? <span className="text-sm text-muted-foreground">Carregando...</span> : null}
                  {patientsQuery.data?.map((patient) => (
                    <button
                      className="focus-ring rounded-md border bg-white p-3 text-left hover:bg-muted"
                      key={patient.id}
                      onClick={() => {
                        setSelectedPatient(patient);
                        setCurrentStep("routine");
                        setMessage({ tone: "success", text: "Paciente selecionado para atendimento." });
                      }}
                      type="button"
                    >
                      <strong className="block">{patient.fullName}</strong>
                      <span className="text-sm text-muted-foreground">{formatCpf(patient.cpf) ?? "Sem CPF"} · {patient.phone ?? "Sem telefone"}</span>
                    </button>
                  ))}
                  {!patientsQuery.isLoading && !patientsQuery.data?.length ? (
                    <span className="text-sm text-muted-foreground">Nenhum paciente cadastrado.</span>
                  ) : null}
                </div>
              </div>
            </div>
          </Panel>
        ) : null}

        {currentStep === "routine" ? (
          <Panel className="max-w-5xl">
            <PanelHeader
              action={<Badge variant={selectedPatient ? "primary" : "warning"}>{selectedPatient?.fullName ?? "Selecione paciente"}</Badge>}
              title="Rotina diária"
            />
            {activeRoutine ? (
              <div className="mb-5 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                <div className="flex items-start gap-3">
                  <History className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <strong className="block">Este paciente já possui rotina ativa.</strong>
                    <span>
                      Ao confirmar, a rotina atual será arquivada e uma nova rotina ativa será criada.
                      {activeRoutine.createdAt
                        ? ` Rotina atual criada em ${formatDateTime(activeRoutine.createdAt)}.`
                        : ""}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
            {activeRoutine ? (
              <div className="mb-5 grid gap-2 rounded-md border bg-muted/30 p-4 text-sm md:grid-cols-4">
                <strong className="md:col-span-4">Horários ativos atuais</strong>
                {routineFields.map((field) => (
                  <span key={field.name} className="text-muted-foreground">
                    {field.label}: <strong className="text-foreground">{activeRoutine[field.name] ?? "--:--"}</strong>
                  </span>
                ))}
              </div>
            ) : null}
            <form className="grid gap-5" onSubmit={routineForm.handleSubmit(submitRoutine)}>
              <div className="grid gap-4 md:grid-cols-4">
                {routineFields.map((field) => (
                  <Field error={routineForm.formState.errors[field.name]?.message} key={field.name} label={field.label}>
                    <input className={inputClassName} type="time" {...routineForm.register(field.name)} />
                  </Field>
                ))}
              </div>
              <RoutineTimeline values={routineForm.watch()} />
              <div className="flex justify-between gap-3">
                <Button onClick={() => setCurrentStep("patient")} type="button" variant="secondary">
                  Voltar
                </Button>
                <Button disabled={!selectedPatient || addRoutineMutation.isPending} type="submit">
                  {addRoutineMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                  {activeRoutine ? "Substituir rotina ativa" : "Salvar rotina"}
                </Button>
              </div>
            </form>
          </Panel>
        ) : null}

        {currentStep === "prescription" ? (
          <Panel className="max-w-6xl">
            <PanelHeader
              action={
                <Button
                  disabled={seedCatalogMutation.isPending}
                  onClick={() => seedCatalogMutation.mutate()}
                  type="button"
                  variant="secondary"
                >
                  {seedCatalogMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Database className="size-4" />}
                  Popular catálogo
                </Button>
              }
              title="Montagem da prescrição"
            />

            {catalogQuery.data?.length === 0 ? (
              <div className="mb-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm font-semibold text-warning">
                Catálogo vazio. Use o botão “Popular catálogo” antes de criar a prescrição.
              </div>
            ) : null}

	            <form
	              className="grid gap-5"
	              onSubmit={prescriptionForm.handleSubmit(submitPrescriptionForReview)}
	            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <Field error={prescriptionForm.formState.errors.startedAt?.message} label="Início">
                  <input className={inputClassName} type="date" {...prescriptionForm.register("startedAt")} />
                </Field>
                <Button onClick={appendPrescriptionMedication} type="button" variant="secondary">
                  <Plus className="size-4" />
                  Adicionar medicamento
                </Button>
              </div>

              <div className="grid gap-4">
                {prescriptionMedicationFields.fields.map((field, index) => (
                  <PrescriptionMedicationCard
                    canRemove={prescriptionMedicationFields.fields.length > 1}
                    catalog={catalogQuery.data ?? []}
                    form={prescriptionForm}
                    index={index}
                    key={field.id}
                    onFrequencyChange={handlePrescriptionFrequencyChange}
                    onManualEnabledChange={handlePrescriptionManualEnabledChange}
                    onMedicationChange={handlePrescriptionMedicationChange}
                    onProtocolChange={handlePrescriptionProtocolChange}
                    onRecurrenceChange={handlePrescriptionRecurrenceChange}
                    onSameDoseChange={handlePrescriptionSameDoseChange}
                    onRemove={() => prescriptionMedicationFields.remove(index)}
                  />
                ))}
              </div>

              <div className="flex justify-between gap-3">
                <Button onClick={() => setCurrentStep("routine")} type="button" variant="secondary">
                  Voltar
                </Button>
	                <Button
	                  disabled={
	                    !selectedPatient ||
	                    !prescriptionForm.watch("startedAt") ||
	                    !prescriptionCardsAreComplete ||
	                    createPrescriptionMutation.isPending
	                  }
	                  type="submit"
	                >
	                  <Check className="size-4" />
	                  Revisar prescrição
	                </Button>
              </div>
            </form>
	          </Panel>
	        ) : null}

	        {currentStep === "review" ? (
	          <PrescriptionReviewPanel
	            activeRoutine={activeRoutine}
	            catalog={catalogQuery.data ?? []}
	            isPending={createPrescriptionMutation.isPending}
	            onBack={() => setCurrentStep("prescription")}
	            onConfirm={() => {
	              const values = reviewValues ?? prescriptionForm.getValues();
	              createPrescriptionMutation.mutate(values);
	            }}
	            patient={selectedPatient}
	            values={reviewValues ?? prescriptionForm.getValues()}
	          />
	        ) : null}

        {currentStep === "calendar" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Panel>
              <PanelHeader
                action={
                  <Button onClick={() => setCurrentStep("prescription")} type="button" variant="secondary">
                    Editar prescrição
                  </Button>
                }
                eyebrow="Calendário posológico"
                title={schedule?.patient.nome ?? selectedPatient?.fullName ?? "Paciente"}
              />
              {schedule ? (
                <>
                  <DocumentHeader schedule={schedule} />
                  <DoseBoard
                    doses={scheduleDoses}
                    onAdjust={(dose) => {
                      setSelectedDoseKey(dose.key);
                    }}
                    onSelect={(dose) => setSelectedDoseKey(dose.key)}
                    selectedDoseKey={selectedDose?.key ?? null}
                  />
                  {selectedDose ? (
                    <form
                      className="mt-5 rounded-md border bg-muted/30 p-4"
                      onSubmit={manualForm.handleSubmit((values) => manualAdjustmentMutation.mutate(values))}
                    >
                      <h3 className="mb-1 font-bold">Ajuste manual da fase</h3>
                      <p className="mb-3 text-sm text-muted-foreground">
                        Este ajuste vale para a fase inteira, não apenas para a dose selecionada. Informe um horário para cada dose da fase {selectedDose.item.phaseOrder}.
                      </p>
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          {selectedPhaseDoses.map((entry, index) => (
                            <Field
                              error={manualForm.formState.errors.times?.[index]?.message}
                              key={entry.key}
                              label={`${entry.dose.label} · atual ${entry.dose.horario}`}
                            >
                              <input
                                className={inputClassName}
                                type="time"
                                {...manualForm.register(`times.${index}` as const)}
                              />
                            </Field>
                          ))}
                        </div>
                        <div className="flex items-end">
                          <Button
	                            disabled={
	                              !schedule?.prescriptionId ||
	                              manualAdjustmentMutation.isPending ||
	                              !manualTimesAreComplete
                            }
                            type="submit"
                          >
                            {manualAdjustmentMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                            Aplicar ajuste
                          </Button>
                        </div>
                      </div>
                      {!manualTimesAreComplete ? (
                        <p className="mt-3 text-sm font-semibold text-warning">
                          Todos os horários da fase devem estar preenchidos em HH:mm.
                        </p>
                      ) : null}
	                    </form>
                  ) : null}
                </>
              ) : (
                <div className="rounded-md border bg-muted/40 p-6 text-sm text-muted-foreground">
                  Nenhum calendário gerado nesta sessão.
                </div>
              )}
            </Panel>

            <Panel className="xl:sticky xl:top-6 xl:self-start">
              <PanelHeader eyebrow="Dose selecionada" title={selectedDose?.item.medicamento ?? "Sem seleção"} />
              {selectedDose ? <DoseDetails selectedDose={selectedDose} /> : <p className="text-sm text-muted-foreground">Selecione uma dose.</p>}
            </Panel>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function AuditRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-right">{value}</strong>
    </div>
  );
}

const routineFields: Array<{ name: keyof RoutineFormValues; label: string }> = [
  { name: "acordar", label: "Acordar" },
  { name: "cafe", label: "Café" },
  { name: "almoco", label: "Almoço" },
  { name: "lanche", label: "Lanche" },
  { name: "jantar", label: "Jantar" },
  { name: "dormir", label: "Dormir" },
  { name: "banho", label: "Banho" },
];

function RoutineTimeline({ values }: { values: RoutineFormValues }) {
  return (
    <div className="grid gap-2 rounded-md border bg-muted/30 p-4">
      {routineFields.map((field) => {
        const value = values[field.name] || "";
        const [hours, minutes] = value ? value.split(":").map(Number) : [0, 0];
        const percent = value ? Math.max(2, (((hours || 0) * 60 + (minutes || 0)) / 1440) * 100) : 0;
        return (
          <div className="grid grid-cols-[92px_minmax(0,1fr)_54px] items-center gap-3 text-sm" key={field.name}>
            <strong>{field.label}</strong>
            <div className="h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-muted-foreground">{value || "--:--"}</span>
          </div>
        );
      })}
    </div>
  );
}

function PrescriptionMedicationCard({
  canRemove,
  catalog,
  form,
  index,
  onFrequencyChange,
  onManualEnabledChange,
  onMedicationChange,
  onProtocolChange,
  onRecurrenceChange,
  onSameDoseChange,
  onRemove,
}: {
  canRemove: boolean;
  catalog: ClinicalMedication[];
  form: UseFormReturn<PrescriptionFormValues>;
  index: number;
  onFrequencyChange: (medicationIndex: number, phaseIndex: number, frequency: number) => void;
  onManualEnabledChange: (medicationIndex: number, phaseIndex: number, enabled: boolean) => void;
  onMedicationChange: (index: number, medicationId: string) => void;
  onProtocolChange: (index: number, protocolId: string) => void;
  onRecurrenceChange: (medicationIndex: number, phaseIndex: number, recurrenceType: TreatmentRecurrence) => void;
  onSameDoseChange: (medicationIndex: number, phaseIndex: number, sameDosePerSchedule: boolean) => void;
  onRemove: () => void;
}) {
  const values = form.watch(`medications.${index}`) ?? emptyPrescriptionMedicationForm();
  const errors = form.formState.errors.medications?.[index];
  const selectedMedication = resolveMedication(catalog, values.clinicalMedicationId);
  const selectedProtocol = resolveProtocol(selectedMedication, values.protocolId);
  const phaseFields = useFieldArray({
    control: form.control,
    name: `medications.${index}.phases`,
  });

  function appendPhase() {
    const currentPhases = form.getValues(`medications.${index}.phases`);
    const previousPhase = currentPhases.at(-1) ?? emptyPrescriptionPhaseForm();
    if (previousPhase.continuousUse && currentPhases.length > 0) {
      form.setValue(`medications.${index}.phases.${currentPhases.length - 1}.continuousUse`, false, {
        shouldValidate: true,
      });
    }

    phaseFields.append({
      ...previousPhase,
      perDoseOverrides: previousPhase.sameDosePerSchedule
        ? []
        : resizePerDoseOverrides(
            previousPhase.frequency,
            previousPhase.perDoseOverrides,
            previousPhase.doseValue ?? "",
            previousPhase.doseUnit ?? "",
          ),
      manualTimes:
        previousPhase.manualAdjustmentEnabled && previousPhase.frequency > 0
          ? Array.from({ length: previousPhase.frequency }, () => "")
          : [],
    });
  }

  return (
    <article className="rounded-md border bg-white p-4">
	      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
	        <div>
	          <h3 className="font-bold">Medicamento {index + 1}</h3>
	          <p className="text-sm text-muted-foreground">
	            {selectedMedication
	              ? `${selectedMedication.commercialName ?? selectedMedication.activePrinciple} · ${selectedProtocol?.name ?? "protocolo pendente"}`
	              : `${phaseFields.fields.length} fase(s) de tratamento`}
	          </p>
	        </div>
	        <Button disabled={!canRemove} onClick={onRemove} size="sm" type="button" variant="secondary">
          <Trash2 className="size-4" />
          Remover
	        </Button>
	      </div>

	      <div className="mb-4 grid gap-2 rounded-md border bg-muted/30 p-3">
	        <div className="flex flex-wrap gap-2">
	          <Badge variant={selectedMedication ? "primary" : "default"}>
	            {selectedMedication ? "Medicamento selecionado" : "Medicamento pendente"}
	          </Badge>
	          <Badge variant={selectedProtocol ? "success" : "warning"}>
	            {selectedProtocol ? selectedProtocol.group?.code ?? selectedProtocol.code : "Protocolo pendente"}
	          </Badge>
	          <Badge>{phaseFields.fields.length} fase(s)</Badge>
	        </div>
	        <div className="grid gap-2">
	          {values.phases.map((phase, phaseIndex) => (
	            <div className="flex flex-wrap gap-2 text-xs" key={`medication-${index}-phase-summary-${phaseIndex}`}>
	              <strong className="mr-1 py-1">Fase {phaseIndex + 1}</strong>
	              {buildPhaseSummaryBadges(phase, selectedMedication, resolveFrequencyConfig(selectedProtocol, phase.frequency)).map((label) => (
	                <Badge key={label}>{label}</Badge>
	              ))}
	            </div>
	          ))}
	        </div>
	      </div>

	      <div className="grid gap-4 lg:grid-cols-2">
        <Field error={errors?.clinicalMedicationId?.message} label="Medicamento">
          <select
            className={inputClassName}
            onChange={(event) => onMedicationChange(index, event.target.value)}
            value={values.clinicalMedicationId}
          >
            <option value="">Selecione</option>
            {catalog.map((medication) => (
              <option key={medication.id} value={medication.id}>
                {medication.commercialName ?? medication.activePrinciple}
              </option>
            ))}
          </select>
        </Field>
        <Field error={errors?.protocolId?.message} label="Protocolo">
          <select
            className={inputClassName}
            disabled={!selectedMedication}
            onChange={(event) => onProtocolChange(index, event.target.value)}
            value={values.protocolId}
          >
            <option value="">Selecione</option>
            {selectedMedication?.protocols.map((protocol) => (
              <option key={protocol.id} value={protocol.id}>
                {protocol.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4 grid gap-3">
        {phaseFields.fields.map((field, phaseIndex) => (
	            <PrescriptionPhaseCard
	              canRemove={phaseFields.fields.length > 1}
	              form={form}
	              isLastPhase={phaseIndex === phaseFields.fields.length - 1}
            key={field.id}
            medicationIndex={index}
            onFrequencyChange={onFrequencyChange}
            onManualEnabledChange={onManualEnabledChange}
            onRecurrenceChange={onRecurrenceChange}
            onSameDoseChange={onSameDoseChange}
	              onRemove={() => phaseFields.remove(phaseIndex)}
	              phase={values.phases[phaseIndex] ?? emptyPrescriptionPhaseForm()}
	              phaseIndex={phaseIndex}
	              selectedMedication={selectedMedication}
	              protocol={selectedProtocol}
	            />
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <Button disabled={!selectedProtocol} onClick={appendPhase} size="sm" type="button" variant="secondary">
          <Plus className="size-4" />
          Adicionar fase
        </Button>
      </div>
    </article>
  );
}

function PrescriptionPhaseCard({
  canRemove,
  form,
  isLastPhase,
  medicationIndex,
  onFrequencyChange,
  onManualEnabledChange,
  onRecurrenceChange,
  onSameDoseChange,
	  onRemove,
	  phase,
	  phaseIndex,
	  selectedMedication,
	  protocol,
	}: {
  canRemove: boolean;
  form: UseFormReturn<PrescriptionFormValues>;
  isLastPhase: boolean;
  medicationIndex: number;
  onFrequencyChange: (medicationIndex: number, phaseIndex: number, frequency: number) => void;
  onManualEnabledChange: (medicationIndex: number, phaseIndex: number, enabled: boolean) => void;
  onRecurrenceChange: (medicationIndex: number, phaseIndex: number, recurrenceType: TreatmentRecurrence) => void;
  onSameDoseChange: (medicationIndex: number, phaseIndex: number, sameDosePerSchedule: boolean) => void;
	  onRemove: () => void;
	  phase: PrescriptionPhaseFormValues;
	  phaseIndex: number;
	  selectedMedication: ClinicalMedication | null;
	  protocol: ClinicalProtocol | null;
	}) {
  const selectedFrequency = Number(phase.frequency) || 0;
  const selectedFrequencyConfig = resolveFrequencyConfig(protocol, selectedFrequency);
  const allowedRecurrenceOptions = getAllowedRecurrenceOptions(selectedFrequencyConfig);
  const variableDoseAllowed = selectedFrequencyConfig?.allowsVariableDoseBySchedule === true;
  const manualTimesAreComplete = isPrescriptionPhaseManualTimesComplete(phase);
  const perDoseOverridesAreComplete = isPrescriptionPhasePerDoseOverridesComplete(phase, selectedFrequencyConfig);
	  const errors = form.formState.errors.medications?.[medicationIndex]?.phases?.[phaseIndex];
	  const phaseName = `medications.${medicationIndex}.phases.${phaseIndex}` as const;
	  const hasProtocolFrequencies = (protocol?.frequencies.length ?? 0) > 0;
	  const glycemiaRanges = phase.glycemiaScaleRanges ?? [];
	  const hasClinicalFields =
	    Boolean(selectedMedication?.isOphthalmic) ||
	    Boolean(selectedMedication?.isOtic) ||
	    Boolean(selectedMedication?.requiresGlycemiaScale) ||
	    Boolean(selectedMedication?.isContraceptiveMonthly);

	  function addGlycemiaRange() {
	    const previous = glycemiaRanges.at(-1);
	    form.setValue(
	      `${phaseName}.glycemiaScaleRanges`,
	      [
	        ...glycemiaRanges,
	        {
	          ...emptyGlycemiaScaleRange((phase.doseUnit as DoseUnit | "") || selectedMedication?.defaultAdministrationUnit || "UI"),
	          minimum: previous?.maximum !== undefined ? previous.maximum + 1 : (undefined as unknown as number),
	        },
	      ],
	      { shouldValidate: true },
	    );
	  }

	  function removeGlycemiaRange(rangeIndex: number) {
	    form.setValue(
	      `${phaseName}.glycemiaScaleRanges`,
	      glycemiaRanges.filter((_, index) => index !== rangeIndex),
	      { shouldValidate: true },
	    );
	  }

	  return (
    <section className="rounded-md border bg-muted/20 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-bold">Fase {phaseIndex + 1}</h4>
          <p className="text-sm text-muted-foreground">
            {isLastPhase ? "Pode ser contínua" : "Fase intermediária exige dias de tratamento"}
          </p>
        </div>
        <Button disabled={!canRemove} onClick={onRemove} size="sm" type="button" variant="secondary">
          <Trash2 className="size-4" />
          Remover fase
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Field error={errors?.frequency?.message} label="Frequência">
          <select
            className={inputClassName}
            disabled={!protocol || !hasProtocolFrequencies}
            onChange={(event) => onFrequencyChange(medicationIndex, phaseIndex, Number(event.target.value))}
            value={selectedFrequency}
          >
            <option value={0}>Selecione</option>
            {protocol?.frequencies.map((frequency) => (
              <option key={frequency.frequency} value={frequency.frequency}>
                {frequency.label ?? `${frequency.frequency}x ao dia`}
              </option>
            ))}
          </select>
        </Field>
        {phase.sameDosePerSchedule ? (
          <>
            <Field error={errors?.doseValue?.message} label="Dose">
              <input className={inputClassName} {...form.register(`${phaseName}.doseValue`)} />
            </Field>
            <Field error={errors?.doseUnit?.message} label="Unidade">
              <select className={inputClassName} {...form.register(`${phaseName}.doseUnit`)}>
                <option value="">Selecione</option>
                {doseUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : null}
        <Field error={errors?.recurrenceType?.message} label="Recorrência">
          <select
            className={inputClassName}
            disabled={!selectedFrequencyConfig || allowedRecurrenceOptions.length === 0}
            onChange={(event) =>
              onRecurrenceChange(medicationIndex, phaseIndex, event.target.value as TreatmentRecurrence)
            }
            value={phase.recurrenceType}
          >
            {allowedRecurrenceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Dias de tratamento">
          <input
            className={inputClassName}
            disabled={phase.continuousUse}
            min={1}
            type="number"
            {...form.register(`${phaseName}.treatmentDays`, { valueAsNumber: true })}
          />
        </Field>
      </div>

	      {phase.recurrenceType !== "DAILY" ? (
	        <div className="mt-4 grid gap-4 rounded-md border bg-white p-4 lg:grid-cols-3">
          {phase.recurrenceType === "WEEKLY" ? (
            <Field error={errors?.weeklyDay?.message} label="Dia da semana">
              <select className={inputClassName} {...form.register(`${phaseName}.weeklyDay`)}>
                <option value="">Selecione</option>
                {weeklyDayOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

	          {phase.recurrenceType === "MONTHLY" && !selectedMedication?.isContraceptiveMonthly ? (
	            <Field error={errors?.monthlyDay?.message} label="Dia do mês">
	              <input
                className={inputClassName}
                max={31}
                min={1}
                type="number"
                {...form.register(`${phaseName}.monthlyDay`, { valueAsNumber: true })}
              />
            </Field>
          ) : null}

          {phase.recurrenceType === "ALTERNATE_DAYS" ? (
            <Field error={errors?.alternateDaysInterval?.message} label="Intervalo em dias">
              <input
                className={inputClassName}
                min={2}
                type="number"
                {...form.register(`${phaseName}.alternateDaysInterval`, { valueAsNumber: true })}
              />
            </Field>
          ) : null}

          {phase.recurrenceType === "PRN" ? (
            <Field error={errors?.prnReason?.message} label="Motivo">
              <select className={inputClassName} {...form.register(`${phaseName}.prnReason`)}>
                <option value="">Selecione</option>
                {prnReasonOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
	        </div>
	      ) : null}

	      {hasClinicalFields ? (
	        <div className="mt-4 grid gap-4 rounded-md border border-accent/30 bg-accent/5 p-4">
	          <div className="flex flex-wrap items-center justify-between gap-3">
	            <div>
	              <h3 className="font-bold text-accent">Campos clínicos especiais</h3>
	              <p className="text-sm text-muted-foreground">
	                Estes campos acompanham as regras do medicamento selecionado.
	              </p>
	            </div>
	            <Badge variant="warning">Sprint 6</Badge>
	          </div>

	          <div className="grid gap-4 lg:grid-cols-3">
	            {selectedMedication?.isOphthalmic ? (
	              <Field error={errors?.ocularLaterality?.message} label="Lateralidade ocular">
	                <select className={inputClassName} {...form.register(`${phaseName}.ocularLaterality`)}>
	                  <option value="">Selecione</option>
	                  {ocularLateralityOptions.map((option) => (
	                    <option key={option.value} value={option.value}>
	                      {option.label}
	                    </option>
	                  ))}
	                </select>
	              </Field>
	            ) : null}

	            {selectedMedication?.isOtic ? (
	              <Field error={errors?.oticLaterality?.message} label="Lateralidade otológica">
	                <select className={inputClassName} {...form.register(`${phaseName}.oticLaterality`)}>
	                  <option value="">Selecione</option>
	                  {oticLateralityOptions.map((option) => (
	                    <option key={option.value} value={option.value}>
	                      {option.label}
	                    </option>
	                  ))}
	                </select>
	              </Field>
	            ) : null}

	            {selectedMedication?.isContraceptiveMonthly ? (
	              <>
	                <input
	                  type="hidden"
	                  value="MENSTRUATION_START"
	                  {...form.register(`${phaseName}.monthlySpecialReference`)}
	                />
	                <Field error={errors?.monthlySpecialBaseDate?.message} label="Data da menstruação">
	                  <input className={inputClassName} type="date" {...form.register(`${phaseName}.monthlySpecialBaseDate`)} />
	                </Field>
	                <Field error={errors?.monthlySpecialOffsetDays?.message} label="Aplicar após quantos dias">
	                  <input
	                    className={inputClassName}
	                    min={1}
	                    type="number"
	                    {...form.register(`${phaseName}.monthlySpecialOffsetDays`, { valueAsNumber: true })}
	                  />
	                </Field>
	              </>
	            ) : null}
	          </div>

	          {selectedMedication?.requiresGlycemiaScale ? (
	            <div className="grid gap-3">
	              <div className="flex flex-wrap items-center justify-between gap-3">
	                <strong className="text-sm">Escala glicêmica</strong>
	                <Button onClick={addGlycemiaRange} size="sm" type="button" variant="secondary">
	                  <Plus className="size-4" />
	                  Adicionar faixa
	                </Button>
	              </div>

	              {glycemiaRanges.length ? (
	                <div className="grid gap-3">
	                  {glycemiaRanges.map((_, rangeIndex) => (
	                    <div
	                      className="grid gap-3 rounded-md border bg-white p-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
	                      key={`glycemia-${medicationIndex}-${phaseIndex}-${rangeIndex}`}
	                    >
	                      <Field error={errors?.glycemiaScaleRanges?.[rangeIndex]?.minimum?.message} label="Mínimo">
	                        <input
	                          className={inputClassName}
	                          min={0}
	                          type="number"
	                          {...form.register(`${phaseName}.glycemiaScaleRanges.${rangeIndex}.minimum`, {
	                            valueAsNumber: true,
	                          })}
	                        />
	                      </Field>
	                      <Field error={errors?.glycemiaScaleRanges?.[rangeIndex]?.maximum?.message} label="Máximo">
	                        <input
	                          className={inputClassName}
	                          min={0}
	                          type="number"
	                          {...form.register(`${phaseName}.glycemiaScaleRanges.${rangeIndex}.maximum`, {
	                            valueAsNumber: true,
	                          })}
	                        />
	                      </Field>
	                      <Field error={errors?.glycemiaScaleRanges?.[rangeIndex]?.doseValue?.message} label="Dose">
	                        <input className={inputClassName} {...form.register(`${phaseName}.glycemiaScaleRanges.${rangeIndex}.doseValue`)} />
	                      </Field>
	                      <Field error={errors?.glycemiaScaleRanges?.[rangeIndex]?.doseUnit?.message} label="Unidade">
	                        <select className={inputClassName} {...form.register(`${phaseName}.glycemiaScaleRanges.${rangeIndex}.doseUnit`)}>
	                          <option value="">Selecione</option>
	                          {doseUnits.map((unit) => (
	                            <option key={unit} value={unit}>
	                              {unit}
	                            </option>
	                          ))}
	                        </select>
	                      </Field>
	                      <div className="flex items-end">
	                        <Button
	                          aria-label="Remover faixa glicêmica"
	                          disabled={glycemiaRanges.length === 1}
	                          onClick={() => removeGlycemiaRange(rangeIndex)}
	                          size="icon"
	                          type="button"
	                          variant="secondary"
	                        >
	                          <Trash2 className="size-4" />
	                        </Button>
	                      </div>
	                    </div>
	                  ))}
	                </div>
	              ) : (
	                <p className="text-sm font-semibold text-warning">
	                  Informe ao menos uma faixa glicêmica completa.
	                </p>
	              )}
	              {typeof errors?.glycemiaScaleRanges?.message === "string" ? (
	                <p className="text-sm font-semibold text-warning">{errors.glycemiaScaleRanges.message}</p>
	              ) : null}
	            </div>
	          ) : null}
	        </div>
	      ) : null}

	      {!protocol ? (
        <p className="mt-3 text-sm font-semibold text-warning">
          Selecione um protocolo para escolher frequências e recorrências.
        </p>
      ) : null}
      {protocol && !hasProtocolFrequencies ? (
        <p className="mt-3 text-sm font-semibold text-warning">
          Este protocolo não possui frequências cadastradas.
        </p>
      ) : null}
      {protocol && hasProtocolFrequencies && selectedFrequency > 0 && allowedRecurrenceOptions.length === 0 ? (
        <p className="mt-3 text-sm font-semibold text-warning">
          Esta frequência não possui recorrências permitidas.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 rounded-md border bg-white p-4 lg:grid-cols-3">
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input
            checked={phase.sameDosePerSchedule}
            className="size-4"
            disabled={selectedFrequency <= 0 || !variableDoseAllowed}
            onChange={(event) => onSameDoseChange(medicationIndex, phaseIndex, event.target.checked)}
            type="checkbox"
          />
          Dose igual em todos os horários
        </label>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input
            checked={phase.continuousUse}
            className="size-4"
            disabled={!isLastPhase}
            onChange={(event) => {
              form.setValue(`${phaseName}.continuousUse`, event.target.checked, { shouldValidate: true });
              if (event.target.checked) {
                form.setValue(`${phaseName}.treatmentDays`, undefined, { shouldValidate: true });
              }
            }}
            type="checkbox"
          />
          Uso contínuo
        </label>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input
            checked={phase.manualAdjustmentEnabled}
            className="size-4"
            onChange={(event) => onManualEnabledChange(medicationIndex, phaseIndex, event.target.checked)}
            type="checkbox"
          />
          Farmacêutico definirá horários manualmente
        </label>
      </div>

      {selectedFrequency > 0 && !variableDoseAllowed ? (
        <p className="mt-3 text-sm font-semibold text-muted-foreground">
          Este protocolo não aceita dose variável para a frequência selecionada.
        </p>
      ) : null}

      {!isLastPhase && phase.continuousUse ? (
        <p className="mt-3 text-sm font-semibold text-warning">
          Uso contínuo só pode ficar ativo na última fase.
        </p>
      ) : null}

      {!phase.sameDosePerSchedule ? (
        <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
          <h3 className="mb-1 font-bold text-primary">Dose por horário da fase</h3>
          <p className="mb-4 text-sm text-primary">
            Informe dose e unidade para todos os horários da fase.
          </p>
          {selectedFrequency > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: selectedFrequency }, (_, overrideIndex) => (
                <div
                  className="grid gap-3 rounded-md border bg-white p-3"
                  key={`medication-${medicationIndex}-phase-${phaseIndex}-dose-override-${overrideIndex}`}
                >
                  <strong className="text-sm">D{overrideIndex + 1}</strong>
                  <input
                    type="hidden"
                    value={`D${overrideIndex + 1}`}
                    {...form.register(`${phaseName}.perDoseOverrides.${overrideIndex}.doseLabel`)}
                  />
                  <Field label="Dose">
                    <input
                      className={inputClassName}
                      {...form.register(`${phaseName}.perDoseOverrides.${overrideIndex}.doseValue`)}
                    />
                  </Field>
                  <Field label="Unidade">
                    <select
                      className={inputClassName}
                      {...form.register(`${phaseName}.perDoseOverrides.${overrideIndex}.doseUnit`)}
                    >
                      <option value="">Selecione</option>
                      {doseUnits.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold text-primary">
              Selecione uma frequência para informar doses por horário.
            </p>
          )}
          {!perDoseOverridesAreComplete ? (
            <p className="mt-3 text-sm font-semibold text-warning">
              Todas as doses por horário devem estar preenchidas e corresponder à frequência da fase.
            </p>
          ) : null}
        </div>
      ) : null}

      {phase.manualAdjustmentEnabled ? (
        <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-4">
          <h3 className="mb-1 font-bold text-warning">Ajuste manual da fase</h3>
          <p className="mb-4 text-sm text-warning">
            O ajuste manual vale para a fase inteira; informe todos os horários da fase.
          </p>
          {selectedFrequency > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: selectedFrequency }, (_, manualIndex) => (
                <Field
                  error={errors?.manualTimes?.[manualIndex]?.message}
                  key={`medication-${medicationIndex}-phase-${phaseIndex}-manual-time-${manualIndex}`}
                  label={`D${manualIndex + 1}`}
                >
                  <input
                    className={inputClassName}
                    type="time"
                    {...form.register(`${phaseName}.manualTimes.${manualIndex}`)}
                  />
                </Field>
              ))}
            </div>
          ) : (
            <p className="text-sm font-semibold text-warning">
              Selecione uma frequência para informar os horários manuais.
            </p>
          )}
          {!manualTimesAreComplete ? (
            <p className="mt-3 text-sm font-semibold text-warning">
              Todos os horários manuais devem estar preenchidos em HH:mm.
            </p>
          ) : null}
        </div>
      ) : null}

      {protocol ? <PrescriptionPreview frequency={selectedFrequency} protocol={protocol} /> : null}
    </section>
  );
}

function PrescriptionPreview({
  protocol,
  frequency,
}: {
  protocol: ClinicalProtocol;
  frequency: number;
}) {
  const config = protocol.frequencies.find((item) => item.frequency === Number(frequency));
  return (
    <div className="rounded-md border bg-muted/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Prévia da fase</h3>
          <p className="text-sm text-muted-foreground">{protocol.name}</p>
        </div>
        <Badge variant="primary">{protocol.group?.code ?? protocol.code}</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {(config?.steps ?? []).map((step) => (
          <Badge key={step.doseLabel}>
            {step.doseLabel}: {step.anchor} {step.offsetMinutes >= 0 ? "+" : "-"} {Math.abs(step.offsetMinutes)}min
          </Badge>
        ))}
      </div>
    </div>
  );
}

function buildPhaseSummaryBadges(
  phase: PrescriptionPhaseFormValues,
  medication: ClinicalMedication | null,
  frequencyConfig: ClinicalProtocolFrequency | null,
) {
  return [
    phase.frequency > 0 ? frequencyConfig?.label ?? `${phase.frequency}x ao dia` : "Frequência pendente",
    formatDoseSummary(phase),
    formatRecurrenceSummary(phase, medication),
    formatDurationSummary(phase),
    phase.manualAdjustmentEnabled ? `Manual: ${phase.manualTimes?.filter(Boolean).length ?? 0}/${phase.frequency}` : "Horário automático",
    ...formatClinicalSummary(phase, medication),
  ];
}

function formatDoseSummary(phase: PrescriptionPhaseFormValues) {
  if (phase.sameDosePerSchedule) {
    return phase.doseValue && phase.doseUnit ? `${phase.doseValue} ${toDoseUnitLabel(phase.doseUnit)}` : "Dose pendente";
  }
  return `Dose variável: ${phase.perDoseOverrides?.filter((dose) => dose.doseValue && dose.doseUnit).length ?? 0}/${phase.frequency}`;
}

function formatRecurrenceSummary(phase: PrescriptionPhaseFormValues, medication: ClinicalMedication | null) {
  if (phase.recurrenceType === "WEEKLY") return `Semanal${phase.weeklyDay ? `: ${phase.weeklyDay}` : ""}`;
  if (phase.recurrenceType === "MONTHLY") {
    if (medication?.isContraceptiveMonthly) {
      return phase.monthlySpecialBaseDate && phase.monthlySpecialOffsetDays
        ? `Mensal especial: +${phase.monthlySpecialOffsetDays} dias`
        : "Mensal especial pendente";
    }
    return phase.monthlyDay ? `Mensal: dia ${phase.monthlyDay}` : "Mensal pendente";
  }
  if (phase.recurrenceType === "ALTERNATE_DAYS") return `A cada ${phase.alternateDaysInterval ?? "?"} dias`;
  if (phase.recurrenceType === "PRN") return `Se necessário${phase.prnReason ? `: ${phase.prnReason}` : ""}`;
  return "Diário";
}

function formatDurationSummary(phase: PrescriptionPhaseFormValues) {
  if (phase.continuousUse) return "Uso contínuo";
  if (phase.recurrenceType === "PRN") return "Sem duração obrigatória";
  return phase.treatmentDays ? `${phase.treatmentDays} dia(s)` : "Duração pendente";
}

function formatClinicalSummary(phase: PrescriptionPhaseFormValues, medication: ClinicalMedication | null) {
  const labels: string[] = [];
  if (medication?.isOphthalmic) {
    labels.push(`Ocular: ${ocularLateralityOptions.find((option) => option.value === phase.ocularLaterality)?.label ?? "pendente"}`);
  }
  if (medication?.isOtic) {
    labels.push(`Otológico: ${oticLateralityOptions.find((option) => option.value === phase.oticLaterality)?.label ?? "pendente"}`);
  }
  if (medication?.requiresGlycemiaScale) {
    labels.push(`Escala glicêmica: ${phase.glycemiaScaleRanges?.length ?? 0} faixa(s)`);
  }
  if (medication?.isContraceptiveMonthly) {
    labels.push("Referência: início da menstruação");
  }
  return labels;
}

function PrescriptionReviewPanel({
  activeRoutine,
  catalog,
  isPending,
  onBack,
  onConfirm,
  patient,
  values,
}: {
  activeRoutine: PatientRoutine | null;
  catalog: ClinicalMedication[];
  isPending: boolean;
  onBack: () => void;
  onConfirm: () => void;
  patient: Patient | null;
  values: PrescriptionFormValues;
}) {
  return (
    <Panel className="max-w-6xl">
      <PanelHeader eyebrow="Revisão final" title={patient?.fullName ?? "Paciente pendente"} />

      <div className="grid gap-4">
        <div className="grid gap-3 rounded-md border bg-muted/30 p-4 text-sm md:grid-cols-3">
          <DetailBlock label="Paciente" value={patient?.fullName ?? "Pendente"} hint={formatCpf(patient?.cpf) ?? patient?.phone ?? "Sem contato"} />
          <DetailBlock label="Início" value={values.startedAt || "Pendente"} />
          <DetailBlock label="Rotina" value={activeRoutine ? "Rotina ativa selecionada" : "Pendente"} />
          {activeRoutine
            ? routineFields.map((field) => (
                <span className="text-muted-foreground" key={field.name}>
                  {field.label}: <strong className="text-foreground">{activeRoutine[field.name] ?? "--:--"}</strong>
                </span>
              ))
            : null}
        </div>

        {values.medications.map((medicationValue, medicationIndex) => {
          const medication = resolveMedication(catalog, medicationValue.clinicalMedicationId);
          const protocol = resolveProtocol(medication, medicationValue.protocolId);
          return (
            <article className="rounded-md border bg-white p-4" key={`review-medication-${medicationIndex}`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">
                    {medication?.commercialName ?? medication?.activePrinciple ?? `Medicamento ${medicationIndex + 1}`}
                  </h3>
                  <p className="text-sm text-muted-foreground">{protocol?.name ?? "Protocolo pendente"}</p>
                </div>
                <Badge variant={isPrescriptionMedicationComplete(medicationValue, protocol, medication) ? "success" : "warning"}>
                  {medicationValue.phases.length} fase(s)
                </Badge>
              </div>
              <div className="grid gap-3">
                {medicationValue.phases.map((phase, phaseIndex) => (
                  <div className="rounded-md border bg-muted/20 p-3" key={`review-medication-${medicationIndex}-phase-${phaseIndex}`}>
                    <strong className="mb-2 block">Fase {phaseIndex + 1}</strong>
                    <div className="flex flex-wrap gap-2">
                      {buildPhaseSummaryBadges(phase, medication, resolveFrequencyConfig(protocol, phase.frequency)).map((label) => (
                        <Badge key={label}>{label}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}

        <div className="flex justify-between gap-3">
          <Button onClick={onBack} type="button" variant="secondary">
            Voltar
          </Button>
          <Button disabled={!patient || !activeRoutine || isPending} onClick={onConfirm} type="button">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
            Confirmar e gerar calendário
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function DocumentHeader({ schedule }: { schedule: CalendarScheduleResponseDto }) {
  return (
    <div className="mb-4 grid gap-3 rounded-md border bg-muted/30 p-4 text-sm lg:grid-cols-3">
      <div>
        <strong className="block">{schedule.documentHeader.nomeEmpresa}</strong>
        <span className="text-muted-foreground">{schedule.documentHeader.cnpj}</span>
      </div>
      <div>
        <strong className="block">{schedule.patient.nome}</strong>
        <span className="text-muted-foreground">
          {schedule.patient.idade ? `${schedule.patient.idade} anos` : "Idade não informada"} · {schedule.patient.telefone ?? "Sem telefone"}
        </span>
      </div>
      <div>
        <strong className="block">{schedule.documentHeader.farmaceuticoNome}</strong>
        <span className="text-muted-foreground">{schedule.documentHeader.farmaceuticoCrf}</span>
      </div>
    </div>
  );
}

function DoseBoard({
  doses,
  selectedDoseKey,
  onSelect,
  onAdjust,
}: {
  doses: SelectedDose[];
  selectedDoseKey: string | null;
  onSelect: (dose: SelectedDose) => void;
  onAdjust: (dose: SelectedDose) => void;
}) {
  return (
    <div className="grid gap-2">
      {doses.map((entry) => (
        <article
          className={`grid cursor-pointer grid-cols-1 gap-3 rounded-md border border-l-4 p-3 transition-colors md:grid-cols-[82px_minmax(0,1fr)_120px] md:items-center ${doseBorderClass(entry.dose)} ${
            selectedDoseKey === entry.key ? "ring-2 ring-primary/30" : ""
          }`}
          key={entry.key}
          onClick={() => onSelect(entry)}
        >
          <strong className="text-lg">{entry.dose.horario}</strong>
          <div>
            <div className="font-bold">{entry.item.medicamento} · {entry.dose.label}</div>
            <div className="text-sm text-muted-foreground">
              {entry.dose.doseExibicao} · {entry.item.recorrenciaTexto} · {entry.dose.statusLabel}
            </div>
          </div>
          <div className="flex justify-start md:justify-end">
            <Button
              onClick={(event) => {
                event.stopPropagation();
                onAdjust(entry);
              }}
              size="sm"
              type="button"
              variant="secondary"
            >
              Ajustar
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function DoseDetails({ selectedDose }: { selectedDose: SelectedDose }) {
  const { item, dose } = selectedDose;
  return (
    <div className="grid gap-4">
      <DetailBlock label="Medicamento" value={item.medicamento} hint={`${item.principioAtivo} · ${item.via}`} />
      <DetailBlock
        label="Horário"
        value={dose.horario}
        hint={`Original: ${dose.contextoHorario.horario_original} · Âncora: ${dose.contextoHorario.ancora ?? "manual"}`}
      />
      <DetailBlock
        label="Dose"
        value={dose.doseExibicao}
        hint={`${dose.doseValor ?? ""} ${toDoseUnitLabel(dose.doseUnidade)}`.trim()}
      />
      <DetailBlock label="Status" value={<Badge variant={statusVariant(dose.status)}>{dose.statusLabel}</Badge>} hint={dose.reasonText ?? dose.observacao ?? "Sem observações."} />
      {dose.conflito ? (
        <DetailBlock
          label="Conflito"
          value={dose.conflito.tipo_interacao_label ?? dose.conflito.tipo_interacao_codigo ?? "Conflito clínico"}
          hint={`Disparador: ${dose.conflito.medicamento_disparador_nome ?? "não informado"} · Resolução: ${dose.conflito.tipo_resolucao_label ?? "não informada"}`}
        />
      ) : null}
      <DetailBlock label="Modo de uso" value={item.modoUso} hint={item.observacoes.join(" ") || "Sem observações adicionais."} />
    </div>
  );
}

function DetailBlock({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="border-b pb-3 last:border-b-0 last:pb-0">
      <span className="mb-1 block text-xs font-bold uppercase text-muted-foreground">{label}</span>
      <div className="font-bold">{value}</div>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function titleForStep(step: StepId) {
  switch (step) {
    case "routine":
      return "Rotina do paciente";
	    case "prescription":
	      return "Prescrição farmacêutica";
	    case "review":
	      return "Resumo da prescrição";
	    case "calendar":
	      return "Calendário posológico";
    case "patient":
    default:
      return "Cadastro do paciente";
  }
}

function compareDoseLabels(left: string, right: string) {
  const leftIndex = Number(left.replace(/\D+/g, ""));
  const rightIndex = Number(right.replace(/\D+/g, ""));
  return leftIndex - rightIndex || left.localeCompare(right);
}

function normalizeCpf(cpf: string | null | undefined) {
  const digits = cpf?.replace(/\D/g, "") ?? "";
  return digits.length > 0 ? digits : undefined;
}

function formatCpf(cpf: string | null | undefined) {
  const digits = normalizeCpf(cpf);
  if (!digits) return undefined;
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function resolveActiveRoutine(patient: Patient | null): PatientRoutine | null {
  const routines = patient?.routines?.filter((routine) => routine.active) ?? [];
  if (routines.length === 0) return null;

  return [...routines].sort((left, right) => {
    const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime || right.id.localeCompare(left.id);
  })[0];
}

function resolveMedication(catalog: ClinicalMedication[], medicationId: string) {
  return catalog.find((medication) => medication.id === medicationId) ?? null;
}

function resolveProtocol(medication: ClinicalMedication | null, protocolId: string) {
  return medication?.protocols.find((protocol) => protocol.id === protocolId) ?? null;
}

function resolveFrequencyConfig(protocol: ClinicalProtocol | null, frequency: number) {
  if (!protocol || frequency <= 0) return null;
  return protocol.frequencies.find((item) => item.frequency === frequency) ?? null;
}

function getAllowedRecurrenceOptions(frequencyConfig: ClinicalProtocolFrequency | null) {
  if (!frequencyConfig) return [];

  const allowedRecurrences = frequencyConfig.allowedRecurrenceTypes?.length
    ? frequencyConfig.allowedRecurrenceTypes
    : (["DAILY"] satisfies TreatmentRecurrence[]);

  return recurrenceOptions.filter((option) => {
    if (!allowedRecurrences.includes(option.value)) return false;
    if (option.value === "PRN" && frequencyConfig.allowsPrn !== true) return false;
    return true;
  });
}

function isRecurrenceAllowed(recurrenceType: TreatmentRecurrence, frequencyConfig: ClinicalProtocolFrequency | null) {
  return getAllowedRecurrenceOptions(frequencyConfig).some((option) => option.value === recurrenceType);
}

function getDefaultRecurrenceForFrequency(frequencyConfig: ClinicalProtocolFrequency | null): TreatmentRecurrence {
  return getAllowedRecurrenceOptions(frequencyConfig)[0]?.value ?? "DAILY";
}

function isPrescriptionPhaseManualTimesComplete(phase: PrescriptionPhaseFormValues) {
  if (!phase.manualAdjustmentEnabled) return true;
  return (
    phase.frequency > 0 &&
    (phase.manualTimes ?? []).length === phase.frequency &&
    (phase.manualTimes ?? []).every((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time))
  );
}

function isPrescriptionPhasePerDoseOverridesComplete(
  phase: PrescriptionPhaseFormValues,
  frequencyConfig: ClinicalProtocolFrequency | null,
) {
  if (phase.sameDosePerSchedule) {
    return Boolean(phase.doseValue?.trim()) && Boolean(phase.doseUnit);
  }

  return (
    frequencyConfig?.allowsVariableDoseBySchedule === true &&
    phase.frequency > 0 &&
    (phase.perDoseOverrides ?? []).length === phase.frequency &&
    (phase.perDoseOverrides ?? []).every(
      (override, index) =>
        override.doseLabel === `D${index + 1}` &&
        override.doseValue.trim().length > 0 &&
        override.doseUnit.length > 0,
    )
  );
}

function isPrescriptionPhaseRecurrenceFieldsComplete(
  phase: PrescriptionPhaseFormValues,
  medication: ClinicalMedication | null,
) {
  switch (phase.recurrenceType) {
    case "WEEKLY":
      return Boolean(phase.weeklyDay);
    case "MONTHLY":
      if (medication?.isContraceptiveMonthly) {
        return (
          phase.monthlySpecialReference === "MENSTRUATION_START" ||
          (Boolean(phase.monthlySpecialBaseDate) &&
            typeof phase.monthlySpecialOffsetDays === "number" &&
            phase.monthlySpecialOffsetDays > 0)
        );
      }
      return (
        typeof phase.monthlyDay === "number" &&
        Number.isFinite(phase.monthlyDay) &&
        phase.monthlyDay >= 1 &&
        phase.monthlyDay <= 31
      );
    case "ALTERNATE_DAYS":
      return (
        typeof phase.alternateDaysInterval === "number" &&
        Number.isFinite(phase.alternateDaysInterval) &&
        phase.alternateDaysInterval >= 2
      );
    case "PRN":
      return Boolean(phase.prnReason);
    case "DAILY":
    default:
      return true;
  }
}

function areGlycemiaRangesComplete(phase: PrescriptionPhaseFormValues) {
  const ranges = [...(phase.glycemiaScaleRanges ?? [])].sort((left, right) => left.minimum - right.minimum);
  if (ranges.length === 0) return false;
  return ranges.every((range, index) => {
    if (
      !Number.isFinite(range.minimum) ||
      !Number.isFinite(range.maximum) ||
      range.minimum < 0 ||
      range.maximum < range.minimum ||
      !range.doseValue?.trim() ||
      !range.doseUnit
    ) {
      return false;
    }

    const previous = ranges[index - 1];
    if (!previous) return true;
    return range.minimum === previous.maximum + 1;
  });
}

function isPrescriptionPhaseClinicalFieldsComplete(
  phase: PrescriptionPhaseFormValues,
  medication: ClinicalMedication | null,
) {
  if (!medication) return false;
  if (medication.isOphthalmic && (!phase.ocularLaterality || phase.oticLaterality)) return false;
  if (medication.isOtic && (!phase.oticLaterality || phase.ocularLaterality)) return false;
  if (!medication.isOphthalmic && !medication.isOtic && (phase.ocularLaterality || phase.oticLaterality)) return false;
  if (medication.requiresGlycemiaScale && !areGlycemiaRangesComplete(phase)) return false;
  if (!medication.requiresGlycemiaScale && (phase.glycemiaScaleRanges ?? []).length > 0) return false;
  if (medication.isContraceptiveMonthly) {
    return (
      phase.recurrenceType === "MONTHLY" &&
      phase.monthlyDay === undefined &&
      Boolean(phase.monthlySpecialBaseDate) &&
      typeof phase.monthlySpecialOffsetDays === "number" &&
      phase.monthlySpecialOffsetDays > 0
    );
  }
  return !phase.monthlySpecialReference && !phase.monthlySpecialBaseDate && phase.monthlySpecialOffsetDays === undefined;
}

function isPrescriptionPhaseComplete(
  phase: PrescriptionPhaseFormValues,
  isLastPhase: boolean,
  frequencyConfig: ClinicalProtocolFrequency | null,
  medication: ClinicalMedication | null,
) {
  const hasRequiredTreatmentDays =
    phase.continuousUse ||
    phase.recurrenceType === "PRN" ||
    (typeof phase.treatmentDays === "number" && Number.isFinite(phase.treatmentDays) && phase.treatmentDays >= 1);

  return (
    phase.frequency > 0 &&
    Boolean(frequencyConfig) &&
    isRecurrenceAllowed(phase.recurrenceType, frequencyConfig) &&
    isPrescriptionPhasePerDoseOverridesComplete(phase, frequencyConfig) &&
    (!phase.continuousUse || isLastPhase) &&
    hasRequiredTreatmentDays &&
    isPrescriptionPhaseRecurrenceFieldsComplete(phase, medication) &&
    isPrescriptionPhaseClinicalFieldsComplete(phase, medication) &&
    isPrescriptionPhaseManualTimesComplete(phase)
  );
}

function isPrescriptionMedicationComplete(
  medication: PrescriptionMedicationFormValues,
  protocol: ClinicalProtocol | null,
  catalogMedication: ClinicalMedication | null,
) {
  return (
    medication.clinicalMedicationId.length > 0 &&
    medication.protocolId.length > 0 &&
    medication.phases.length > 0 &&
    Boolean(protocol) &&
    medication.phases.every((phase, index) =>
      isPrescriptionPhaseComplete(
        phase,
        index === medication.phases.length - 1,
        resolveFrequencyConfig(protocol, phase.frequency),
        catalogMedication,
      ),
    )
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

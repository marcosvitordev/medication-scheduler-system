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
  FileWarning,
  History,
  Loader2,
  RotateCcw,
  Save,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
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
  type PrescriptionFormValues,
  type RoutineFormValues,
} from "@/lib/schemas/forms";
import type {
  CalendarScheduleResponseDto,
  ClinicalMedication,
  ClinicalProtocol,
  Patient,
  PatientRoutine,
  PatientPrescription,
} from "@/types/contracts";
import { doseBorderClass, flattenDoses, statusVariant, toDoseUnitLabel } from "./formatters";

type StepId = "patient" | "routine" | "prescription" | "calendar";

type SelectedDose = ReturnType<typeof flattenDoses>[number];

const steps: Array<{ id: StepId; label: string; icon: React.ElementType }> = [
  { id: "patient", label: "Paciente", icon: UserRound },
  { id: "routine", label: "Rotina", icon: Clock3 },
  { id: "prescription", label: "Prescrição", icon: ClipboardList },
  { id: "calendar", label: "Calendário", icon: CalendarDays },
];

const recurrenceOptions = [
  { value: "DAILY", label: "Diário" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "ALTERNATE_DAYS", label: "Dias alternados" },
  { value: "PRN", label: "Se necessário" },
];

const doseUnits = ["COMP", "CP", "CAPS", "ML", "GOTAS", "UI", "UNIDADE", "SACHE", "JATO", "APLICACAO"];

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

const emptyPrescriptionForm: PrescriptionFormValues = {
  startedAt: "",
  clinicalMedicationId: "",
  protocolId: "",
  frequency: 0,
  doseValue: "",
  doseUnit: "",
  recurrenceType: "DAILY",
  treatmentDays: undefined,
  continuousUse: false,
  manualAdjustmentEnabled: false,
  manualTimes: [],
};

export function AtWorkspace() {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<StepId>("patient");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedMedicationId, setSelectedMedicationId] = useState("");
  const [selectedProtocolId, setSelectedProtocolId] = useState("");
  const [schedule, setSchedule] = useState<CalendarScheduleResponseDto | null>(null);
  const [createdPrescription, setCreatedPrescription] = useState<PatientPrescription | null>(null);
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

  const manualForm = useForm<ManualAdjustmentValues>({
    resolver: zodResolver(manualAdjustmentSchema),
    mode: "onChange",
    defaultValues: { times: [] },
  });

  const selectedMedication = useMemo(
    () => catalogQuery.data?.find((medication) => medication.id === selectedMedicationId) ?? null,
    [catalogQuery.data, selectedMedicationId],
  );

  const selectedProtocol = useMemo(
    () => selectedMedication?.protocols.find((protocol) => protocol.id === selectedProtocolId) ?? null,
    [selectedMedication, selectedProtocolId],
  );

  const selectedFrequency = prescriptionForm.watch("frequency");
  const manualEnabled = prescriptionForm.watch("manualAdjustmentEnabled");
  const watchedPrescriptionManualTimes = prescriptionForm.watch("manualTimes") ?? [];
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
          entry.item.phaseOrder === selectedDose.item.phaseOrder,
      )
      .sort((left, right) => compareDoseLabels(left.dose.label, right.dose.label));
  }, [scheduleDoses, selectedDose]);
  const watchedManualTimes = manualForm.watch("times");
  const manualTimesAreComplete =
    selectedPhaseDoses.length > 0 &&
    watchedManualTimes.length === selectedPhaseDoses.length &&
    watchedManualTimes.every((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time));
  const prescriptionManualTimesAreComplete =
    !manualEnabled ||
    (selectedFrequency > 0 &&
      watchedPrescriptionManualTimes.length === selectedFrequency &&
      watchedPrescriptionManualTimes.every((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time)));

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

  useEffect(() => {
    if (!manualEnabled || selectedFrequency <= 0) {
      prescriptionForm.setValue("manualTimes", []);
      return;
    }

    const currentTimes = prescriptionForm.getValues("manualTimes") ?? [];
    const nextTimes = Array.from({ length: selectedFrequency }, (_, index) => currentTimes[index] ?? "");
    prescriptionForm.setValue("manualTimes", nextTimes, { shouldValidate: true });
  }, [manualEnabled, prescriptionForm, selectedFrequency]);

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
      if (!selectedMedication || !selectedProtocol) throw new Error("Selecione medicamento e protocolo.");

      const result = await prescriptionService.create({
        patientId: selectedPatient.id,
        startedAt: values.startedAt,
        medications: [
          {
            clinicalMedicationId: selectedMedication.id,
            protocolId: selectedProtocol.id,
            phases: [
              {
                phaseOrder: 1,
                frequency: values.frequency,
                sameDosePerSchedule: true,
                doseValue: values.doseValue,
                doseUnit: values.doseUnit as never,
                doseAmount: `${values.doseValue} ${values.doseUnit}`,
                recurrenceType: values.recurrenceType,
                treatmentDays: values.continuousUse ? undefined : values.treatmentDays,
                continuousUse: values.continuousUse,
                manualAdjustmentEnabled: values.manualAdjustmentEnabled,
                manualTimes: values.manualAdjustmentEnabled ? values.manualTimes : undefined,
              },
            ],
          },
        ],
      });

      const prescriptions = await prescriptionService.list();
      return {
        result,
        prescription: resolveCreatedPrescription(prescriptions, selectedPatient.id, values.startedAt, selectedMedication.id),
      };
    },
    onSuccess: ({ result, prescription }) => {
      setSchedule(result);
      setCreatedPrescription(prescription);
      setSelectedDoseKey(flattenDoses(result.scheduleItems)[0]?.key ?? null);
      setCurrentStep("calendar");
      setMessage({
        tone: "success",
        text: prescription
          ? "Prescrição criada e calendário gerado."
          : "Calendário gerado. Não foi possível resolver o ID da prescrição para ajuste manual.",
      });
    },
    onError: (error) => setMessage({ tone: "error", text: formatApiError(error) }),
  });

  const manualAdjustmentMutation = useMutation({
    mutationFn: async (values: ManualAdjustmentValues) => {
      if (!createdPrescription || !selectedDose) {
        throw new Error("Prescrição ou dose selecionada não encontrada.");
      }

      const medication = createdPrescription.medications.find(
        (item) => item.id === selectedDose.item.prescriptionMedicationId,
      );
      const phase = medication?.phases.find((item) => item.phaseOrder === selectedDose.item.phaseOrder);
      if (!medication || !phase) throw new Error("Fase da prescrição não encontrada para ajuste manual.");

      return prescriptionService.update(createdPrescription.id, {
        updateMedications: [
          {
            prescriptionMedicationId: medication.id,
            updatePhases: [
              {
                phaseId: phase.id,
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
            entry.item.phaseOrder === previousSelectedDose.item.phaseOrder,
        ) ?? nextDoses[0];
      setSelectedDoseKey(nextSelectedDose?.key ?? null);
      setMessage({ tone: "success", text: "Ajuste manual aplicado e calendário regenerado." });
    },
    onError: (error) => setMessage({ tone: "error", text: formatApiError(error) }),
  });

  function handleMedicationChange(medicationId: string) {
    const medication = catalogQuery.data?.find((item) => item.id === medicationId);
    const defaultProtocol = medication?.protocols.find((protocol) => protocol.isDefault) ?? medication?.protocols[0];
    const defaultFrequency = defaultProtocol?.frequencies[0];
    setSelectedMedicationId(medicationId);
    setSelectedProtocolId(defaultProtocol?.id ?? "");
    prescriptionForm.setValue("clinicalMedicationId", medicationId);
    prescriptionForm.setValue("protocolId", defaultProtocol?.id ?? "");
    prescriptionForm.setValue("frequency", defaultFrequency?.frequency ?? 0);
    prescriptionForm.setValue("doseUnit", medication?.defaultAdministrationUnit ?? "");
  }

  function handleProtocolChange(protocolId: string) {
    const protocol = selectedMedication?.protocols.find((item) => item.id === protocolId);
    setSelectedProtocolId(protocolId);
    prescriptionForm.setValue("protocolId", protocolId);
    prescriptionForm.setValue("frequency", protocol?.frequencies[0]?.frequency ?? 0);
  }

  function resetFlow() {
    setCurrentStep("patient");
    setSelectedPatient(null);
    setSelectedMedicationId("");
    setSelectedProtocolId("");
    setSchedule(null);
    setCreatedPrescription(null);
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

        <nav className="grid grid-cols-4 gap-2 lg:grid-cols-1">
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
          <AuditRow label="Prescrição" value={createdPrescription ? "Criada" : "Pendente"} />
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
              onSubmit={prescriptionForm.handleSubmit((values) => createPrescriptionMutation.mutate(values))}
            >
              <div className="grid gap-4 lg:grid-cols-3">
                <Field error={prescriptionForm.formState.errors.startedAt?.message} label="Início">
                  <input className={inputClassName} type="date" {...prescriptionForm.register("startedAt")} />
                </Field>
                <Field error={prescriptionForm.formState.errors.clinicalMedicationId?.message} label="Medicamento">
                  <select
                    className={inputClassName}
                    value={selectedMedicationId}
                    {...prescriptionForm.register("clinicalMedicationId")}
                    onChange={(event) => handleMedicationChange(event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {catalogQuery.data?.map((medication) => (
                      <option key={medication.id} value={medication.id}>
                        {medication.commercialName ?? medication.activePrinciple}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field error={prescriptionForm.formState.errors.protocolId?.message} label="Protocolo">
                  <select
                    className={inputClassName}
                    disabled={!selectedMedication}
                    value={selectedProtocolId}
                    {...prescriptionForm.register("protocolId")}
                    onChange={(event) => handleProtocolChange(event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {selectedMedication?.protocols.map((protocol) => (
                      <option key={protocol.id} value={protocol.id}>
                        {protocol.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field error={prescriptionForm.formState.errors.frequency?.message} label="Frequência">
                  <select className={inputClassName} {...prescriptionForm.register("frequency", { valueAsNumber: true })}>
                    <option value={0}>Selecione</option>
                    {selectedProtocol?.frequencies.map((frequency) => (
                      <option key={frequency.frequency} value={frequency.frequency}>
                        {frequency.label ?? `${frequency.frequency}x ao dia`}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field error={prescriptionForm.formState.errors.doseValue?.message} label="Dose">
                  <input className={inputClassName} {...prescriptionForm.register("doseValue")} />
                </Field>
                <Field error={prescriptionForm.formState.errors.doseUnit?.message} label="Unidade">
                  <select className={inputClassName} {...prescriptionForm.register("doseUnit")}>
                    <option value="">Selecione</option>
                    {doseUnits.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field error={prescriptionForm.formState.errors.recurrenceType?.message} label="Recorrência">
                  <select className={inputClassName} {...prescriptionForm.register("recurrenceType")}>
                    {recurrenceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Dias de tratamento">
                  <input
                    className={inputClassName}
                    disabled={prescriptionForm.watch("continuousUse")}
                    min={1}
                    type="number"
                    {...prescriptionForm.register("treatmentDays")}
                  />
                </Field>
              </div>

              <div className="grid gap-3 rounded-md border bg-muted/40 p-4 lg:grid-cols-2">
                <label className="flex items-center gap-3 text-sm font-semibold">
                  <input className="size-4" type="checkbox" {...prescriptionForm.register("continuousUse")} />
                  Uso contínuo
                </label>
                <label className="flex items-center gap-3 text-sm font-semibold">
                  <input className="size-4" type="checkbox" {...prescriptionForm.register("manualAdjustmentEnabled")} />
                  Farmacêutico definirá horários manualmente
                </label>
              </div>

              {manualEnabled ? (
                <div className="rounded-md border border-warning/30 bg-warning/10 p-4">
                  <h3 className="mb-1 font-bold text-warning">Ajuste manual da fase</h3>
                  <p className="mb-4 text-sm text-warning">
                    O ajuste manual vale para a fase inteira; informe todos os horários da fase.
                  </p>
                  {selectedFrequency > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {Array.from({ length: selectedFrequency }, (_, index) => (
                        <Field
                          error={prescriptionForm.formState.errors.manualTimes?.[index]?.message}
                          key={`manual-time-${index}`}
                          label={`D${index + 1}`}
                        >
                          <input
                            className={inputClassName}
                            type="time"
                            {...prescriptionForm.register(`manualTimes.${index}` as const)}
                          />
                        </Field>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-warning">
                      Selecione uma frequência para informar os horários manuais.
                    </p>
                  )}
                  {!prescriptionManualTimesAreComplete ? (
                    <p className="mt-3 text-sm font-semibold text-warning">
                      Todos os horários manuais devem estar preenchidos em HH:mm.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {selectedMedication && selectedProtocol ? (
                <PrescriptionPreview medication={selectedMedication} protocol={selectedProtocol} frequency={selectedFrequency} />
              ) : null}

              <div className="flex justify-between gap-3">
                <Button onClick={() => setCurrentStep("routine")} type="button" variant="secondary">
                  Voltar
                </Button>
                <Button
                  disabled={
                    !selectedPatient ||
                    createPrescriptionMutation.isPending ||
                    !prescriptionManualTimesAreComplete
                  }
                  type="submit"
                >
                  {createPrescriptionMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
                  Gerar calendário
                </Button>
              </div>
            </form>
          </Panel>
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
                              !createdPrescription ||
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
                      {!createdPrescription ? (
                        <p className="mt-3 text-sm font-semibold text-warning">
                          <FileWarning className="mr-1 inline size-4" />
                          O backend não retornou o ID da prescrição; crie novamente se precisar testar ajuste manual.
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

function PrescriptionPreview({
  medication,
  protocol,
  frequency,
}: {
  medication: ClinicalMedication;
  protocol: ClinicalProtocol;
  frequency: number;
}) {
  const config = protocol.frequencies.find((item) => item.frequency === Number(frequency));
  return (
    <div className="rounded-md border bg-muted/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">{medication.commercialName ?? medication.activePrinciple}</h3>
          <p className="text-sm text-muted-foreground">{medication.activePrinciple} · {medication.administrationRoute}</p>
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

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function resolveCreatedPrescription(
  prescriptions: PatientPrescription[],
  patientId: string,
  startedAt: string,
  medicationId: string,
) {
  const matches = prescriptions.filter(
    (prescription) =>
      prescription.patient.id === patientId &&
      prescription.startedAt === startedAt &&
      prescription.medications.some((medication) => medication.sourceClinicalMedicationId === medicationId),
  );
  return matches.at(-1) ?? null;
}

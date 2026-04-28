"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { swrFetcher, prescriptionsApi } from "@/lib/api";
import type { Patient, ClinicalMedication, PrescriptionPhase } from "@/types";

interface MedicationEntry {
  medicationId: string;
  protocolId: string;
  phases: PrescriptionPhase[];
}

interface PrescriptionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const defaultPhase: PrescriptionPhase = {
  phaseOrder: 1,
  frequency: 1,
  sameDosePerSchedule: true,
  doseAmount: "1 COMP",
  doseValue: "1",
  doseUnit: "COMP",
  recurrenceType: "DAILY",
  treatmentDays: 10,
  continuousUse: false,
  manualAdjustmentEnabled: false,
};

export function PrescriptionFormModal({
  isOpen,
  onClose,
  onSuccess,
}: PrescriptionFormModalProps) {
  const { data: patients } = useSWR<Patient[]>("/patients", swrFetcher);
  const { data: medications } = useSWR<ClinicalMedication[]>(
    "/clinical-catalog/medications",
    swrFetcher
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientId, setPatientId] = useState("");
  const [startedAt, setStartedAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [medicationEntries, setMedicationEntries] = useState<MedicationEntry[]>([]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPatientId("");
      setStartedAt(new Date().toISOString().split("T")[0]);
      setMedicationEntries([]);
      setError(null);
    }
  }, [isOpen]);

  const selectedPatient = patients?.find((p) => p.id === patientId);
  const hasRoutine = selectedPatient?.routines?.some((r) => r.active);

  const addMedication = () => {
    setMedicationEntries((prev) => [
      ...prev,
      {
        medicationId: "",
        protocolId: "",
        phases: [{ ...defaultPhase }],
      },
    ]);
  };

  const removeMedication = (index: number) => {
    setMedicationEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMedicationEntry = (
    index: number,
    field: keyof MedicationEntry,
    value: string
  ) => {
    setMedicationEntries((prev) => {
      const updated = [...prev];
      if (field === "medicationId") {
        const med = medications?.find((m) => m.id === value);
        updated[index] = {
          ...updated[index],
          medicationId: value,
          protocolId: med?.protocols?.[0]?.id || "",
        };
      } else if (field === "protocolId") {
        updated[index] = {
          ...updated[index],
          protocolId: value,
        };
      }
      return updated;
    });
  };

  const updatePhase = (
    medIndex: number,
    phaseIndex: number,
    field: keyof PrescriptionPhase,
    value: string | number | boolean
  ) => {
    setMedicationEntries((prev) => {
      const updated = [...prev];
      const phases = [...updated[medIndex].phases];
      phases[phaseIndex] = {
        ...phases[phaseIndex],
        [field]: value,
      };
      updated[medIndex] = { ...updated[medIndex], phases };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!patientId) {
      setError("Selecione um paciente");
      setIsSubmitting(false);
      return;
    }

    if (!hasRoutine) {
      setError("O paciente selecionado nao possui rotina configurada");
      setIsSubmitting(false);
      return;
    }

    if (medicationEntries.length === 0) {
      setError("Adicione pelo menos um medicamento");
      setIsSubmitting(false);
      return;
    }

    try {
      await prescriptionsApi.create({
        patientId,
        startedAt,
        medications: medicationEntries.map((entry) => ({
          clinicalMedicationId: entry.medicationId,
          protocolId: entry.protocolId,
          phases: entry.phases.map((phase, idx) => ({
            ...phase,
            phaseOrder: idx + 1,
          })),
        })),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar prescricao");
    } finally {
      setIsSubmitting(false);
    }
  };

  const patientOptions = (patients || []).map((p) => ({
    value: p.id,
    label: p.fullName,
  }));

  const medicationOptions = (medications || []).map((m) => ({
    value: m.id,
    label: m.commercialName || m.activePrinciple,
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nova Prescricao" size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Patient and Date Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Select
              label="Paciente"
              id="patientId"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              options={patientOptions}
              placeholder="Selecione um paciente"
            />
            {patientId && !hasRoutine && (
              <p className="mt-1 text-xs text-warning flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Paciente sem rotina configurada
              </p>
            )}
          </div>

          <Input
            label="Data de Inicio"
            id="startedAt"
            type="date"
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            required
          />
        </div>

        {/* Medications */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">Medicamentos</h4>
            <Button type="button" variant="secondary" size="sm" onClick={addMedication}>
              <Plus className="w-4 h-4" />
              Adicionar
            </Button>
          </div>

          {medicationEntries.length === 0 ? (
            <div className="text-center py-8 rounded-lg bg-secondary border border-dashed border-border">
              <p className="text-sm text-muted-foreground mb-2">
                Nenhum medicamento adicionado
              </p>
              <Button type="button" variant="outline" size="sm" onClick={addMedication}>
                <Plus className="w-4 h-4" />
                Adicionar Medicamento
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {medicationEntries.map((entry, medIdx) => {
                const selectedMed = medications?.find(
                  (m) => m.id === entry.medicationId
                );
                const protocolOptions = (selectedMed?.protocols || []).map((p) => ({
                  value: p.id,
                  label: p.code,
                }));

                return (
                  <div
                    key={medIdx}
                    className="p-4 rounded-lg bg-secondary border border-border"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <Badge variant="info">Medicamento {medIdx + 1}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMedication(medIdx)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <Select
                        label="Medicamento"
                        id={`med-${medIdx}`}
                        value={entry.medicationId}
                        onChange={(e) =>
                          updateMedicationEntry(medIdx, "medicationId", e.target.value)
                        }
                        options={medicationOptions}
                        placeholder="Selecione"
                      />

                      <Select
                        label="Protocolo"
                        id={`protocol-${medIdx}`}
                        value={entry.protocolId}
                        onChange={(e) =>
                          updateMedicationEntry(medIdx, "protocolId", e.target.value)
                        }
                        options={protocolOptions}
                        placeholder="Selecione"
                        disabled={!entry.medicationId}
                      />
                    </div>

                    {/* Phase Configuration */}
                    {entry.phases.map((phase, phaseIdx) => (
                      <div
                        key={phaseIdx}
                        className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded bg-background"
                      >
                        <Input
                          label="Dose"
                          id={`dose-${medIdx}-${phaseIdx}`}
                          value={phase.doseAmount}
                          onChange={(e) =>
                            updatePhase(medIdx, phaseIdx, "doseAmount", e.target.value)
                          }
                          placeholder="1 COMP"
                        />

                        <Input
                          label="Frequencia/dia"
                          id={`freq-${medIdx}-${phaseIdx}`}
                          type="number"
                          min={1}
                          value={phase.frequency}
                          onChange={(e) =>
                            updatePhase(
                              medIdx,
                              phaseIdx,
                              "frequency",
                              parseInt(e.target.value) || 1
                            )
                          }
                        />

                        <Select
                          label="Recorrencia"
                          id={`recurrence-${medIdx}-${phaseIdx}`}
                          value={phase.recurrenceType}
                          onChange={(e) =>
                            updatePhase(
                              medIdx,
                              phaseIdx,
                              "recurrenceType",
                              e.target.value
                            )
                          }
                          options={[
                            { value: "DAILY", label: "Diario" },
                            { value: "WEEKLY", label: "Semanal" },
                            { value: "MONTHLY", label: "Mensal" },
                          ]}
                        />

                        <Input
                          label="Dias de tratamento"
                          id={`days-${medIdx}-${phaseIdx}`}
                          type="number"
                          min={1}
                          value={phase.treatmentDays || ""}
                          onChange={(e) =>
                            updatePhase(
                              medIdx,
                              phaseIdx,
                              "treatmentDays",
                              parseInt(e.target.value) || undefined
                            )
                          }
                          placeholder="Continuo"
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Criando..." : "Criar Prescricao"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { patientsApi } from "@/lib/api";

interface RoutineFormModalProps {
  patientId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RoutineFormModal({
  patientId,
  isOpen,
  onClose,
  onSuccess,
}: RoutineFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    acordar: "06:00",
    cafe: "07:00",
    almoco: "12:00",
    lanche: "15:00",
    jantar: "19:00",
    dormir: "22:00",
    banho: "08:30",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await patientsApi.createRoutine(patientId, formData);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar rotina");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurar Rotina" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Configure os horarios da rotina diaria do paciente. Esses horarios serao
          usados como ancora para o agendamento de medicamentos.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Acordar"
            id="acordar"
            name="acordar"
            type="time"
            value={formData.acordar}
            onChange={handleChange}
            required
          />

          <Input
            label="Cafe da Manha"
            id="cafe"
            name="cafe"
            type="time"
            value={formData.cafe}
            onChange={handleChange}
            required
          />

          <Input
            label="Almoco"
            id="almoco"
            name="almoco"
            type="time"
            value={formData.almoco}
            onChange={handleChange}
            required
          />

          <Input
            label="Lanche da Tarde"
            id="lanche"
            name="lanche"
            type="time"
            value={formData.lanche}
            onChange={handleChange}
            required
          />

          <Input
            label="Jantar"
            id="jantar"
            name="jantar"
            type="time"
            value={formData.jantar}
            onChange={handleChange}
            required
          />

          <Input
            label="Dormir"
            id="dormir"
            name="dormir"
            type="time"
            value={formData.dormir}
            onChange={handleChange}
            required
          />

          <Input
            label="Banho"
            id="banho"
            name="banho"
            type="time"
            value={formData.banho}
            onChange={handleChange}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar Rotina"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

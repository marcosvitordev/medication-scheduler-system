"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { patientsApi } from "@/lib/api";

interface PatientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PatientFormModal({
  isOpen,
  onClose,
  onSuccess,
}: PatientFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    birthDate: "",
    rg: "",
    cpf: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await patientsApi.create({
        fullName: formData.fullName,
        birthDate: formData.birthDate,
        rg: formData.rg || undefined,
        cpf: formData.cpf || undefined,
        phone: formData.phone || undefined,
      });
      setFormData({
        fullName: "",
        birthDate: "",
        rg: "",
        cpf: "",
        phone: "",
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar paciente");
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
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Paciente" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Input
          label="Nome Completo"
          id="fullName"
          name="fullName"
          value={formData.fullName}
          onChange={handleChange}
          placeholder="Digite o nome completo"
          required
        />

        <Input
          label="Data de Nascimento"
          id="birthDate"
          name="birthDate"
          type="date"
          value={formData.birthDate}
          onChange={handleChange}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="RG"
            id="rg"
            name="rg"
            value={formData.rg}
            onChange={handleChange}
            placeholder="1234567"
          />

          <Input
            label="CPF"
            id="cpf"
            name="cpf"
            value={formData.cpf}
            onChange={handleChange}
            placeholder="00000000000"
          />
        </div>

        <Input
          label="Telefone"
          id="phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder="(00) 00000-0000"
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Cadastrar Paciente"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { Clock, User, Phone, CreditCard, Calendar } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, calculateAge, formatTime } from "@/lib/utils";
import { RoutineFormModal } from "./routine-form-modal";
import type { Patient } from "@/types";

interface PatientDetailsModalProps {
  patient: Patient;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function PatientDetailsModal({
  patient,
  isOpen,
  onClose,
  onUpdate,
}: PatientDetailsModalProps) {
  const [isRoutineFormOpen, setIsRoutineFormOpen] = useState(false);
  const activeRoutine = patient.routines?.find((r) => r.active);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Detalhes do Paciente" size="lg">
        <div className="space-y-6">
          {/* Patient Header */}
          <div className="flex items-center gap-4 pb-4 border-b border-border">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
              <span className="text-2xl font-bold text-primary">
                {patient.fullName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {patient.fullName}
              </h2>
              <p className="text-sm text-muted-foreground">
                {calculateAge(patient.birthDate)} anos
              </p>
            </div>
          </div>

          {/* Patient Info */}
          <div className="grid grid-cols-2 gap-4">
            <InfoRow
              icon={Calendar}
              label="Data de Nascimento"
              value={formatDate(patient.birthDate)}
            />
            <InfoRow icon={Phone} label="Telefone" value={patient.phone} />
            <InfoRow icon={CreditCard} label="CPF" value={patient.cpf} />
            <InfoRow icon={User} label="RG" value={patient.rg} />
          </div>

          {/* Routine Section */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Rotina Diaria
              </h3>
              <Badge variant={activeRoutine ? "success" : "warning"}>
                {activeRoutine ? "Ativa" : "Nao configurada"}
              </Badge>
            </div>

            {activeRoutine ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Acordar", value: activeRoutine.acordar },
                  { label: "Cafe", value: activeRoutine.cafe },
                  { label: "Almoco", value: activeRoutine.almoco },
                  { label: "Lanche", value: activeRoutine.lanche },
                  { label: "Jantar", value: activeRoutine.jantar },
                  { label: "Dormir", value: activeRoutine.dormir },
                  { label: "Banho", value: activeRoutine.banho },
                ].map(
                  (item) =>
                    item.value && (
                      <div
                        key={item.label}
                        className="p-3 rounded-lg bg-secondary text-center"
                      >
                        <p className="text-xs text-muted-foreground mb-1">
                          {item.label}
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          {formatTime(item.value)}
                        </p>
                      </div>
                    )
                )}
              </div>
            ) : (
              <div className="text-center py-6 rounded-lg bg-secondary">
                <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">
                  Nenhuma rotina configurada para este paciente
                </p>
                <Button size="sm" onClick={() => setIsRoutineFormOpen(true)}>
                  Configurar Rotina
                </Button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            {!activeRoutine && (
              <Button onClick={() => setIsRoutineFormOpen(true)}>
                Adicionar Rotina
              </Button>
            )}
          </div>
        </div>
      </Modal>

      <RoutineFormModal
        patientId={patient.id}
        isOpen={isRoutineFormOpen}
        onClose={() => setIsRoutineFormOpen(false)}
        onSuccess={() => {
          setIsRoutineFormOpen(false);
          onUpdate();
        }}
      />
    </>
  );
}

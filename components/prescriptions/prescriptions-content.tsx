"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, FileText, Search, Calendar, Eye, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { swrFetcher } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { PrescriptionFormModal } from "./prescription-form-modal";
import type { PatientPrescription } from "@/types";
import Link from "next/link";

export function PrescriptionsContent() {
  const { data: prescriptions, isLoading, mutate } = useSWR<PatientPrescription[]>(
    "/patient-prescriptions",
    swrFetcher
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);

  const filteredPrescriptions = prescriptions?.filter((prescription) =>
    prescription.patient?.fullName
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return <LoadingState message="Carregando prescricoes..." />;
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "success";
      case "COMPLETED":
        return "default";
      case "CANCELLED":
        return "destructive";
      default:
        return "default";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "Ativo";
      case "COMPLETED":
        return "Concluido";
      case "CANCELLED":
        return "Cancelado";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por paciente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="w-4 h-4" />
          Nova Prescricao
        </Button>
      </div>

      {/* Prescriptions List */}
      {!prescriptions || prescriptions.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FileText}
              title="Nenhuma prescricao cadastrada"
              description="Crie uma nova prescricao para um paciente"
              action={
                <Button onClick={() => setIsFormOpen(true)}>
                  <Plus className="w-4 h-4" />
                  Nova Prescricao
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : filteredPrescriptions && filteredPrescriptions.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Search}
              title="Nenhum resultado encontrado"
              description={`Nao encontramos prescricoes para "${searchQuery}"`}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPrescriptions?.map((prescription) => (
            <Card
              key={prescription.id}
              className="hover:border-primary/50 transition-colors"
            >
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Patient Info */}
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 shrink-0">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">
                        {prescription.patient?.fullName || "Paciente"}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Inicio: {formatDate(prescription.startedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Medications Count */}
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">
                        {prescription.medications?.length || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Medicamento(s)
                      </p>
                    </div>

                    {/* Status */}
                    <Badge variant={getStatusVariant(prescription.status)}>
                      {getStatusLabel(prescription.status)}
                    </Badge>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Link href={`/agenda?prescricao=${prescription.id}`}>
                        <Button variant="outline" size="sm">
                          <Calendar className="w-4 h-4" />
                          <span className="hidden sm:inline ml-1">Ver Agenda</span>
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Medications Preview */}
                {prescription.medications && prescription.medications.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">
                      Medicamentos:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {prescription.medications.slice(0, 5).map((med, idx) => (
                        <Badge key={idx} variant="default">
                          {med.clinicalMedication?.commercialName ||
                            med.clinicalMedication?.activePrinciple ||
                            "Medicamento"}
                        </Badge>
                      ))}
                      {prescription.medications.length > 5 && (
                        <Badge variant="default">
                          +{prescription.medications.length - 5} mais
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <PrescriptionFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => {
          setIsFormOpen(false);
          mutate();
        }}
      />
    </div>
  );
}

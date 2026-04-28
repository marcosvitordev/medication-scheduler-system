"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Users, Search, Eye, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { swrFetcher } from "@/lib/api";
import { formatDate, calculateAge } from "@/lib/utils";
import { PatientFormModal } from "./patient-form-modal";
import { PatientDetailsModal } from "./patient-details-modal";
import type { Patient } from "@/types";

export function PatientsContent() {
  const { data: patients, isLoading, mutate } = useSWR<Patient[]>(
    "/patients",
    swrFetcher
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const filteredPatients = patients?.filter((patient) =>
    patient.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return <LoadingState message="Carregando pacientes..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar pacientes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="w-4 h-4" />
          Novo Paciente
        </Button>
      </div>

      {/* Patients List */}
      {!patients || patients.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Users}
              title="Nenhum paciente cadastrado"
              description="Cadastre o primeiro paciente para comecar a gerenciar prescricoes e agendas"
              action={
                <Button onClick={() => setIsFormOpen(true)}>
                  <Plus className="w-4 h-4" />
                  Cadastrar Paciente
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : filteredPatients && filteredPatients.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Search}
              title="Nenhum resultado encontrado"
              description={`Nao encontramos pacientes com "${searchQuery}"`}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPatients?.map((patient) => (
            <Card
              key={patient.id}
              className="hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => setSelectedPatient(patient)}
            >
              <CardContent className="p-0">
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 shrink-0">
                    <span className="text-lg font-semibold text-primary">
                      {patient.fullName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground truncate">
                      {patient.fullName}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground">
                        {calculateAge(patient.birthDate)} anos
                      </span>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(patient.birthDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge
                        variant={
                          patient.routines?.length > 0 ? "success" : "warning"
                        }
                      >
                        {patient.routines?.length > 0 ? (
                          <><Clock className="w-3 h-3 mr-1" /> Com rotina</>
                        ) : (
                          "Sem rotina"
                        )}
                      </Badge>
                      {patient.phone && (
                        <span className="text-xs text-muted-foreground">
                          {patient.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPatient(patient);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      <PatientFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => {
          setIsFormOpen(false);
          mutate();
        }}
      />

      {selectedPatient && (
        <PatientDetailsModal
          patient={selectedPatient}
          isOpen={!!selectedPatient}
          onClose={() => setSelectedPatient(null)}
          onUpdate={() => mutate()}
        />
      )}
    </div>
  );
}

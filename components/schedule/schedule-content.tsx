"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Calendar, FileText, User, Clock, Building2, Phone, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { swrFetcher, prescriptionsApi } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/utils";
import { ScheduleTable } from "./schedule-table";
import type { PatientPrescription, CalendarScheduleResponse } from "@/types";

export function ScheduleContent() {
  const searchParams = useSearchParams();
  const prescriptionIdFromUrl = searchParams.get("prescricao");

  const { data: prescriptions, isLoading: prescriptionsLoading } = useSWR<
    PatientPrescription[]
  >("/patient-prescriptions", swrFetcher);

  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string>("");
  const [schedule, setSchedule] = useState<CalendarScheduleResponse | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set prescription from URL or first available
  useEffect(() => {
    if (prescriptionIdFromUrl) {
      setSelectedPrescriptionId(prescriptionIdFromUrl);
    } else if (prescriptions && prescriptions.length > 0 && !selectedPrescriptionId) {
      setSelectedPrescriptionId(prescriptions[0].id);
    }
  }, [prescriptionIdFromUrl, prescriptions, selectedPrescriptionId]);

  // Load schedule when prescription changes
  useEffect(() => {
    if (selectedPrescriptionId) {
      loadSchedule(selectedPrescriptionId);
    }
  }, [selectedPrescriptionId]);

  const loadSchedule = async (prescriptionId: string) => {
    setIsLoadingSchedule(true);
    setError(null);
    try {
      const data = await prescriptionsApi.getSchedule(prescriptionId);
      setSchedule(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar agenda");
      setSchedule(null);
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  if (prescriptionsLoading) {
    return <LoadingState message="Carregando prescricoes..." />;
  }

  if (!prescriptions || prescriptions.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={Calendar}
            title="Nenhuma prescricao encontrada"
            description="Crie uma prescricao primeiro para visualizar a agenda"
            action={
              <Button onClick={() => (window.location.href = "/prescricoes")}>
                <FileText className="w-4 h-4" />
                Ir para Prescricoes
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  const prescriptionOptions = prescriptions.map((p) => ({
    value: p.id,
    label: `${p.patient?.fullName || "Paciente"} - ${formatDate(p.startedAt)}`,
  }));

  return (
    <div className="space-y-6">
      {/* Prescription Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
            <div className="flex-1 max-w-md">
              <Select
                label="Selecione uma Prescricao"
                id="prescription"
                value={selectedPrescriptionId}
                onChange={(e) => setSelectedPrescriptionId(e.target.value)}
                options={prescriptionOptions}
                placeholder="Selecione uma prescricao"
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => loadSchedule(selectedPrescriptionId)}
              disabled={!selectedPrescriptionId || isLoadingSchedule}
            >
              <Calendar className="w-4 h-4" />
              Atualizar Agenda
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoadingSchedule && <LoadingState message="Carregando agenda..." />}

      {/* Schedule Content */}
      {schedule && !isLoadingSchedule && (
        <>
          {/* Document Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Informacoes do Documento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Empresa</p>
                    <p className="text-sm font-medium text-foreground">
                      {schedule.documentHeader.nomeEmpresa}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">CNPJ</p>
                    <p className="text-sm font-medium text-foreground">
                      {schedule.documentHeader.cnpj}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="text-sm font-medium text-foreground">
                      {schedule.documentHeader.telefone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium text-foreground">
                      {schedule.documentHeader.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Farmaceutico</p>
                    <p className="text-sm font-medium text-foreground">
                      {schedule.documentHeader.farmaceuticoNome}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">CRF</p>
                    <p className="text-sm font-medium text-foreground">
                      {schedule.documentHeader.farmaceuticoCrf}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Patient Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Dados do Paciente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Nome</p>
                    <p className="text-sm font-medium text-foreground">
                      {schedule.patient.nome}
                    </p>
                  </div>
                  {schedule.patient.dataNascimento && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Data de Nascimento
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {formatDate(schedule.patient.dataNascimento)}
                      </p>
                    </div>
                  )}
                  {schedule.patient.idade && (
                    <div>
                      <p className="text-xs text-muted-foreground">Idade</p>
                      <p className="text-sm font-medium text-foreground">
                        {schedule.patient.idade} anos
                      </p>
                    </div>
                  )}
                  {schedule.patient.cpf && (
                    <div>
                      <p className="text-xs text-muted-foreground">CPF</p>
                      <p className="text-sm font-medium text-foreground">
                        {schedule.patient.cpf}
                      </p>
                    </div>
                  )}
                  {schedule.patient.telefone && (
                    <div>
                      <p className="text-xs text-muted-foreground">Telefone</p>
                      <p className="text-sm font-medium text-foreground">
                        {schedule.patient.telefone}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Routine */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Rotina do Paciente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Acordar", value: schedule.routine.acordar },
                    { label: "Cafe", value: schedule.routine.cafe },
                    { label: "Almoco", value: schedule.routine.almoco },
                    { label: "Lanche", value: schedule.routine.lanche },
                    { label: "Jantar", value: schedule.routine.jantar },
                    { label: "Dormir", value: schedule.routine.dormir },
                    { label: "Banho", value: schedule.routine.banho },
                  ].map(
                    (item) =>
                      item.value && (
                        <div
                          key={item.label}
                          className="text-center p-2 rounded-lg bg-secondary"
                        >
                          <p className="text-xs text-muted-foreground">
                            {item.label}
                          </p>
                          <p className="text-sm font-medium text-foreground">
                            {formatTime(item.value)}
                          </p>
                        </div>
                      )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Schedule Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Agenda de Medicamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {schedule.scheduleItems && schedule.scheduleItems.length > 0 ? (
                <ScheduleTable items={schedule.scheduleItems} />
              ) : (
                <EmptyState
                  icon={Calendar}
                  title="Nenhum item na agenda"
                  description="Esta prescricao nao possui itens agendados"
                />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

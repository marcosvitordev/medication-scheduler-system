"use client";

import useSWR from "swr";
import { Users, Pill, FileText, Calendar, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { swrFetcher } from "@/lib/api";
import { LoadingState } from "@/components/ui/spinner";
import { formatDate } from "@/lib/utils";
import type { Patient, ClinicalMedication, PatientPrescription } from "@/types";

function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  description,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  description?: string;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
            {trend && (
              <div className="flex items-center gap-1">
                <TrendingUp
                  className={`w-4 h-4 ${
                    trend.positive ? "text-success" : "text-destructive"
                  }`}
                />
                <span
                  className={`text-sm font-medium ${
                    trend.positive ? "text-success" : "text-destructive"
                  }`}
                >
                  {trend.positive ? "+" : "-"}
                  {trend.value}%
                </span>
              </div>
            )}
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentPatients({ patients }: { patients: Patient[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Pacientes Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {patients.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum paciente cadastrado
          </p>
        ) : (
          <div className="space-y-3">
            {patients.slice(0, 5).map((patient) => (
              <div
                key={patient.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                    <span className="text-sm font-medium text-primary">
                      {patient.fullName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {patient.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(patient.birthDate)}
                    </p>
                  </div>
                </div>
                <Badge variant={patient.routines?.length > 0 ? "success" : "warning"}>
                  {patient.routines?.length > 0 ? "Com rotina" : "Sem rotina"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentPrescriptions({
  prescriptions,
}: {
  prescriptions: PatientPrescription[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Prescricoes Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {prescriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma prescricao cadastrada
          </p>
        ) : (
          <div className="space-y-3">
            {prescriptions.slice(0, 5).map((prescription) => (
              <div
                key={prescription.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-info/10">
                    <Clock className="w-5 h-5 text-info" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {prescription.patient?.fullName || "Paciente"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Inicio: {formatDate(prescription.startedAt)}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={prescription.status === "ACTIVE" ? "success" : "default"}
                >
                  {prescription.status === "ACTIVE" ? "Ativo" : prescription.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Acoes Rapidas
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <a
            href="/pacientes"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <Users className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Novo Paciente
            </span>
          </a>
          <a
            href="/prescricoes"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <FileText className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Nova Prescricao
            </span>
          </a>
          <a
            href="/medicamentos"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <Pill className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Medicamentos
            </span>
          </a>
          <a
            href="/agenda"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <Calendar className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium text-foreground">
              Ver Agenda
            </span>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardContent() {
  const { data: patients, isLoading: patientsLoading } = useSWR<Patient[]>(
    "/patients",
    swrFetcher
  );
  const { data: medications, isLoading: medicationsLoading } = useSWR<
    ClinicalMedication[]
  >("/clinical-catalog/medications", swrFetcher);
  const { data: prescriptions, isLoading: prescriptionsLoading } = useSWR<
    PatientPrescription[]
  >("/patient-prescriptions", swrFetcher);

  const isLoading = patientsLoading || medicationsLoading || prescriptionsLoading;

  if (isLoading) {
    return <LoadingState message="Carregando dados do dashboard..." />;
  }

  const patientsCount = patients?.length || 0;
  const medicationsCount = medications?.length || 0;
  const prescriptionsCount = prescriptions?.length || 0;
  const activePrescriptions =
    prescriptions?.filter((p) => p.status === "ACTIVE").length || 0;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total de Pacientes"
          value={patientsCount}
          icon={Users}
          description="Pacientes cadastrados"
        />
        <StatsCard
          title="Medicamentos"
          value={medicationsCount}
          icon={Pill}
          description="No catalogo clinico"
        />
        <StatsCard
          title="Prescricoes"
          value={prescriptionsCount}
          icon={FileText}
          description="Total de prescricoes"
        />
        <StatsCard
          title="Prescricoes Ativas"
          value={activePrescriptions}
          icon={Calendar}
          description="Em andamento"
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RecentPatients patients={patients || []} />
          <RecentPrescriptions prescriptions={prescriptions || []} />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}

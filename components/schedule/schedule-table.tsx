"use client";

import { Pill, Clock, AlertTriangle, CheckCircle, XCircle, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatTime, formatDate } from "@/lib/utils";
import type { ScheduleItem, ScheduleDose, ScheduleStatus } from "@/types";

interface ScheduleTableProps {
  items: ScheduleItem[];
}

function DoseStatusBadge({ status }: { status: ScheduleStatus }) {
  const config = {
    ACTIVE: {
      variant: "success" as const,
      label: "Ativo",
      icon: CheckCircle,
    },
    INACTIVE: {
      variant: "default" as const,
      label: "Inativo",
      icon: XCircle,
    },
    MANUAL_ADJUSTMENT_REQUIRED: {
      variant: "warning" as const,
      label: "Ajuste Manual",
      icon: Settings,
    },
  };

  const { variant, label, icon: Icon } = config[status] || config.ACTIVE;

  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

function DoseCard({ dose, index }: { dose: ScheduleDose; index: number }) {
  const isActive = dose.status === "ACTIVE";
  const needsAdjustment = dose.status === "MANUAL_ADJUSTMENT_REQUIRED";

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-colors",
        isActive
          ? "bg-success/5 border-success/20"
          : needsAdjustment
          ? "bg-warning/5 border-warning/20"
          : "bg-secondary border-border opacity-60"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">
          {dose.label}
        </span>
        <DoseStatusBadge status={dose.status} />
      </div>

      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span
          className={cn(
            "text-lg font-semibold",
            isActive ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {formatTime(dose.horario)}
        </span>
      </div>

      {dose.doseExibicao && (
        <p className="text-sm text-muted-foreground mt-1">{dose.doseExibicao}</p>
      )}

      {dose.observacao && (
        <p className="text-xs text-muted-foreground mt-2 italic">
          {dose.observacao}
        </p>
      )}

      {dose.reasonText && (
        <div className="mt-2 p-2 rounded bg-secondary">
          <p className="text-xs text-muted-foreground">{dose.reasonText}</p>
        </div>
      )}

      {dose.conflito && (
        <div className="mt-2 p-2 rounded bg-warning/10 border border-warning/20">
          <div className="flex items-center gap-1 text-warning">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-xs font-medium">Conflito</span>
          </div>
          {dose.conflito.tipo_resolucao_codigo && (
            <p className="text-xs text-muted-foreground mt-1">
              Resolucao: {dose.conflito.tipo_resolucao_codigo}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MedicationRow({ item }: { item: ScheduleItem }) {
  const activeDoses = item.doses.filter((d) => d.status === "ACTIVE").length;
  const totalDoses = item.doses.length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Medication Header */}
      <div className="bg-secondary p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
              <Pill className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {item.medicamento}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {item.principioAtivo} - {item.apresentacao}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{item.via}</Badge>
            <Badge variant="info">{item.recorrenciaTexto}</Badge>
            <Badge variant={item.status === "Ativo" ? "success" : "default"}>
              {item.status}
            </Badge>
            <Badge variant="default">
              {activeDoses}/{totalDoses} doses ativas
            </Badge>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {item.inicio && (
            <span>
              <strong>Inicio:</strong> {formatDate(item.inicio)}
            </span>
          )}
          {item.termino && (
            <span>
              <strong>Termino:</strong> {formatDate(item.termino)}
            </span>
          )}
          {item.modoUso && (
            <span className="truncate max-w-xs" title={item.modoUso}>
              <strong>Modo de uso:</strong> {item.modoUso}
            </span>
          )}
        </div>

        {/* Observations */}
        {item.observacoes && item.observacoes.length > 0 && (
          <div className="mt-3 p-2 rounded bg-background">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Observacoes:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {item.observacoes.map((obs, idx) => (
                <li key={idx}>- {obs}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Doses Grid */}
      <div className="p-4 bg-card">
        <p className="text-sm font-medium text-muted-foreground mb-3">
          Horarios das Doses
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {item.doses.map((dose, idx) => (
            <DoseCard key={idx} dose={dose} index={idx} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ScheduleTable({ items }: ScheduleTableProps) {
  return (
    <div className="space-y-6">
      {items.map((item, idx) => (
        <MedicationRow key={`${item.prescriptionMedicationId}-${idx}`} item={item} />
      ))}
    </div>
  );
}

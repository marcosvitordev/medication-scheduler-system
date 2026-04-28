"use client";

import { Pill, Syringe, FileText, Tag } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ClinicalMedication } from "@/types";

interface MedicationDetailsModalProps {
  medication: ClinicalMedication;
  isOpen: boolean;
  onClose: () => void;
}

function InfoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export function MedicationDetailsModal({
  medication,
  isOpen,
  onClose,
}: MedicationDetailsModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalhes do Medicamento"
      size="lg"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4 pb-4 border-b border-border">
          <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-primary/10">
            <Pill className="w-8 h-8 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-foreground">
              {medication.commercialName || medication.activePrinciple}
            </h2>
            <p className="text-sm text-muted-foreground">
              {medication.activePrinciple}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge variant="default">{medication.administrationRoute}</Badge>
              {medication.isOphthalmic && (
                <Badge variant="success">Oftalmico</Badge>
              )}
              {medication.isOtic && <Badge variant="success">Otologico</Badge>}
              {medication.isContraceptiveMonthly && (
                <Badge variant="info">Contraceptivo Mensal</Badge>
              )}
              {medication.requiresGlycemiaScale && (
                <Badge variant="warning">Requer Glicemia</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          <InfoSection title="Apresentacao">
            <p>{medication.presentation}</p>
          </InfoSection>

          {medication.pharmaceuticalForm && (
            <InfoSection title="Forma Farmaceutica">
              <p>{medication.pharmaceuticalForm}</p>
            </InfoSection>
          )}

          <InfoSection title="Via de Administracao">
            <p>{medication.administrationRoute}</p>
          </InfoSection>

          {medication.defaultAdministrationUnit && (
            <InfoSection title="Unidade Padrao">
              <p>{medication.defaultAdministrationUnit}</p>
            </InfoSection>
          )}

          {medication.diluentType && (
            <InfoSection title="Tipo de Diluente">
              <p>{medication.diluentType}</p>
            </InfoSection>
          )}
        </div>

        {/* Usage Instructions */}
        <div className="pt-4 border-t border-border">
          <InfoSection title="Modo de Uso">
            <div className="p-3 rounded-lg bg-secondary">
              <p className="whitespace-pre-wrap">{medication.usageInstructions}</p>
            </div>
          </InfoSection>
        </div>

        {/* Notes */}
        {medication.notes && (
          <div className="pt-4 border-t border-border">
            <InfoSection title="Observacoes">
              <div className="p-3 rounded-lg bg-secondary">
                <p className="whitespace-pre-wrap">{medication.notes}</p>
              </div>
            </InfoSection>
          </div>
        )}

        {/* Protocols */}
        {medication.protocols && medication.protocols.length > 0 && (
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Protocolos Associados
            </h4>
            <div className="space-y-2">
              {medication.protocols.map((protocol) => (
                <div
                  key={protocol.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {protocol.code}
                    </p>
                    {protocol.description && (
                      <p className="text-xs text-muted-foreground">
                        {protocol.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="info">{protocol.id.slice(0, 8)}...</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

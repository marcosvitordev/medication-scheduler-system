"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Pill, Search, Database, Eye, Syringe, Droplets } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/spinner";
import { swrFetcher, catalogApi } from "@/lib/api";
import { MedicationDetailsModal } from "./medication-details-modal";
import type { ClinicalMedication } from "@/types";

export function MedicationsContent() {
  const { data: medications, isLoading, mutate } = useSWR<ClinicalMedication[]>(
    "/clinical-catalog/medications",
    swrFetcher
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMedication, setSelectedMedication] =
    useState<ClinicalMedication | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const filteredMedications = medications?.filter(
    (med) =>
      med.commercialName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      med.activePrinciple.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await catalogApi.seed();
      mutate();
    } catch (error) {
      console.error("Erro ao popular catalogo:", error);
    } finally {
      setIsSeeding(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Carregando medicamentos..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar medicamentos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleSeed} disabled={isSeeding}>
            <Database className="w-4 h-4" />
            {isSeeding ? "Populando..." : "Popular Catalogo"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                <Pill className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {medications?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  Medicamentos no catalogo
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-info/10">
                <Droplets className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {medications?.filter((m) => m.isOphthalmic || m.isOtic).length || 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  Colirios/Otologicos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-warning/10">
                <Syringe className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {medications?.filter((m) => m.requiresGlycemiaScale).length || 0}
                </p>
                <p className="text-sm text-muted-foreground">
                  Requerem glicemia
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Medications List */}
      {!medications || medications.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Pill}
              title="Nenhum medicamento no catalogo"
              description="Popule o catalogo com medicamentos padrao ou adicione manualmente"
              action={
                <Button onClick={handleSeed} disabled={isSeeding}>
                  <Database className="w-4 h-4" />
                  {isSeeding ? "Populando..." : "Popular Catalogo"}
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : filteredMedications && filteredMedications.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Search}
              title="Nenhum resultado encontrado"
              description={`Nao encontramos medicamentos com "${searchQuery}"`}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMedications?.map((medication) => (
            <Card
              key={medication.id}
              className="hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => setSelectedMedication(medication)}
            >
              <CardContent className="p-0">
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 shrink-0">
                    <Pill className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground truncate">
                      {medication.commercialName || medication.activePrinciple}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {medication.activePrinciple}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge variant="default">{medication.administrationRoute}</Badge>
                      {medication.protocols?.length > 0 && (
                        <Badge variant="info">
                          {medication.protocols.length} protocolo(s)
                        </Badge>
                      )}
                      {medication.isOphthalmic && (
                        <Badge variant="success">Oftalmico</Badge>
                      )}
                      {medication.isOtic && (
                        <Badge variant="success">Otologico</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMedication(medication);
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

      {/* Details Modal */}
      {selectedMedication && (
        <MedicationDetailsModal
          medication={selectedMedication}
          isOpen={!!selectedMedication}
          onClose={() => setSelectedMedication(null)}
        />
      )}
    </div>
  );
}

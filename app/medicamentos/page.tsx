import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { MedicationsContent } from "@/components/medications/medications-content";

export default function MedicationsPage() {
  return (
    <DashboardLayout
      title="Catalogo de Medicamentos"
      subtitle="Gerencie os medicamentos e protocolos clinicos"
    >
      <MedicationsContent />
    </DashboardLayout>
  );
}

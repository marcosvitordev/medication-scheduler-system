import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PrescriptionsContent } from "@/components/prescriptions/prescriptions-content";

export default function PrescriptionsPage() {
  return (
    <DashboardLayout
      title="Prescricoes"
      subtitle="Gerencie as prescricoes dos pacientes"
    >
      <PrescriptionsContent />
    </DashboardLayout>
  );
}

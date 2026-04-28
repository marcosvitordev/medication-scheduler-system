import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PatientsContent } from "@/components/patients/patients-content";

export default function PatientsPage() {
  return (
    <DashboardLayout
      title="Pacientes"
      subtitle="Gerencie os pacientes cadastrados no sistema"
    >
      <PatientsContent />
    </DashboardLayout>
  );
}

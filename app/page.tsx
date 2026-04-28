import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export default function DashboardPage() {
  return (
    <DashboardLayout
      title="Dashboard"
      subtitle="Visao geral do sistema de agendamento posologico"
    >
      <DashboardContent />
    </DashboardLayout>
  );
}

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { SettingsContent } from "@/components/settings/settings-content";

export default function SettingsPage() {
  return (
    <DashboardLayout
      title="Configuracoes"
      subtitle="Gerencie as configuracoes do sistema"
    >
      <SettingsContent />
    </DashboardLayout>
  );
}

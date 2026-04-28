import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ScheduleContent } from "@/components/schedule/schedule-content";
import { Suspense } from "react";
import { LoadingState } from "@/components/ui/spinner";

export default function SchedulePage() {
  return (
    <DashboardLayout
      title="Agenda Posologica"
      subtitle="Visualize a agenda de medicamentos dos pacientes"
    >
      <Suspense fallback={<LoadingState message="Carregando agenda..." />}>
        <ScheduleContent />
      </Suspense>
    </DashboardLayout>
  );
}

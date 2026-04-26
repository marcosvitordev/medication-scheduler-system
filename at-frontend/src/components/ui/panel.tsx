import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-md border bg-white p-5 shadow-panel", className)}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h2 className="text-lg font-bold leading-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

import { cn } from "@/lib/utils";

export function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-2 text-sm font-semibold text-muted-foreground", className)}>
      <span>{label}</span>
      {children}
      {error ? <span className="text-xs font-semibold text-destructive">{error}</span> : null}
    </label>
  );
}

export const inputClassName =
  "focus-ring min-h-10 w-full rounded-md border bg-white px-3 text-sm text-foreground shadow-sm";

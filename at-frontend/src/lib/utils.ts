import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatApiError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Não foi possível concluir a operação.";
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ApiError } from "@/lib/api/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    const detailMessage = extractDetailMessage(error.details);
    if (detailMessage) return `${statusPrefix(error.status)} ${detailMessage}`;
    return `${statusPrefix(error.status)} ${error.message}`;
  }

  if (error instanceof TypeError) {
    return "Não foi possível conectar ao backend. Verifique se a API está rodando e tente novamente.";
  }

  if (error instanceof Error) return error.message;
  return "Não foi possível concluir a operação.";
}

function statusPrefix(status: number) {
  if (status === 400) return "Revise os dados informados.";
  if (status === 401 || status === 403) return "Acesso não autorizado.";
  if (status === 404) return "Registro não encontrado.";
  if (status === 409) return "Conflito nos dados.";
  if (status === 422) return "A prescrição não passou nas regras clínicas.";
  if (status >= 500) return "Erro no backend.";
  return `Erro ${status}.`;
}

function extractDetailMessage(details: unknown): string | null {
  if (!details) return null;
  if (typeof details === "string") return details;
  if (Array.isArray(details)) return details.map(extractDetailMessage).filter(Boolean).join(" ");
  if (typeof details !== "object") return null;

  const record = details as Record<string, unknown>;
  const message = record.message;
  if (Array.isArray(message)) return message.map(String).join(" ");
  if (typeof message === "string") return message;

  const errors = record.errors;
  if (Array.isArray(errors)) return errors.map(extractDetailMessage).filter(Boolean).join(" ");

  return null;
}

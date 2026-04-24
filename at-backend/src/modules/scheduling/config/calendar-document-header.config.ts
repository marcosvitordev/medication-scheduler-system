import { ConfigService } from "@nestjs/config";

export interface CalendarDocumentHeaderConfig {
  companyName: string;
  cnpj: string;
  phone: string;
  email: string;
  pharmacistName: string;
  pharmacistCrf: string;
}

const REQUIRED_KEYS = [
  ["CALENDAR_COMPANY_NAME", "companyName"],
  ["CALENDAR_COMPANY_CNPJ", "cnpj"],
  ["CALENDAR_COMPANY_PHONE", "phone"],
  ["CALENDAR_COMPANY_EMAIL", "email"],
  ["CALENDAR_PHARMACIST_NAME", "pharmacistName"],
  ["CALENDAR_PHARMACIST_CRF", "pharmacistCrf"],
] as const;

export function buildCalendarDocumentHeaderConfig(
  configService: Pick<ConfigService, "get">,
): CalendarDocumentHeaderConfig {
  const values = REQUIRED_KEYS.map(([envKey, fieldName]) => {
    const value = configService.get<string>(envKey)?.trim();
    if (!value) {
      throw new Error(
        `Configuração obrigatória ausente para calendário posológico: ${envKey} (${fieldName}).`,
      );
    }
    return value;
  });

  const [companyName, cnpj, phone, email, pharmacistName, pharmacistCrf] =
    values;

  return {
    companyName,
    cnpj,
    phone,
    email,
    pharmacistName,
    pharmacistCrf,
  };
}

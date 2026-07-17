export type ProviderName = "OpenAI" | "Gemini" | "Grok";

export interface ProviderErrorDetails {
  provider: ProviderName;
  status: number;
  detail: string;
  code?: string;
  type?: string;
  requestId?: string;
}

export class ProviderApiError extends Error {
  readonly provider: ProviderName;
  readonly status: number;
  readonly detail: string;
  readonly code?: string;
  readonly type?: string;
  readonly requestId?: string;

  constructor(details: ProviderErrorDetails) {
    const normalizedDetail = details.detail.trim().slice(0, 500);
    super(
      `${details.provider} HTTP ${details.status}${normalizedDetail ? `: ${normalizedDetail}` : ""}`,
    );
    this.name = "ProviderApiError";
    this.provider = details.provider;
    this.status = details.status;
    this.detail = normalizedDetail;
    this.code = details.code;
    this.type = details.type;
    this.requestId = details.requestId;
  }
}

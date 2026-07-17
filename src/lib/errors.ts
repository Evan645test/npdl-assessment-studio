import { t } from "@/locales/zh-Hant";
import { ProviderApiError } from "@/lib/ai/provider-error";

const BILLING_QUOTA_MARKERS = [
  "insufficient_quota",
  "current quota",
  "run out of credits",
  "monthly spend",
  "billing",
  "payment required",
  "credit balance",
];

const RATE_LIMIT_MARKERS = [
  "rate_limit",
  "rate limit",
  "too many requests",
  "resource_exhausted",
  "requests per minute",
  "tokens per minute",
];

function includesAny(value: string, markers: readonly string[]): boolean {
  return markers.some((marker) => value.includes(marker));
}

function providerErrorMessage(error: ProviderApiError): string {
  const diagnostic = [error.code, error.type, error.detail].filter(Boolean).join(" ").toLowerCase();

  if (error.status === 401 || error.status === 403) return t.errors.invalidKey;
  if (error.status === 402 || includesAny(diagnostic, BILLING_QUOTA_MARKERS)) {
    return t.errors.billingQuota(error.provider);
  }
  if (error.status === 429 || includesAny(diagnostic, RATE_LIMIT_MARKERS)) {
    return t.errors.rateLimit(error.provider);
  }
  if (error.status === 404 || diagnostic.includes("model_not_found")) return t.errors.model;

  return error.message || t.errors.generic;
}

export function toUserErrorMessage(error: unknown): string {
  if (error instanceof ProviderApiError) return providerErrorMessage(error);

  const nestedMessage =
    error && typeof error === "object" && "error" in error
      ? (error as { error?: { message?: unknown } }).error?.message
      : undefined;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof nestedMessage === "string"
          ? nestedMessage
          : JSON.stringify(error) || String(error);
  const lower = message.toLowerCase();
  if (
    lower.includes("auth_canceled") ||
    lower.includes("sign in") ||
    lower.includes("puter") && lower.includes("登入")
  ) {
    return t.errors.freeAuth;
  }
  if (
    lower.includes("api key") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("authentication") ||
    lower.includes("unauthorized") ||
    lower.includes("permission")
  ) {
    return t.errors.invalidKey;
  }
  if (
    lower.includes("402") ||
    includesAny(lower, BILLING_QUOTA_MARKERS) ||
    lower.includes("credit") ||
    lower.includes("allowance")
  ) {
    return t.errors.billingQuota("所選供應商");
  }
  if (lower.includes("429") || includesAny(lower, RATE_LIMIT_MARKERS)) {
    return t.errors.rateLimit("所選供應商");
  }
  if (lower.includes("404") || lower.includes("model")) {
    return t.errors.model;
  }
  if (lower.includes("empty") || lower.includes("無法生成")) {
    return t.errors.emptyResponse;
  }
  return message || t.errors.generic;
}

import { KEYS, readStorage } from "@/lib/storage";

const ENV_GOOGLE_OAUTH_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";

let runtimeClientId: string | undefined;
let runtimeLoadPromise: Promise<string> | null = null;

export function getBuiltInGoogleOAuthClientId(): string {
  return ENV_GOOGLE_OAUTH_CLIENT_ID;
}

export async function loadGoogleOAuthRuntimeConfig(): Promise<string> {
  if (ENV_GOOGLE_OAUTH_CLIENT_ID) return ENV_GOOGLE_OAUTH_CLIENT_ID;
  if (runtimeClientId !== undefined) return runtimeClientId;
  if (!runtimeLoadPromise) {
    runtimeLoadPromise = fetch(
      `${import.meta.env.BASE_URL}deploy-config.json`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) return "";
        const data = (await response.json()) as {
          googleOAuthClientId?: string;
        };
        return data.googleOAuthClientId?.trim() ?? "";
      })
      .catch(() => "");
  }
  runtimeClientId = await runtimeLoadPromise;
  return runtimeClientId;
}

export function resolveGoogleOAuthClientId(
  storedClientId?: string | null,
): string {
  return (
    ENV_GOOGLE_OAUTH_CLIENT_ID ||
    runtimeClientId ||
    storedClientId?.trim() ||
    ""
  );
}

export function isGoogleOAuthClientIdManaged(): boolean {
  return Boolean(ENV_GOOGLE_OAUTH_CLIENT_ID || runtimeClientId);
}

export function readStoredGoogleOAuthClientId(): string {
  return readStorage(KEYS.googleOAuthClientId) ?? "";
}

export async function resolveGoogleOAuthClientIdAsync(): Promise<string> {
  await loadGoogleOAuthRuntimeConfig();
  return resolveGoogleOAuthClientId(readStoredGoogleOAuthClientId());
}

import { useEffect, useState } from "react";
import { getGoogleOAuthClientIdIssue } from "@/lib/google-forms";
import {
  getBuiltInGoogleOAuthClientId,
  loadGoogleOAuthRuntimeConfig,
  readStoredGoogleOAuthClientId,
  resolveGoogleOAuthClientId,
} from "@/lib/google-oauth-config";
import { KEYS, writeStorage } from "@/lib/storage";

export function useGoogleOAuthClientId() {
  const [clientId, setClientId] = useState(() =>
    resolveGoogleOAuthClientId(readStoredGoogleOAuthClientId()),
  );
  const [managed, setManaged] = useState(() =>
    Boolean(getBuiltInGoogleOAuthClientId()),
  );
  const [ready, setReady] = useState(() =>
    Boolean(getBuiltInGoogleOAuthClientId()),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const runtimeClientId = await loadGoogleOAuthRuntimeConfig();
      if (cancelled) return;
      const resolved = resolveGoogleOAuthClientId(
        readStoredGoogleOAuthClientId(),
      );
      setClientId(resolved);
      setManaged(
        Boolean(getBuiltInGoogleOAuthClientId() || runtimeClientId),
      );
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const issue = ready ? getGoogleOAuthClientIdIssue(clientId) : null;

  const updateStoredClientId = (value: string) => {
    if (managed) return;
    writeStorage(KEYS.googleOAuthClientId, value);
    setClientId(resolveGoogleOAuthClientId(value));
  };

  return {
    clientId,
    managed,
    ready,
    issue,
    updateStoredClientId,
  };
}

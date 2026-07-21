import { describe, expect, it } from "vitest";
import {
  getBuiltInGoogleOAuthClientId,
  resolveGoogleOAuthClientId,
} from "@/lib/google-oauth-config";

describe("google-oauth-config", () => {
  it("prefers build-time client id over stored value", () => {
    const builtIn = getBuiltInGoogleOAuthClientId();
    expect(resolveGoogleOAuthClientId("stored.apps.googleusercontent.com")).toBe(
      builtIn || "stored.apps.googleusercontent.com",
    );
  });
});

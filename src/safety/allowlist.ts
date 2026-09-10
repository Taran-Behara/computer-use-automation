import type { SurfaceAction } from "../surface/types.js";

// Minimal guardrail for the discovery loop: which action *types* the agent
// may perform at all, and which origins it may navigate to. Risk
// classification (safe/reversible vs. irreversible) and redaction land in a
// later phase -- this is deliberately just the allowlist gate called out in
// Section 3.4, wired into the loop from day one rather than bolted on after.
export interface AllowlistConfig {
  allowedOrigins: string[];
  allowedActionTypes: SurfaceAction["type"][];
}

export function isActionTypeAllowed(type: SurfaceAction["type"], config: AllowlistConfig): boolean {
  return config.allowedActionTypes.includes(type);
}

export function isNavigationAllowed(url: string, config: AllowlistConfig): boolean {
  try {
    const target = new URL(url);
    return config.allowedOrigins.some((origin) => target.origin === origin);
  } catch {
    return false;
  }
}

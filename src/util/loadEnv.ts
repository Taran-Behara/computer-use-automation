import fs from "node:fs";
import path from "node:path";

/** Minimal .env loader so scripts don't need a runtime flag or extra dependency. */
export function loadEnvFile(filePath = ".env"): void {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) return;

  for (const line of fs.readFileSync(resolved, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

import { loadEnvFile } from "../src/util/loadEnv.js";
loadEnvFile();

import { createApp } from "../mock-app/app.js";
import type { AllowlistConfig } from "../src/safety/allowlist.js";
import { runDiscovery } from "../src/agent/loop.js";
import { PlaywrightSurface } from "../src/surface/playwrightSurface.js";

const DEFAULT_GOAL =
  "Log in as operator OP1, look up member 12345, and read their current savings balance.";
const PORT = 4100;

async function main(): Promise<void> {
  const goal = process.argv[2] ?? DEFAULT_GOAL;
  const model = process.env.AGENT_MODEL ?? "claude-haiku-4-5";

  const server = createApp().listen(PORT);
  const surface = await PlaywrightSurface.launch(`http://localhost:${PORT}/login`, { headless: true });

  const allowlist: AllowlistConfig = {
    allowedOrigins: [`http://localhost:${PORT}`],
    allowedActionTypes: ["click", "type", "select", "wait"],
  };

  try {
    console.error(`[run-discovery] model=${model} goal="${goal}"`);
    const result = await runDiscovery({ goal, surface, allowlist, model, maxSteps: 12 });
    console.log(JSON.stringify(result, null, 2));
    console.error(`[run-discovery] status=${result.status} steps=${result.steps.length}`);
  } finally {
    await surface.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

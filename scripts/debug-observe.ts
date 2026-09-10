import { createApp } from "../mock-app/app.js";
import { PlaywrightSurface } from "../src/surface/playwrightSurface.js";

async function main(): Promise<void> {
  const server = createApp().listen(4100);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const surface = await PlaywrightSurface.launch("http://localhost:4100/login");
  const obs = await surface.observe();
  console.log("elements count:", obs.elements.length);
  console.log(JSON.stringify(obs, null, 2));
  await surface.close();
  server.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

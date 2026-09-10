import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../mock-app/app.js";
import { PlaywrightSurface } from "../src/surface/playwrightSurface.js";
import type { LocatorCandidate } from "../src/surface/types.js";

function findByAccessibleName(
  elements: { accessibleName: string | null; locatorCandidates: LocatorCandidate[] }[],
  name: string,
) {
  const el = elements.find((e) => e.accessibleName === name);
  if (!el) throw new Error(`No element with accessible name "${name}"`);
  return el.locatorCandidates;
}

describe("PlaywrightSurface against the mock legacy app", () => {
  let server: Server;
  let baseUrl: string;
  let surface: PlaywrightSurface;

  beforeAll(async () => {
    server = createApp().listen(0);
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://localhost:${port}`;
    surface = await PlaywrightSurface.launch(`${baseUrl}/login`);
  }, 30000);

  afterAll(async () => {
    await surface.close();
    await new Promise((resolve) => server.close(resolve));
  });

  it(
    "logs in, navigates frames, and reads a member's balance",
    async () => {
      const loginObs = await surface.observe();
      const operatorField = findByAccessibleName(loginObs.elements, "operatorId");
      const loginButton = findByAccessibleName(loginObs.elements, "Log In");

      expect(await surface.act({ type: "type", target: operatorField, text: "OP1" })).toMatchObject({ ok: true });
      expect(await surface.act({ type: "click", target: loginButton })).toMatchObject({ ok: true });

      // frameset now loaded; give child frames a moment to finish navigating
      await surface.act({ type: "wait", ms: 300 });

      const framesetObs = await surface.observe();
      expect(framesetObs.frames.map((f) => f.name)).toEqual(expect.arrayContaining(["navFrame", "mainFrame"]));

      const memberLookupLink = findByAccessibleName(framesetObs.elements, "Member Lookup");
      expect(await surface.act({ type: "click", target: memberLookupLink })).toMatchObject({ ok: true });
      await surface.act({ type: "wait", ms: 200 });

      const searchObs = await surface.observe();
      const memberIdField = findByAccessibleName(searchObs.elements, "memberId");
      const searchButton = findByAccessibleName(searchObs.elements, "Search");

      expect(await surface.act({ type: "type", target: memberIdField, text: "12345" })).toMatchObject({ ok: true });
      expect(await surface.act({ type: "click", target: searchButton })).toMatchObject({ ok: true });
      await surface.act({ type: "wait", ms: 200 });

      const resultObs = await surface.observe();
      expect(resultObs.bodyTextSummary).toContain("Jane Doe");
      expect(resultObs.bodyTextSummary).toContain("4200.55");
    },
    30000,
  );
});

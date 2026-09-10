# Computer-Use Automation System

Take-home project for interface.ai: an LLM discovers how to complete a goal against a live
UI, records the successful run as a typed, replayable "capability" artifact, and replays it
deterministically without the model in the loop — with error handling, safety guardrails, and
human escalation.

Status: scaffolding in progress. See [`REPORT.md`](./REPORT.md) for the design write-up
(architecture, artifact schema, error handling, multi-tenant story, escalation model, safety,
and cuts) — filled in as the implementation lands.

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env   # then add your ANTHROPIC_API_KEY
```

## Run

```bash
npm test          # unit tests
npm run typecheck # type-check without emitting
npm run dev        # entry point (placeholder for now)
```

Demo commands (discovery run → replay) will be documented here once the agent loop and
replay executor exist.

## Layout

```
src/
  surface/     — perception/action adapters (Playwright DOM today; swappable backend)
  agent/       — LLM-driven discovery loop (observe → decide → act)
  artifact/    — capability schema + recorder
  replay/      — deterministic replay executor + error taxonomy
  escalation/  — stuck detection + human handoff
  safety/      — allowlist, risk classification, redaction
mock-app/      — local "hostile legacy" target app used for discovery + replay demos
evidence/      — saved artifact + logs from a discovery run and a replay run
```

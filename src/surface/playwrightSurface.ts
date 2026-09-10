import { chromium, type Browser, type BrowserContext, type Frame, type Locator, type Page } from "playwright";
import type {
  ActionOutcome,
  ElementSnapshot,
  FrameRef,
  LocatorCandidate,
  PageObservation,
  SurfaceAction,
  SurfaceAdapter,
} from "./types.js";

interface RawElement {
  tag: string;
  text: string | null;
  value: string | null;
  attributes: Record<string, string>;
}

const INTERACTIVE_SELECTOR = "input, button, select, a[href]";
const TEXT_SUMMARY_LIMIT_PER_FRAME = 2000;

export interface LaunchOptions {
  headless?: boolean;
}

export class PlaywrightSurface implements SurfaceAdapter {
  private constructor(
    private readonly browser: Browser,
    private readonly context: BrowserContext,
    private readonly page: Page,
  ) {}

  static async launch(url: string, options: LaunchOptions = {}): Promise<PlaywrightSurface> {
    const browser = await chromium.launch({ headless: options.headless ?? true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);
    return new PlaywrightSurface(browser, context, page);
  }

  /** Escape hatch for the escalation/handoff phase, which needs the live Page. */
  get rawPage(): Page {
    return this.page;
  }

  currentUrl(): string {
    return this.page.url();
  }

  async observe(): Promise<PageObservation> {
    const frames = this.page.frames();
    const frameRefs: FrameRef[] = [];
    const elements: ElementSnapshot[] = [];
    const summaries: string[] = [];

    for (const frame of frames) {
      let url: string;
      try {
        url = frame.url();
      } catch {
        continue;
      }
      if (!url || url === "about:blank") continue;

      const frameRef: FrameRef = { name: frame.name() || null };
      frameRefs.push(frameRef);

      const raw = await this.extractElements(frame).catch((err: unknown) => {
        console.warn(`[surface] element extraction failed for frame ${frameRef.name ?? "(main)"}:`, err);
        return [] as RawElement[];
      });
      for (const item of raw) {
        elements.push(buildElementSnapshot(item, frameRef));
      }

      const text = await frame.evaluate(() => document.body?.innerText ?? "").catch(() => "");
      summaries.push(`--- frame: ${frameRef.name ?? "(main)"} ---\n${text.slice(0, TEXT_SUMMARY_LIMIT_PER_FRAME)}`);
    }

    return {
      url: this.page.url(),
      title: await this.page.title(),
      frames: frameRefs,
      elements,
      bodyTextSummary: summaries.join("\n\n"),
    };
  }

  private async extractElements(frame: Frame): Promise<RawElement[]> {
    // No named function declarations inside this callback: Playwright
    // serializes only the callback's own source for page.evaluate(), and
    // esbuild-based transpilers (tsx included) inject a `__name(...)` helper
    // call after named functions for stack-trace fidelity -- that helper
    // lives in the surrounding module scope, not in the page, so a nested
    // named function here throws "ReferenceError: __name is not defined"
    // inside the browser and silently loses every element (caught below).
    return frame.evaluate((selector) => {
      return Array.from(document.querySelectorAll(selector)).map((el) => {
        const attributes: Record<string, string> = {};
        for (const attr of Array.from(el.attributes)) attributes[attr.name] = attr.value;
        return {
          tag: el.tagName.toLowerCase(),
          text: (el as HTMLElement).innerText?.trim() || null,
          value: (el as HTMLInputElement).value ?? null,
          attributes,
        };
      });
    }, INTERACTIVE_SELECTOR);
  }

  async act(action: SurfaceAction): Promise<ActionOutcome> {
    if (action.type === "navigate") {
      await this.page.goto(action.url);
      return { ok: true };
    }
    if (action.type === "wait") {
      await this.page.waitForTimeout(action.ms);
      return { ok: true };
    }

    for (const candidate of action.target) {
      try {
        const scope = this.resolveFrame(candidate.frame);
        const locator = this.buildLocator(scope, candidate);
        const count = await locator.count();
        if (count !== 1) continue;

        if (action.type === "click") {
          await locator.click({ timeout: 5000 });
        } else if (action.type === "type") {
          await locator.fill(action.text, { timeout: 5000 });
        } else if (action.type === "select") {
          await locator.selectOption(action.value, { timeout: 5000 });
        }
        return { ok: true, usedLocator: candidate };
      } catch {
        continue;
      }
    }
    return { ok: false, error: "No locator candidate resolved to a unique, actionable element." };
  }

  async screenshot(): Promise<Buffer> {
    return this.page.screenshot();
  }

  async close(): Promise<void> {
    await this.context.close();
    await this.browser.close();
  }

  private resolveFrame(frame: FrameRef): Page | Frame {
    if (!frame.name) return this.page;
    const found = this.page.frame({ name: frame.name });
    if (!found) throw new Error(`Frame not found: ${frame.name}`);
    return found;
  }

  private buildLocator(scope: Page | Frame, candidate: LocatorCandidate): Locator {
    switch (candidate.strategy) {
      case "id":
        return scope.locator(`#${cssEscapeId(candidate.id)}`);
      case "role":
        return scope.getByRole(candidate.role as Parameters<Page["getByRole"]>[0], { name: candidate.name });
      case "text":
        return scope.getByText(candidate.text, { exact: false });
      case "css":
        return scope.locator(candidate.selector);
    }
  }
}

// Ranked most-robust-first: an accessible role+name survives id renumbering
// across framework/tenant reskins; visible text is the next most stable
// human-facing signal; the raw id is fast and usually unique but, on a
// WebForms-style app, is generated per build/control-tree and is the
// candidate most likely to drift across versions or tenants; a css selector
// on the `name` attribute is the last-resort structural fallback.
function buildElementSnapshot(item: RawElement, frame: FrameRef): ElementSnapshot {
  const { tag, text, value, attributes } = item;
  const type = attributes.type?.toLowerCase();

  let role: string | null = null;
  let accessibleName: string | null = null;

  if (tag === "a") {
    role = "link";
    accessibleName = text || attributes.href || null;
  } else if (tag === "select") {
    role = "combobox";
    accessibleName = attributes.name || attributes.id || null;
  } else if (tag === "button" || (tag === "input" && (type === "submit" || type === "button"))) {
    role = "button";
    accessibleName = value || text || attributes.value || null;
  } else if (tag === "input") {
    role = "textbox";
    accessibleName = attributes.placeholder || attributes.name || null;
  }

  const candidates: LocatorCandidate[] = [];
  if (role && accessibleName) candidates.push({ strategy: "role", role, name: accessibleName, frame });
  if (text && text !== accessibleName) candidates.push({ strategy: "text", text, frame });
  if (attributes.id) candidates.push({ strategy: "id", id: attributes.id, frame });
  if (attributes.name) {
    candidates.push({ strategy: "css", selector: `${tag}[name="${cssEscapeAttr(attributes.name)}"]`, frame });
  }

  return { frame, tag, role, accessibleName, text, attributes, locatorCandidates: candidates };
}

function cssEscapeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function cssEscapeAttr(value: string): string {
  return value.replace(/"/g, '\\"');
}

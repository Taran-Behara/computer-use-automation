import type { LocatorCandidate, PageObservation } from "../surface/types.js";

export interface FormattedObservation {
  text: string;
  /** Element index (as shown to the model) -> its ranked locator candidates. */
  indexToLocators: LocatorCandidate[][];
}

export function formatObservation(obs: PageObservation): FormattedObservation {
  const lines: string[] = [`URL: ${obs.url}`, `Title: ${obs.title}`, "", "Interactive elements:"];
  const indexToLocators: LocatorCandidate[][] = [];

  obs.elements.forEach((el, i) => {
    indexToLocators.push(el.locatorCandidates);
    const frameLabel = el.frame.name ?? "(main)";
    const name = el.accessibleName ?? el.text ?? "";
    lines.push(`[${i}] frame=${frameLabel} tag=${el.tag} role=${el.role ?? "?"} name="${name}"`);
  });

  lines.push("", "Visible text:", obs.bodyTextSummary);
  return { text: lines.join("\n"), indexToLocators };
}

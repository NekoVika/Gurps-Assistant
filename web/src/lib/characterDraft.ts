/**
 * A character the chat assistant drafted, priced before the GM reviews it.
 *
 * The assistant proposes a whole file through `draft_file`, and the review
 * panel shows it as a diff. Left alone, every mechanical line in it is one the
 * model wrote and priced itself — the habit 0.5 exists to end. So a character
 * draft carries its mechanics the way the wizard's do: new or changed choices
 * under `build`, gear as items. This turns them into the lines the sheet
 * stores, before the diff is drawn, so what the GM reviews is what the app
 * priced.
 *
 * Unlike the wizard, a draft usually changes a sheet that already exists, so
 * a choice is merged into it rather than written over it:
 *
 *  - a choice replaces the line of the same name (and specialty, where it has
 *    one), and is otherwise added;
 *  - it is priced against the sheet's own scores, with the draft's attribute
 *    choices applied — raising DX re-levels nothing already written, but a
 *    skill added in the same draft is priced against the new DX;
 *  - the stated point total of an existing sheet is the GM's and is kept. A
 *    new sheet gets the total its lines add up to.
 *
 * What the model wrote as a line itself is not refused — a draft is never
 * thrown out for a format slip — but it is reported, so the GM can see which
 * costs the app did not compute and reject that hunk if they choose.
 */

import { render, wasPriced, type BuildEntry, type Declined } from "./characterBuild";
import { derive, ATTRIBUTE_COST } from "./gurpsRules";
import { entriesFromBuild, gearLines, leftToGMBlock, statedScores, unpricedLine } from "./generatedSheet";
import { parseEntry, pointBuild, type EntryKind } from "./pointBuild";
import { parseGear } from "./TraitFormatters";
import { talentBonuses, talentsIn } from "./talents";
import type { TraitIndex } from "./traitResolver";

const SECTIONS: Record<EntryKind, "attributes" | "advantages" | "disadvantages" | "skills"> = {
  attribute: "attributes", advantage: "advantages", disadvantage: "disadvantages", skill: "skills",
};

/** The order every sheet in the campaign lists its attributes in. */
const ATTRIBUTE_ORDER = ["ST", "DX", "IQ", "HT", "HP", "Will", "Per", "FP", "Basic Speed", "Basic Move"];

export type DraftReport = {
  /** True when the draft carried choices or gear items for the app to write. */
  applied: boolean;
  /** Lines the app priced and wrote. */
  priced: number;
  /** Choices kept on the sheet without a cost, each saying why. */
  unpriced: number;
  /** What the model said the book does not price, added to the GM Summary. */
  leftToGM: number;
  /** Mechanical lines the model wrote and priced itself, new to this sheet. */
  modelWritten: string[];
  /** Lines the sheet cannot read at all. */
  unreadable: string[];
  /** Set when the draft is not JSON; it is then shown exactly as sent. */
  invalid?: string;
};

export type PreparedDraft = { content: string; report: DraftReport };

const EMPTY: DraftReport = { applied: false, priced: 0, unpriced: 0, leftToGM: 0, modelWritten: [], unreadable: [] };

function lines(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((l): l is string => typeof l === "string") : [];
}

function bareName(name: string): string {
  return name.replace(/\*\*/g, "").trim().toLowerCase().replace(/\/tl\d*$/, "");
}

/**
 * Where a choice belongs among the lines already there: the index of the
 * line it replaces, or -1 to add it.
 *
 * Name first. A specialty narrows it where the choice gives one — Guns
 * (Rifle) does not replace Guns (Pistol). Without one, a single line of that
 * name is the one meant, which is how `Bad Temper` with a self-control number
 * of 9 finds `Bad Temper (12) [-10]`. Two of them and it cannot tell, so it
 * adds rather than guess which to overwrite.
 */
function slotFor(entry: BuildEntry, existing: string[]): number {
  const kind = entry.kind as EntryKind;
  const name = bareName(entry.name);
  const candidates = existing
    .map((line, i) => ({ read: parseEntry(line, kind), i }))
    .filter(({ read }) => read.name && bareName(read.name) === name);
  if (entry.kind === "attribute") return candidates[0]?.i ?? -1;
  if (entry.specialty) {
    const wanted = entry.specialty.toLowerCase();
    return candidates.find(({ read }) => read.specialty.toLowerCase() === wanted)?.i ?? -1;
  }
  return candidates.length === 1 ? candidates[0].i : -1;
}

/** The scores skills and secondaries are measured against, defaults included. */
function scoresFor(sheet: string[], choices: BuildEntry[]): Record<string, number> {
  const scores = statedScores(sheet);
  for (const c of choices) if (c.kind === "attribute" && c.score !== undefined) scores[c.name] = c.score;
  for (const name of Object.keys(ATTRIBUTE_COST)) scores[name] ??= 10;
  const d = derive({ ST: scores.ST, DX: scores.DX, IQ: scores.IQ, HT: scores.HT });
  const defaults: Record<string, number | null> = {
    HP: d.hp, Will: d.will, Per: d.per, FP: d.fp, "Basic Speed": d.basicSpeed, "Basic Move": d.basicMove,
  };
  for (const [name, value] of Object.entries(defaults)) if (value !== null) scores[name] ??= value;
  return scores;
}

/** Keys in the order the original file has them, so the diff shows changes, not shuffles. */
function inOrder(data: Record<string, unknown>, original: Record<string, unknown> | null): Record<string, unknown> {
  if (!original) return data;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(original)) if (key in data) out[key] = data[key];
  for (const key of Object.keys(data)) if (!(key in out)) out[key] = data[key];
  return out;
}

export function prepareCharacterDraft(
  draftContent: string,
  originalContent: string,
  index: TraitIndex | null,
): PreparedDraft {
  let draft: Record<string, unknown>;
  try {
    const parsed = JSON.parse(draftContent);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not a JSON object");
    draft = parsed as Record<string, unknown>;
  } catch (e) {
    return { content: draftContent, report: { ...EMPTY, invalid: e instanceof Error ? e.message : String(e) } };
  }

  let original: Record<string, unknown> | null = null;
  try {
    const parsed = originalContent.trim() ? JSON.parse(originalContent) : null;
    original = parsed && typeof parsed === "object" ? parsed : null;
  } catch { /* an unreadable original is treated as a new sheet */ }

  const { build, ...rest } = draft;
  const result: Record<string, unknown> = { ...rest };
  const report: DraftReport = { ...EMPTY, modelWritten: [], unreadable: [] };
  const written = new Set<string>();

  // --- choices, priced and merged -------------------------------------------
  const raw = (build && typeof build === "object" ? build : {}) as Record<string, unknown>;
  const choices = entriesFromBuild(build);
  if (build !== undefined) report.applied = true;

  const section = (kind: EntryKind) => lines(result[SECTIONS[kind]]);
  for (const kind of Object.keys(SECTIONS) as EntryKind[]) result[SECTIONS[kind]] = section(kind);

  // A new sheet lists every attribute, as the wizard's do; an existing one
  // keeps the lines it has.
  if (!original && build !== undefined) {
    const named = new Set(section("attribute").map(l => parseEntry(l, "attribute").name));
    const chosen = new Set(choices.filter(c => c.kind === "attribute").map(c => c.name));
    const scores = scoresFor(section("attribute"), choices);
    for (const name of ATTRIBUTE_ORDER) {
      if (!named.has(name) && !chosen.has(name)) choices.push({ kind: "attribute", name, score: scores[name] });
    }
  }

  const scores = scoresFor(section("attribute"), choices);
  const declined: Declined[] = [];
  const pricedKeys = new Set<string>();
  const keyOf = (e: BuildEntry) => `${e.kind}|${bareName(e.name)}|${(e.specialty ?? "").toLowerCase()}`;

  // Attributes first, in the sheet's order, because a secondary is priced
  // against a primary.
  // Traits before skills too: a Talent added in this draft raises its skills
  // for free (B89), so it has to be on the sheet before they are priced.
  const rank = (e: BuildEntry) => e.kind === "skill" ? 99 : e.kind !== "attribute" ? 98
    : (ATTRIBUTE_ORDER.indexOf(e.name) + 1 || 50);
  const talents = talentsIn(index);
  for (const choice of [...choices].sort((a, b) => rank(a) - rank(b))) {
    const bonusFor = choice.kind === "skill" ? talentBonuses(section("advantage"), talents) : undefined;
    const out = render(choice, scores, index, bonusFor);
    if (!wasPriced(out)) { declined.push({ ...out, entry: choice }); continue; }
    const target = section(choice.kind);
    const slot = slotFor(choice, target);
    if (slot >= 0) target[slot] = out.line; else target.push(out.line);
    result[SECTIONS[choice.kind]] = target;
    written.add(out.line);
    pricedKeys.add(keyOf(choice));
    report.priced++;
  }
  // A levelless duplicate of a choice that was priced is noise, not a gap.
  for (const d of declined) {
    if (d.entry && pricedKeys.has(keyOf(d.entry))) continue;
    const kind = d.entry?.kind;
    if (!kind) continue;
    const line = unpricedLine(d);
    result[SECTIONS[kind]] = [...section(kind), line].filter((l, i, all) => all.indexOf(l) === i);
    written.add(line);
    report.unpriced++;
  }

  // --- what the model said it could not price -------------------------------
  // Live, the assistant listed the sheet's own unpriced lines here too, and the
  // summary grew a second "Left to the GM:" repeating them. What the sheet or
  // the summary already says is not said again, and new items join the
  // existing list rather than starting another.
  const summary = typeof result.gmSummary === "string" ? result.gmSummary.trim() : "";
  const onSheet = new Set((Object.values(SECTIONS) as string[]).flatMap(s => lines(result[s])));
  const left = (Array.isArray(raw.unpriceable) ? raw.unpriceable : [])
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .map(s => s.trim())
    .filter((s, i, all) => all.indexOf(s) === i && !onSheet.has(s) && !summary.includes(s));
  if (left.length) {
    const heading = "Left to the GM:";
    const at = summary.lastIndexOf(heading);
    if (at >= 0) {
      // Join the list that is there: after its last "- " line.
      const after = summary.slice(at).split("\n");
      let end = 1;
      while (end < after.length && after[end].startsWith("- ")) end++;
      const merged = [...after.slice(0, end), ...left.map(i => `- ${i}`), ...after.slice(end)];
      result.gmSummary = summary.slice(0, at) + merged.join("\n");
    } else {
      const block = leftToGMBlock(left);
      result.gmSummary = summary ? `${summary}\n\n${block}` : block;
    }
    report.leftToGM = left.length;
  }

  // --- gear -----------------------------------------------------------------
  if (Array.isArray(result.gear) && result.gear.some(g => g && typeof g === "object")) {
    report.applied = true;
    result.gear = (result.gear as unknown[]).flatMap(item => {
      const out = gearLines([item]);
      if (item && typeof item === "object") out.forEach(line => written.add(line));
      return out;
    });
  }

  // --- the total --------------------------------------------------------------
  if (original && "pointTotal" in original) {
    result.pointTotal = original.pointTotal;
  } else if (build !== undefined) {
    result.pointTotal = String(pointBuild(result).computed);
  }

  // --- what the GM should know before applying --------------------------------
  for (const kind of Object.keys(SECTIONS) as EntryKind[]) {
    const before = new Set(lines(original?.[SECTIONS[kind]]));
    for (const line of section(kind)) {
      if (written.has(line) || before.has(line)) continue;
      if (parseEntry(line, kind).points === null) report.unreadable.push(line);
      else report.modelWritten.push(line);
    }
  }
  const gearBefore = new Set(lines(original?.gear));
  for (const line of lines(result.gear)) {
    if (!gearBefore.has(line) && typeof parseGear(line) === "string") report.unreadable.push(line);
  }

  return { content: JSON.stringify(inOrder(result, original), null, 2), report };
}

/** One sentence for the review banner. Empty when there is nothing to say. */
export function describeDraft(report: DraftReport): string {
  if (report.invalid) return `This draft is not valid JSON (${report.invalid}), so it is shown exactly as sent.`;
  const parts: string[] = [];
  if (report.priced) parts.push(`${report.priced} line${report.priced === 1 ? "" : "s"} priced by the app`);
  if (report.unpriced) parts.push(`${report.unpriced} left unpriced with the reason`);
  if (report.leftToGM) parts.push(`${report.leftToGM} item${report.leftToGM === 1 ? "" : "s"} added to the GM Summary under "Left to the GM"`);
  if (report.modelWritten.length) {
    parts.push(`${report.modelWritten.length} line${report.modelWritten.length === 1 ? "" : "s"} priced by the model, not the app — check ${report.modelWritten.length === 1 ? "it" : "them"} before applying`);
  }
  if (report.unreadable.length) parts.push(`${report.unreadable.length} line${report.unreadable.length === 1 ? "" : "s"} the sheet cannot read`);
  return parts.length ? parts.join("; ") + "." : "";
}

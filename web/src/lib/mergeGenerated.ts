import { hasValue } from "../components/editors/CollapsibleSection";

/**
 * Fold generated content into an entity that already exists.
 *
 * Depth is meant to be re-enterable: Rick starts as a name, and six sessions
 * later he matters enough to flesh out. The wizard's normal path writes its
 * result over the target file, which is right when creating from nothing and
 * catastrophic when the GM has already written half of it.
 *
 * The rule is one sentence: generated values fill blanks and never replace
 * anything. That makes the operation safe to run repeatedly and safe to run by
 * accident — the worst case is that nothing changes.
 *
 * Keys the GM has filled keep their value even when the model produced
 * something better, because "better" is not a judgement the app gets to make
 * about someone's own campaign.
 */

export type MergeReport = {
  merged: Record<string, unknown>;
  /** Fields the generated content actually filled in. */
  filled: string[];
  /** Fields left alone because the GM had already written them. */
  kept: string[];
};

export function mergeGenerated(
  existing: Record<string, unknown>,
  generated: Record<string, unknown>
): MergeReport {
  const merged: Record<string, unknown> = { ...existing };
  const filled: string[] = [];
  const kept: string[] = [];

  for (const [key, value] of Object.entries(generated)) {
    // Nothing generated for this field: leave whatever is there.
    if (!hasValue(value)) continue;

    if (hasValue(existing[key])) {
      kept.push(key);
      continue;
    }
    merged[key] = value;
    filled.push(key);
  }

  // `name` is identity, not content. A model that renames the entity while
  // deepening it would orphan every link pointing at the old name.
  if (hasValue(existing.name)) {
    merged.name = existing.name;
  }
  if (hasValue(existing.title)) {
    merged.title = existing.title;
  }

  return { merged, filled: filled.filter(k => k !== "name" && k !== "title"), kept };
}

/** One line for the toast: what the pass actually changed. */
export function describeMerge(report: MergeReport): string {
  if (report.filled.length === 0) {
    return "Nothing to add — every field was already written.";
  }
  const shown = report.filled.slice(0, 4).join(", ");
  const more = report.filled.length > 4 ? ` and ${report.filled.length - 4} more` : "";
  return `Filled in ${shown}${more}. Nothing you had written was changed.`;
}

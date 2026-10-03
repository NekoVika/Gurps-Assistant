import { useMemo } from "react";
import { pointBuild, type PointBuild } from "../lib/pointBuild";
import type { CharacterJSON } from "../lib/types";

/**
 * What the sheet costs, next to what it says it costs.
 *
 * The passport already showed a Points badge, but it only repeated whatever
 * string the file carried — so Killian read "225" while his parts summed to
 * 215, and both player characters read "???" because the GCS import never
 * captured a total. The number was decoration.
 *
 * This is advisory and stays that way: it states both figures and leaves the
 * GM to decide which is wrong. It never edits the sheet.
 *
 * A bestiary template is reported without alarm. A type is a stat block with a
 * nominal value rather than a budget someone spent, the same reasoning that
 * makes types exempt from placement — so the figures are shown, and no
 * disagreement is claimed.
 */

function summarise(build: PointBuild): string {
  const parts = build.sections
    .filter(s => s.entries.length)
    .map(s => `${s.label} ${s.points >= 0 ? "+" : ""}${s.points}`)
    .join("   ");
  const unread = build.complete
    ? ""
    : `\n\n${build.unreadable.length} line${build.unreadable.length === 1 ? "" : "s"} could not be read, so this is a floor:\n` +
      build.unreadable.slice(0, 4).map(e => `  ${e.raw.slice(0, 60)} — ${e.problem}`).join("\n");
  return `${parts}\n\nSummed from the sheet's own brackets.${unread}`;
}

export function PointBudget({ data }: { data: CharacterJSON }) {
  const build = useMemo(() => pointBuild(data as unknown as Record<string, unknown>), [data]);

  // A template carries a nominal figure, not a budget. Show the arithmetic,
  // claim no disagreement.
  const nominal = data.kind === "type";
  const missing = build.stated === null;
  // A sum built from part of a sheet is a floor, so no gap can be claimed from
  // it. An unreadable line explains a difference at least as well as an error
  // does, and saying "8 unaccounted for" when one line was skipped is a lie.
  const disagrees = !nominal && build.complete && !missing && build.difference !== 0;

  const value = build.stated !== null ? String(build.stated) : String(build.computed);
  const tone = disagrees
    ? { background: "rgba(219, 143, 89, 0.12)", borderColor: "rgba(219, 143, 89, 0.45)" }
    : undefined;

  const unread = `${build.unreadable.length} line${build.unreadable.length === 1 ? "" : "s"} unread`;
  let note: string | null = null;
  if (missing) {
    note = `${build.computed} in the parts · ` + (build.complete ? "no total on the sheet" : unread);
  } else if (!build.complete) {
    note = `${build.computed} in the parts · ${unread}`;
  } else if (disagrees) {
    const gap = Math.abs(build.difference as number);
    note = (build.difference as number) > 0
      ? `${build.computed} in the parts · ${gap} unaccounted for`
      : `${build.computed} in the parts · ${gap} over what it claims`;
  } else if (nominal && build.difference !== 0) {
    note = `${build.computed} in the parts`;
  }

  return (
    <div className="meta-badge" style={tone} title={summarise(build)}>
      <span className="eyebrow">Points</span>
      <span className="value">{value || "???"}</span>
      {note && (
        <span
          style={{
            fontSize: "0.62rem",
            color: disagrees ? "#e3a952" : "#9ca3af",
            marginTop: 2,
            whiteSpace: "nowrap",
          }}
        >
          {note}
        </span>
      )}
    </div>
  );
}

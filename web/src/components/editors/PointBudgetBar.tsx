import { useMemo } from "react";
import { pointBuild } from "../../lib/pointBuild";
import { checkMechanics } from "../../lib/mechanicsCheck";
import { auditTraits } from "../../lib/traitAudit";
import { useCampaignStore } from "../../stores/useCampaignStore";
import type { CharacterJSON } from "../../lib/types";

/**
 * The budget, while you spend it.
 *
 * Everything before this checked a sheet after it was written. This is the
 * first piece that helps while it is being written, which is the point at
 * which the release stops being a validator and becomes the thing a GM opens
 * the app to use.
 *
 * It recomputes from the editor's own state, so it moves as you type rather
 * than after a save. Nothing here edits the sheet.
 */

type Props = { data: CharacterJSON };

export function PointBudgetBar({ data }: Props) {
  const traitIndex = useCampaignStore(s => s.traitIndex);
  const campaignBudget = useCampaignStore(s => s.campaignPointBudget);

  const record = data as unknown as Record<string, unknown>;
  const build = useMemo(() => pointBuild(record), [record]);
  const mechanics = useMemo(() => checkMechanics(record, traitIndex), [record, traitIndex]);
  const audit = useMemo(
    () => (traitIndex ? auditTraits(record, traitIndex) : null), [record, traitIndex]);

  // The points and the words are different jobs, and a line the rules decline
  // to price is neither: it is a question the sheet leaves open.
  const disputed = mechanics.findings.filter(f => f.kind !== "label");
  const mislabelled = mechanics.findings.filter(f => f.kind === "label");

  // What this character is aiming at: their own stated total first, because it
  // is the more specific intent, and the campaign's budget only as a default.
  const target = build.stated ?? campaignBudget;
  const spent = build.computed;
  const left = target === null ? null : target - spent;
  const filled = target && target > 0 ? Math.min(spent / target, 1.25) : 0;
  const over = left !== null && left < 0;

  const bar = over ? "#e3a952" : "#58a6ff";

  return (
    <div
      style={{
        background: "rgba(89,137,219,0.07)",
        border: "1px solid rgba(89,137,219,0.22)",
        borderRadius: 8,
        padding: "12px 16px",
        marginBottom: 18,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: "1.35rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {spent}
        </span>
        <span style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
          {target === null
            ? "points spent — no budget set"
            : `of ${target} spent`}
        </span>
        {left !== null && (
          <span style={{ marginLeft: "auto", fontSize: "0.85rem", color: over ? "#e3a952" : "#9ca3af", fontVariantNumeric: "tabular-nums" }}>
            {over ? `${Math.abs(left)} over` : `${left} left`}
          </span>
        )}
      </div>

      {target !== null && target > 0 && (
        <div style={{ height: 5, background: "rgba(0,0,0,0.3)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(filled * 100, 100)}%`, height: "100%", background: bar, transition: "width 140ms ease" }} />
        </div>
      )}

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.75rem", color: "#9ca3af", fontVariantNumeric: "tabular-nums" }}>
        {build.sections.filter(s => s.entries.length).map(section => (
          <span key={section.kind}>
            {section.label} <strong style={{ color: "#e5e7eb" }}>
              {section.points >= 0 ? "+" : ""}{section.points}
            </strong>
          </span>
        ))}
      </div>

      {(mechanics.findings.length > 0 || mechanics.notes.length > 0 || !build.complete
        || (audit?.unrecognised.length ?? 0) > 0) && (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: "0.72rem", paddingTop: 6, borderTop: "1px solid rgba(89,137,219,0.15)" }}>
          {disputed.length > 0 && (
            <span style={{ color: "#e3a952" }} title={disputed.map(f => `${f.name}: ${f.because}`).join("\n")}>
              {disputed.length} cost{disputed.length === 1 ? "" : "s"} the rules price differently
            </span>
          )}
          {mislabelled.length > 0 && (
            <span style={{ color: "#9ca3af" }} title={mislabelled.map(f => `${f.name}: ${f.because}`).join("\n")}>
              {mislabelled.length} line{mislabelled.length === 1 ? "" : "s"} described wrongly
            </span>
          )}
          {mechanics.notes.length > 0 && (
            <span style={{ color: "#9ca3af" }} title={mechanics.notes.map(n => `${n.name}: ${n.because}`).join("\n")}>
              {mechanics.notes.length} the rules decline to price
            </span>
          )}
          {!build.complete && (
            <span style={{ color: "#9ca3af" }} title={build.unreadable.map(e => `${e.raw} — ${e.problem}`).join("\n")}>
              {build.unreadable.length} line{build.unreadable.length === 1 ? "" : "s"} unread, so this is a floor
            </span>
          )}
          {(audit?.unrecognised.length ?? 0) > 0 && (
            <span style={{ color: "#9ca3af" }} title={audit!.unrecognised.map(u => u.entry.name).join("\n")}>
              {audit!.unrecognised.length} trait{audit!.unrecognised.length === 1 ? "" : "s"} nobody prices
            </span>
          )}
        </div>
      )}
    </div>
  );
}

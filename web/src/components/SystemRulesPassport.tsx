import ReactMarkdown from "react-markdown";
import type { SystemRulesJSON } from "../lib/types";

type Props = {
  data: SystemRulesJSON;
};

export function SystemRulesPassport({ data }: Props) {
  return (
    <div className="character-passport" style={{ width: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "20px", background: "rgba(11, 20, 37, 0.4)", padding: "20px", borderRadius: "12px", border: "1px solid rgba(149, 181, 255, 0.1)" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="eyebrow" style={{ color: "#f0d588", marginBottom: "6px" }}>Base System</span>
            <span style={{ fontSize: "1.1rem", fontWeight: 500, color: "#f0d588" }}>{data.baseSystem || "Unknown"}</span>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span className="eyebrow" style={{ color: "#9fbeff", marginBottom: "6px" }}>Point Budget</span>
            <span style={{ fontSize: "1.1rem", fontWeight: 500 }}>{data.pointBudget || "N/A"}</span>
          </div>
        </div>

        {data.coreBooks && data.coreBooks.length > 0 && (
          <section>
            <span className="eyebrow" style={{ color: "#9fbeff", display: "block", marginBottom: "12px" }}>Core Rulebooks</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {data.coreBooks.map((book, idx) => (
                <span key={idx} className="tag-pill" style={{ background: "rgba(149, 181, 255, 0.15)", border: "1px solid rgba(149, 181, 255, 0.3)", color: "#c6d9ff" }}>
                  {book}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {data.allowedOptions && (
          <section style={{ padding: "24px", borderLeft: "4px solid rgba(149, 255, 181, 0.6)", background: "rgba(149, 255, 181, 0.04)", borderRadius: "0 12px 12px 0" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#95ffb5" }}>
              Allowed Options
            </span>
            <div className="markdown-content" style={{ fontSize: "1.05rem" }}>
              <ReactMarkdown>{data.allowedOptions}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.forbiddenOptions && (
          <section style={{ padding: "24px", borderLeft: "4px solid #ff4444", background: "rgba(255, 68, 68, 0.05)", borderRadius: "0 12px 12px 0" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#ffb4b4" }}>
              Forbidden Options
            </span>
            <div className="markdown-content" style={{ fontSize: "1.05rem" }}>
              <ReactMarkdown>{data.forbiddenOptions}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.houseRules && (
          <section style={{ padding: "24px", border: "1px solid rgba(149, 181, 255, 0.3)", background: "rgba(11, 20, 37, 0.6)", borderRadius: "12px" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#9fbeff" }}>
              House Rules & Deviations
            </span>
            <div className="markdown-content lead-markdown" style={{ fontSize: "1.15rem", lineHeight: 1.6 }}>
              <ReactMarkdown>{data.houseRules}</ReactMarkdown>
            </div>
          </section>
        )}

        {data.customMechanics && (
          <section style={{ padding: "24px", borderLeft: "4px solid rgba(200, 149, 255, 0.6)", background: "rgba(200, 149, 255, 0.04)", borderRadius: "0 12px 12px 0" }}>
            <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#c895ff" }}>
              Custom Mechanics
            </span>
            <div className="markdown-content" style={{ fontSize: "1.05rem" }}>
              <ReactMarkdown>{data.customMechanics}</ReactMarkdown>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

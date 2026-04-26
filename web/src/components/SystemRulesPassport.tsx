import ReactMarkdown from "react-markdown";
import type { SystemRulesJSON } from "../lib/types";

type Props = {
  data: SystemRulesJSON;
};

export function SystemRulesPassport({ data }: Props) {
  return (
    <div className="character-passport" style={{ padding: "32px", maxWidth: "1100px", margin: "0 auto" }}>
      <header className="passport-header" style={{ marginBottom: "32px" }}>
        <div className="passport-title-area">
          <h1>{data.title || "System Rules"}</h1>
        </div>
        <div className="passport-meta">
          <div className="meta-badge significance-badge">
            <span className="eyebrow">Base System</span>
            <span className="value">{data.baseSystem || "Unknown"}</span>
          </div>
          <div className="meta-badge" style={{ flexGrow: 1 }}>
            <span className="eyebrow">Point Budget</span>
            <span className="value">{data.pointBudget || "N/A"}</span>
          </div>
        </div>
      </header>

      <div className="passport-grid">
        <aside className="passport-sidebar">
          {data.allowedOptions && (
            <section className="passport-block">
              <h3>Allowed Options</h3>
              <div className="markdown-content">
                <ReactMarkdown>{data.allowedOptions}</ReactMarkdown>
              </div>
            </section>
          )}

          {data.forbiddenOptions && (
            <section className="passport-block highlight-block" style={{ borderLeft: "3px solid #ff4444", background: "rgba(255, 68, 68, 0.05)" }}>
              <h3 style={{ color: "#ffb4b4" }}>Forbidden Options</h3>
              <div className="markdown-content">
                <ReactMarkdown>{data.forbiddenOptions}</ReactMarkdown>
              </div>
            </section>
          )}

          {data.coreBooks && data.coreBooks.length > 0 && (
            <section className="passport-block">
              <h3>Core Rulebooks</h3>
              <ul style={{ paddingLeft: "20px", marginTop: "8px" }}>
                {data.coreBooks.map((book, idx) => (
                  <li key={idx} style={{ marginBottom: "4px" }}>{book}</li>
                ))}
              </ul>
            </section>
          )}
        </aside>

        <main className="passport-main">
          {data.houseRules && (
            <section className="tactics-panel" style={{ border: "1px solid rgba(149, 181, 255, 0.2)", background: "rgba(11, 20, 37, 0.5)", marginBottom: "24px" }}>
              <span className="eyebrow" style={{ fontSize: "1.1rem", marginBottom: "16px", display: "inline-block", color: "#9fbeff" }}>
                House Rules & Deviations
              </span>
              <div className="markdown-content lead-markdown">
                <ReactMarkdown>{data.houseRules}</ReactMarkdown>
              </div>
            </section>
          )}

          {data.customMechanics && (
            <section className="mechanics-panel">
              <div className="mechanics-header">
                <h3>Custom Mechanics</h3>
              </div>
              <div className="mechanics-section markdown-content" style={{ padding: "16px" }}>
                <ReactMarkdown>{data.customMechanics}</ReactMarkdown>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

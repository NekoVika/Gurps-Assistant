import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { runRulesQa, type RulesQaResult } from "../lib/api";

export function RulesPanel() {
  const [rulesQuery, setRulesQuery] = useState("");
  const [rulesResult, setRulesResult] = useState<RulesQaResult | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);

  async function handleRulesSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rulesQuery.trim()) return;

    setRulesLoading(true);
    setRulesError(null);

    try {
      const result = await runRulesQa(rulesQuery);
      setRulesResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown rules query error";
      setRulesError(message);
      setRulesResult(null);
    } finally {
      setRulesLoading(false);
    }
  }

  return (
    <div className="workspace-centered" style={{ maxWidth: "100%" }}>
      <main className="panel main-panel" style={{ margin: "0 auto", width: "100%", maxWidth: "1000px" }}>
        <div className="panel-header">
          <p className="eyebrow">Database</p>
          <h2>GURPS Rules Companion</h2>
          <p className="lede" style={{ marginTop: "8px" }}>Query the deterministic rules database for mechanics, tables, and exact citations.</p>
        </div>

        <section style={{ marginTop: "24px" }}>
          <form onSubmit={handleRulesSubmit} style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
            <input
              type="text"
              value={rulesQuery}
              onChange={(e) => setRulesQuery(e.target.value)}
              placeholder="e.g. How does a deceptive attack work? Or: What is the penalty for Alcoholism?"
              className="chat-input"
              style={{ flexGrow: 1, padding: "12px 16px", fontSize: "1.1rem" }}
              disabled={rulesLoading}
            />
            <button type="submit" className="primary-button" disabled={rulesLoading || !rulesQuery.trim()} style={{ width: "140px" }}>
              {rulesLoading ? "Searching..." : "Search Rules"}
            </button>
          </form>

          {rulesError && (
            <div className="error-copy" style={{ whiteSpace: "pre-wrap", padding: "16px", background: "rgba(255, 60, 60, 0.1)", border: "1px solid rgba(255, 60, 60, 0.4)", borderRadius: "8px", marginBottom: "24px" }}>
              {rulesError}
            </div>
          )}

          {rulesResult && !rulesLoading && (
            <div className="file-preview-wrapper" style={{ padding: "32px", borderRadius: "12px", background: "rgba(16, 28, 49, 0.4)" }}>
              <div className="markdown-content">
                <ReactMarkdown>{rulesResult.output}</ReactMarkdown>
              </div>
            </div>
          )}

          {!rulesResult && !rulesLoading && !rulesError && (
            <div className="status-copy" style={{ textAlign: "center", marginTop: "40px", opacity: 0.5 }}>
              Enter a search query above to browse the GURPS Basic Set rules database.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

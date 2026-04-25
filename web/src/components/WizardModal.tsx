import React, { useState, useEffect } from "react";
import type { WizardDef } from "../lib/wizards";

type WizardModalProps = {
  wizard: WizardDef | null;
  onClose: () => void;
  onSubmitPrompt: (compiledPrompt: string, systemAugment?: string) => void;
  onCreateStub: (targetPath: string, templatePath: string, variables: Record<string, string>) => void;
};

export const WizardModal: React.FC<WizardModalProps> = ({ wizard, onClose, onSubmitPrompt, onCreateStub }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Reset anytime wizard changes
  useEffect(() => {
    if (wizard) {
      const initial: Record<string, string> = {};
      wizard.fields.forEach(f => {
        if (f.type === "select" && f.options && f.options.length > 0) {
          initial[f.id] = f.options[0];
        } else {
          initial[f.id] = "";
        }
      });
      setAnswers(initial);
    }
  }, [wizard]);

  if (!wizard) return null;

  function interpolate(template: string) {
    let result = template;
    for (const [key, val] of Object.entries(answers)) {
      result = result.replace(new RegExp(`{{${key}}}`, "g"), val || `[${key}]`);
    }
    return result;
  }

  function handleAiSubmit() {
    // Compile AI Prompt
    let prompt = interpolate(wizard!.aiPromptTemplate);
    const targetPath = interpolate(wizard!.stubTargetPath);
    const systemAugment = `CRITICAL DESTINATION OVERRIDE: Your response MUST begin exactly with the following XML string to trigger the UI file hook: \`<draft path="${targetPath}">\` and MUST end with \`</draft>\`. Do not hallucinate the file path!`;
    onSubmitPrompt(prompt, systemAugment);
  }

  function handleStubSubmit() {
    const targetPath = interpolate(wizard!.stubTargetPath);
    onCreateStub(targetPath, wizard!.stubTemplatePath, answers);
  }

  const allRequiredMet = wizard.fields.every(f => {
    if (f.required) {
      return (answers[f.id] !== undefined && answers[f.id].trim().length > 0);
    }
    return true;
  });

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      display: "flex", justifyContent: "center", alignItems: "center",
      zIndex: 9999
    }}>
      <div className="panel inspector" style={{
        width: "600px", maxWidth: "90vw", maxHeight: "85vh",
        display: "flex", flexDirection: "column", padding: "24px",
        boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
        border: "1px solid rgba(149, 181, 255, 0.2)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", borderBottom: "1px solid rgba(149, 181, 255, 0.12)", paddingBottom: "16px" }}>
          <div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "1.4em", fontWeight: 600, color: "#fff" }}>✨ {wizard.title}</h2>
            <p style={{ margin: 0, fontSize: "0.9em", color: "#8b949e" }}>{wizard.description}</p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#8b949e", cursor: "pointer", fontSize: "1.2rem", padding: "4px 8px" }}>✕</button>
        </div>

        <div style={{ flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", paddingRight: "8px" }}>
          {wizard.fields.map(f => (
            <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.85em", fontWeight: 600, color: "#c9dfff" }}>
                {f.label} {f.required && <span style={{ color: "#f85149" }}>*</span>}
              </label>
              
              {f.type === "text" && (
                <input 
                  type="text" 
                  value={answers[f.id] || ""}
                  onChange={e => setAnswers({...answers, [f.id]: e.target.value})}
                  placeholder={f.placeholder}
                  style={{ padding: "8px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(149,181,255,0.2)", borderRadius: "4px", color: "white" }}
                />
              )}

              {f.type === "textarea" && (
                <textarea 
                  value={answers[f.id] || ""}
                  onChange={e => setAnswers({...answers, [f.id]: e.target.value})}
                  placeholder={f.placeholder}
                  rows={4}
                  style={{ padding: "8px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(149,181,255,0.2)", borderRadius: "4px", color: "white", resize: "vertical" }}
                />
              )}

              {f.type === "select" && f.options && (
                <select 
                  value={answers[f.id] || ""}
                  onChange={e => setAnswers({...answers, [f.id]: e.target.value})}
                  style={{ padding: "8px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(149,181,255,0.2)", borderRadius: "4px", color: "white" }}
                >
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", paddingTop: "20px", borderTop: "1px solid rgba(149, 181, 255, 0.12)", marginTop: "16px" }}>
          <button 
             onClick={handleStubSubmit}
             disabled={!allRequiredMet}
             className="chip-button ghost-button"
             style={{ padding: "8px 16px", width: "auto" }}
          >
            📝 Generate Manual Stub
          </button>

          <button 
             onClick={handleAiSubmit}
             disabled={!allRequiredMet}
             className="chip-button primary-button"
             style={{ padding: "8px 16px", width: "auto" }}
          >
            ✨ Run AI Workflow
          </button>
        </div>
      </div>
    </div>
  );
};

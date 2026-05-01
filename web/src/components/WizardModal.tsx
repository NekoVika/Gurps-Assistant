import React, { useState, useEffect } from "react";
import type { WizardDef } from "../lib/wizards";

type WizardModalProps = {
  wizard: WizardDef | null;
  dynamicOptions?: { episodes: string[]; chapters: string[]; encounters: string[] };
  onClose: () => void;
  onSubmitPrompt: (compiledPrompt: string, systemAugment?: string) => void;
  onCreateStub: (targetPath: string, templatePath: string, variables: Record<string, string>) => void;
};

export const WizardModal: React.FC<WizardModalProps> = ({ wizard, dynamicOptions, onClose, onSubmitPrompt, onCreateStub }) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Reset anytime wizard changes
  useEffect(() => {
    if (wizard) {
      setCurrentStepIndex(0);
      const initial: Record<string, string> = {};
      wizard.steps.forEach(step => {
        step.fields.forEach(f => {
          if (f.type === "select" && f.options && f.options.length > 0) {
            initial[f.id] = f.options[0];
          } else if (f.type === "dynamic-select" && f.optionsSource && dynamicOptions && dynamicOptions[f.optionsSource] && dynamicOptions[f.optionsSource].length > 0) {
            initial[f.id] = dynamicOptions[f.optionsSource][0];
          } else {
            initial[f.id] = "";
          }
        });
      });
      setAnswers(initial);
    }
  }, [wizard]);

  if (!wizard) return null;

  function interpolate(template: string | ((ans: Record<string, string>) => string)) {
    let result = typeof template === "function" ? template(answers) : template;
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
    onCreateStub(targetPath, interpolate(wizard!.stubTemplatePath), answers);
  }

  const visibleSteps = wizard.steps.filter(step => !step.condition || step.condition(answers));
  const currentStep = visibleSteps[currentStepIndex];

  const visibleFields = currentStep ? currentStep.fields.filter(f => !f.condition || f.condition(answers)) : [];

  const currentStepRequiredMet = visibleFields.every(f => {
    if (f.required) {
      return (answers[f.id] !== undefined && answers[f.id].trim().length > 0);
    }
    return true;
  });

  const isLastStep = currentStepIndex === visibleSteps.length - 1;

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

        <div style={{ flexGrow: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", padding: "4px 12px 4px 4px", margin: "0 -4px" }}>
          {visibleSteps.length > 1 && (
             <div style={{ fontSize: "0.85em", color: "#8b949e", marginBottom: "0px" }}>
               Step {currentStepIndex + 1} of {visibleSteps.length}
             </div>
          )}
          {currentStep?.title && <h3 style={{ margin: "0 0 4px 0", fontSize: "1.1em", color: "#c9dfff" }}>{currentStep.title}</h3>}
          {currentStep?.description && <p style={{ margin: "0 0 16px 0", fontSize: "0.9em", color: "#8b949e" }}>{currentStep.description}</p>}

          {visibleFields.map(f => (
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
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(149,181,255,0.2)", borderRadius: "4px", color: "white", outlineOffset: "-1px" }}
                />
              )}

              {f.type === "textarea" && (
                <textarea 
                  value={answers[f.id] || ""}
                  onChange={e => setAnswers({...answers, [f.id]: e.target.value})}
                  placeholder={f.placeholder}
                  rows={4}
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(149,181,255,0.2)", borderRadius: "4px", color: "white", resize: "vertical", outlineOffset: "-1px" }}
                />
              )}

              {f.type === "select" && f.options && (
                <select 
                  value={answers[f.id] || ""}
                  onChange={e => setAnswers({...answers, [f.id]: e.target.value})}
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(149,181,255,0.2)", borderRadius: "4px", color: "white", outlineOffset: "-1px" }}
                >
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}

              {f.type === "dynamic-select" && f.optionsSource && dynamicOptions && (
                <select 
                  value={answers[f.id] || ""}
                  onChange={e => setAnswers({...answers, [f.id]: e.target.value})}
                  style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(149,181,255,0.2)", borderRadius: "4px", color: "white", outlineOffset: "-1px" }}
                >
                  {dynamicOptions[f.optionsSource]?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", paddingTop: "20px", borderTop: "1px solid rgba(149, 181, 255, 0.12)", marginTop: "16px" }}>
          <div>
            {currentStepIndex > 0 && (
              <button 
                onClick={() => setCurrentStepIndex(i => i - 1)}
                className="chip-button ghost-button"
                style={{ padding: "8px 16px", width: "auto" }}
              >
                Back
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "flex-end", flex: 1 }}>
            {!isLastStep ? (
              <button 
                onClick={() => setCurrentStepIndex(i => i + 1)}
                disabled={!currentStepRequiredMet}
                className="chip-button primary-button"
                style={{ padding: "8px 16px", width: "auto" }}
              >
                Next
              </button>
            ) : (
              <>
                <button 
                  onClick={handleStubSubmit}
                  disabled={!currentStepRequiredMet}
                  className="chip-button ghost-button"
                  style={{ padding: "8px 16px", width: "auto" }}
                >
                  📝 Generate Manual Stub
                </button>

                <button 
                  onClick={handleAiSubmit}
                  disabled={!currentStepRequiredMet}
                  className="chip-button primary-button"
                  style={{ padding: "8px 16px", width: "auto" }}
                >
                  ✨ Run AI Workflow
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
